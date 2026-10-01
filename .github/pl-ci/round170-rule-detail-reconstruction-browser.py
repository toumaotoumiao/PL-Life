#!/usr/bin/env python3
"""Isolated real-Chromium check of functions extracted verbatim from index.html.
Uses only synthetic records and about:blank/set_content; does NOT claim full-site E2E.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / 'index.html').read_text(encoding='utf-8')
OUT = ROOT / '.github/pl-ci/round170-evidence'
OUT.mkdir(exist_ok=True)

def fragment(start, end):
    a = SOURCE.index(start)
    b = SOURCE.index(end, a)
    return SOURCE[a:b]

logic = '\n'.join([
    fragment('function normalizePcRuleData(', 'function normalizePcArchive('),
    fragment('function pcGenericRuleEditorHTML(pc){', 'function pcProfileEditorHTML(pc){'),
    fragment('function pcRuleReadingHTML(pc){', 'function pcOverviewDashboardHTML(pc){'),
    fragment('  function pcArchiveTextLines(', '  function pcFullArchiveBlocks('),
])
setup = r'''
function clone(v){return structuredClone(v);}
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function moduleRuleDisplay(meta){return String(meta?.systemId||'generic');}
function pcStatusLabel(v){return String(v||'active');}
function pcOwnerProfile(){return null;}
function pcOwnerName(){return 'Synthetic';}
function pcTimelineRows(){return [];}
function theme(){return {muted:'#888',text2:'#333'};}
function canvasWrapLines(ctx,text,maxW){const lines=[];let line='';for(const ch of String(text)){if(line&&ctx.measureText(line+ch).width>maxW){lines.push(line);line=ch;}else line+=ch;}lines.push(line);return lines;}
const PC_BACKGROUND_KEYS=[];
const privacyMaskEnabled=false;
const els={pcEditorBody:document.querySelector('#editor')};
let pcDraft=null;
'''
style = '''
*{box-sizing:border-box}body{margin:0;padding:12px;font:14px system-ui;background:#faf9f5;color:#29292a}
#editor{max-width:900px;margin:auto;--t-line:#d9d6ce;--t-surface:#fff;--t-surface-2:#f6f4ef;--t-text:#262626;--t-text-2:#505050;--t-muted:#666;--t-ink:#202020;--t-accent:#b65d43;--t-accent-strong:#a9442d}
.pc-form-section,.pc-overview-section{border:1px solid #dedbd3;border-radius:12px;padding:12px;margin:8px 0;background:#fff}
.pc-generic-rule-group{margin:10px 0;display:grid;gap:8px}.pc-generic-rule-group>header{display:flex;justify-content:space-between;gap:8px;align-items:center}
.pc-generic-rule-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:7px;padding:8px;border:1px solid #ddd;border-radius:10px}
.pc-generic-rule-row input{min-width:0;width:100%;min-height:42px}.pc-rule-row-actions{display:flex;gap:5px}
.pc-rule-row-actions button,.btn{min-height:44px;min-width:44px}.pc-form-grid{display:grid;gap:8px}
'''
style += SOURCE[SOURCE.index('/* Stage24: rule field description'):SOURCE.index('@media(max-width:430px){.pc-rule-reading-grid') + len('@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')]
style += '@media(max-width:760px){.pc-generic-rule-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.pc-rule-row-actions{grid-column:1/-1;justify-content:flex-end;flex-wrap:wrap}.pc-rule-public-detail{grid-column:1/-1}}'

rows = [{'label':f'技能-{i:02}', 'value':str(i) if i%3 else '', 'detail':('合成公开说明 '+str(i)+'\n')*100 if i==42 else ('描述 ' + str(i) if i%5==0 else ''), 'extension':{'keep':i}} for i in range(70)]
fixture = {
  'id':'synthetic-pc', 'name':'Synthetic', 'ruleMeta':{'systemId':'insane'},
  'ruleData':{'traits':[{'label':'历史资料','value':'old','detail':'history','unknown':True}], 'skills':[], 'resources':[]},
  'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}], 'skills':rows, 'resources':[], 'futureSection':{'keep':1}},
                'shinobigami':{'traits':[{'label':'流派','value':'测试'}],'skills':[],'resources':[]}},
  'coc':{'san':40},'excelEdits':[{'sheet':'角色卡','ref':'B6','value':'old'}],
  'background':{},'notes':'', 'tags':[], 'status':'active'
}
checks=[]
def check(name, ok):
    checks.append((name, bool(ok)))
    if not ok:
        raise AssertionError(name)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    try:
        for width in (320,375,390,430,768,1024,1280,1440):
            page=browser.new_page(viewport={'width':width,'height':850})
            page.set_content(f'<html><head><style>{style}</style></head><body><main id="editor"></main></body></html>')
            page.add_script_tag(content=setup+'\n'+logic+f'\npcDraft={json.dumps(fixture,ensure_ascii=False)};')
            result=page.evaluate('''() => {
                const before=JSON.stringify({coc:pcDraft.coc,excelEdits:pcDraft.excelEdits,other:pcDraft.ruleSheets.shinobigami});
                els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);
                pcApplyRuleFieldFilters();
                const long=els.pcEditorBody.querySelector('[data-pc-generic-row="skills"][data-pc-generic-index="42"]');
                const detail=long.querySelector('[data-pc-rule-detail-token]');detail.open=true;pcCaptureRuleDisclosures();
                const oldToken=detail.dataset.pcRuleDetailToken;
                const move=pcMoveRuleEntry(pcDraft,'skills',42,1);pcRuleSwapDisclosure(pcDraft,'skills',42,43);
                els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);pcApplyRuleFieldFilters();
                const next=els.pcEditorBody.querySelector('[data-pc-generic-row="skills"][data-pc-generic-index="43"]');
                const kept=next.querySelector('[data-pc-rule-detail-token]').open&&next.querySelector('textarea').value.includes('合成公开说明');
                const group=pcRuleGroupUi(pcDraft,'skills');group.query='技能-43';group.filled=true;pcApplyRuleFieldFilters();
                const shown=[...els.pcEditorBody.querySelectorAll('[data-pc-generic-row="skills"]')].filter(x=>!x.hidden).length;
                const own=els.pcEditorBody.scrollWidth<=innerWidth+1;
                const reading=pcRuleReadingHTML(pcDraft);const readFull=reading.includes('pc-rule-reading-more')&&reading.includes('合成公开说明');
                const exportBlocks=pcGenericArchiveBlocks(pcDraft,{density:'relaxed',showOwner:false,showExactDates:false},976);
                const maxHeight=Math.max(...exportBlocks.map(x=>x.h));
                const hasDescription=exportBlocks.some(x=>x.title.startsWith('特技')&&x.h>100);
                const rendered=[];const ctx=document.createElement('canvas').getContext('2d');ctx.fillText=(s)=>rendered.push(String(s));exportBlocks.forEach(b=>b.draw(ctx,0,0,976));const longTail=rendered.filter(s=>s.includes('合成公开说明 42')).length>=100;
                const valid=JSON.stringify({coc:pcDraft.coc,excelEdits:pcDraft.excelEdits,other:pcDraft.ruleSheets.shinobigami})===before;
                const normalized=normalizePcRuleSheets(pcDraft.ruleSheets);
                return {kept,shown,own,readFull,maxHeight,hasDescription,longTail,valid,normalizedDetail:normalized.insane.skills[43].detail===pcDraft.ruleSheets.insane.skills[43].detail, groupCount:pcRuleCurrentData(pcDraft).skills.length, exportParts:exportBlocks.length};
            }''')
            for key in ('kept','own','readFull','hasDescription','longTail','valid','normalizedDetail'):
                check(f'{width}px:{key}',result[key])
            check(f'{width}px:search',result['shown']==1)
            check(f'{width}px:chunk',result['maxHeight']<=1040 and result['exportParts']>3)
            check(f'{width}px:allrows',result['groupCount']==70)
            if width in (375,1280):
                page.evaluate('''() => {pcRuleGroupUi(pcDraft,'skills').query='';pcRuleGroupUi(pcDraft,'skills').filled=false;els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);pcApplyRuleFieldFilters();}''')
                page.screenshot(path=str(OUT/f'editor-{width}.png'),full_page=True)
                page.evaluate("() => {els.pcEditorBody.innerHTML=pcRuleReadingHTML(pcDraft);}")
                page.screenshot(path=str(OUT/f'reading-{width}.png'),full_page=True)
            page.close()
    finally:
        browser.close()

print(json.dumps({'tests':len(checks),'passed':sum(ok for _,ok in checks),'failed':[name for name,ok in checks if not ok], 'note':'Isolated fragments of actual index.html, synthetic data only'},ensure_ascii=False))
