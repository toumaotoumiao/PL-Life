#!/usr/bin/env python3
"""Real Chromium, isolated product code fragments: input, rule switching, read/export.
Synthetic records only. This is NOT native IndexedDB or real-site end-to-end testing.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=ROOT/'.github/pl-ci/round171-evidence'; OUT.mkdir(exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i;return SRC[i:j]
logic='\n'.join((part('function normalizePcRuleData(', 'function normalizePcArchive('),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){'),part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){'),part('  function pcArchiveTextLines(', '  function pcFullArchiveBlocks(')))
input_handler=part('const genericField=e.target.dataset.pcGenericField;', 'const field=e.target.dataset.pcField;')
change_handler=part("if(e.target.dataset.pcGenericField){if(document.activeElement!==e.target)pcApplyRuleFieldFilters();return;}", 'const ruleFilled=e.target.dataset.pcRuleFilled;')
focus_handler=part("els.pcEditorBody?.addEventListener('focusout',e=>{", "    els.pcEditorBody?.addEventListener('toggle',e=>")
setup=r'''
const els={pcEditorBody:document.getElementById('editor')};let pcDraft;
function clone(v){return structuredClone(v)}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function moduleRuleDisplay(v){return String(v?.systemId||'generic')}
function pcStatusLabel(v){return String(v||'active')}
function pcOwnerProfile(){return null}function pcOwnerName(){return '合成PL'}function pcTimelineRows(){return []}
function theme(){return {muted:'#999',text2:'#333'}}
function canvasWrapLines(ctx,text,maxW){let out=[],line='';for(const ch of String(text)){if(line&&ctx.measureText(line+ch).width>maxW){out.push(line);line=ch;}else line+=ch;}out.push(line);return out;}
const PC_BACKGROUND_KEYS=[],privacyMaskEnabled=false;
function updatePcEditorSaveState(){}
function render(){els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);pcApplyRuleFieldFilters();}
'''
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:#f8f7f5;color:#252525}body{padding:12px}#editor{max-width:920px;margin:auto;--t-line:#d8d5ce;--t-surface:#fff;--t-surface-2:#f5f3ef;--t-text:#252525;--t-text-2:#494949;--t-muted:#666;--t-ink:#252525;--t-accent:#b65d43;--t-accent-strong:#a34b2f}.pc-form-section{border:1px solid #ddd;border-radius:13px;padding:12px;background:var(--t-surface)}.pc-generic-rule-group{display:grid;gap:8px;margin:12px 0}.pc-generic-rule-group>header{display:flex;align-items:center;justify-content:space-between;gap:8px}.pc-form-grid{display:grid;gap:8px}.pc-generic-rule-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:8px;border:1px solid var(--t-line);border-radius:10px;padding:8px}.pc-generic-rule-row>input{min-width:0;min-height:44px}.btn{min-height:44px;min-width:44px}.pc-overview-section{border:1px solid var(--t-line);border-radius:12px;padding:12px;background:var(--t-surface)}.pc-rule-row-actions{display:flex;gap:4px}'''
css+=part('/* Stage24: rule field description','@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')+'@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}'
css+='.pc-rule-row-actions>.btn.small{min-height:44px!important;min-width:44px!important}'
css+='@media(max-width:760px){.pc-generic-rule-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.pc-rule-row-actions{grid-column:1/-1;justify-content:flex-end;flex-wrap:wrap}.pc-rule-public-detail{grid-column:1/-1}}'
fixture={'id':'PC-A','name':'测试角色','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}], 'skills':[{'label':f'特技{i}','value':'4','detail':('合成公开说明\n第二行' if i==0 else ''),'future':i} for i in range(12)],'resources':[],'futureSection':{'safe':True}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]}},'coc':{'san':40},'excelEdits':[{'sheet':'Sheet1','ref':'B6','value':'original'}],'background':{},'inventory':'','assets':'','notes':'','status':'active','tags':[]}
checks=[]
def check(k,pass_):
 checks.append((k,bool(pass_)));
 if not pass_:raise AssertionError(k)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':850})
   page.set_content(f'<style>{css}</style><main id="editor"></main>')
   js=setup+'\n'+logic+'\n'+f'pcDraft={json.dumps(fixture,ensure_ascii=False)};\n'+f'els.pcEditorBody.addEventListener("input",function(e){{{input_handler}}});\n'+f'els.pcEditorBody.addEventListener("change",function(e){{{change_handler}}});\n'+focus_handler+'\nrender();'
   page.add_script_tag(content=js)
   result=page.evaluate('''async()=>{
    const old=JSON.stringify({other:pcDraft.ruleSheets.shinobigami,coc:pcDraft.coc,excel:pcDraft.excelEdits});
    const group=els.pcEditorBody.querySelector('[data-pc-rule-group="skills"]');
    const rows=group.querySelectorAll('[data-pc-generic-row]');
    const input=rows[1].querySelector('[data-pc-generic-field="value"]');
    const before=group.querySelector('[data-pc-rule-count]').textContent;
    pcRuleGroupUi(pcDraft,'skills').filled=true;pcApplyRuleFieldFilters();
    input.focus();input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
    const during={count:group.querySelector('[data-pc-rule-count]').textContent,visible:!rows[1].hidden,focus:document.activeElement===input};
    input.dispatchEvent(new Event('change',{bubbles:true}));
    const committedWhileFocused=!rows[1].hidden&&document.activeElement===input;
    input.blur();await new Promise(requestAnimationFrame);
    const after={hidden:rows[1].hidden,computed:getComputedStyle(rows[1]).display,committedWhileFocused};
    const read=pcRuleReadingHTML(pcDraft),hasRead=read.includes('合成公开说明')&&read.includes('展开全部');
    const safety=pcDraft.ruleSheets.insane.skills[1].value===''&&JSON.stringify({other:pcDraft.ruleSheets.shinobigami,coc:pcDraft.coc,excel:pcDraft.excelEdits})===old;
    const meta=structuredClone(pcDraft);meta.ruleMeta.systemId='shinobigami';const alternate=pcRuleCurrentData(meta).traits[0].value==='甲';
    meta.ruleMeta.systemId='insane';const restored=pcRuleCurrentData(meta).skills[0].future===0;
    const saved=normalizePcRuleSheets(JSON.parse(JSON.stringify(meta.ruleSheets)));
    const dataIntact=saved.insane.skills[0].future===0&&saved.insane.futureSection.safe&&saved.shinobigami.traits[0].value==='甲';
    const preview=pcGenericArchiveBlocks(meta,{density:'standard',showOwner:false,showExactDates:false},976);
    const ctx=document.createElement('canvas').getContext('2d'),lines=[];ctx.fillText=(s)=>lines.push(String(s));preview.forEach(b=>b.draw(ctx,0,0,976));
    return {before,during,after,hasRead,safety,alternate,restored,dataIntact,exportDetail:lines.some(s=>s.includes('合成公开说明')),overflow:document.documentElement.scrollWidth>innerWidth+1,buttonMin:Math.min(...[...document.querySelectorAll('.pc-rule-row-actions button')].filter(b=>b.getBoundingClientRect().height>0).map(b=>b.getBoundingClientRect().height))};
   }''')
   for name,pass_ in {'initial-count':result['before']=='已填 12 / 12','immediate-count':result['during']['count']=='已填 11 / 12','keep-focus':result['during']['focus'],'do-not-hide-until-change':result['during']['visible'],'keep-focus-on-enter-change':result['after']['committedWhileFocused'],'hide-after-blur':result['after']['hidden'] and result['after']['computed']=='none','reading':result['hasRead'],'unchanged-other-data':result['safety'],'switch-rule':result['alternate'],'return-rule':result['restored'],'serialized-extensions':result['dataIntact'],'export-description':result['exportDetail'],'no-horizontal-overflow':not result['overflow'],'touch-height':result['buttonMin']>=43}.items():check(f'{width}px:{name}',pass_)
   if width in (375,1280):page.screenshot(path=str(OUT/f'rule-sync-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
print(json.dumps({'tests':len(checks),'passed':sum(x[1] for x in checks),'failed':[k for k,v in checks if not v], 'mode':'isolated real Chromium with production code fragments; synthetic data only'},ensure_ascii=False))
