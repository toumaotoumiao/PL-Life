#!/usr/bin/env python3
"""Actual isolated production renderer on synthetic PC data; not full-site IDB/ZIP E2E."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text(encoding='utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci'))) / 'round174-evidence'
OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){'),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){'),part('  function pcArchiveTextLines(', '  function pcFullArchiveBlocks(')])
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:#f8f7f5;color:#252525}body{padding:10px}main{max-width:900px;margin:0 auto;--t-line:#d8d5ce;--t-surface:#fff;--t-surface-2:#f5f3ef;--t-text:#252525;--t-text-2:#494949;--t-muted:#666;--t-ink:#252525;--t-accent:#b65d43;--t-accent-strong:#a34b2f;--t-warning:#a36928}.pc-overview-section,.pc-form-section{border:1px solid var(--t-line);border-radius:12px;padding:12px;background:var(--t-surface);margin-bottom:10px}'''
css+=part('/* Stage24: rule field description','@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')
css+='@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}'
setup=r'''
function clone(v){return structuredClone(v)}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function moduleRuleDisplay(v){return String(v?.systemId||'generic')}
function pcStatusLabel(v){return String(v||'active')}
function pcOwnerProfile(){return null}function pcOwnerName(){return '虚构PL'}function pcTimelineRows(){return []}
function theme(){return {muted:'#777',text2:'#333'}}
function canvasWrapLines(ctx,text,maxW){let out=[],line='';for(const ch of String(text)){if(line&&ctx.measureText(line+ch).width>maxW){out.push(line);line=ch}else line+=ch}out.push(line);return out}
const PC_BACKGROUND_KEYS=[],privacyMaskEnabled=false,els={pcEditorBody:document.querySelector('#editor')};
let pcDraft;
function render(){document.getElementById('reader').innerHTML=pcRuleReadingHTML(pcDraft);els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft)}
document.getElementById('reader').addEventListener('input',e=>{if(e.target.dataset.pcRuleReadingSearch)pcApplyRuleReadingSearch(e.target.closest('[data-pc-rule-reading-group]'),e.target.value)});
els.pcEditorBody.addEventListener('input',e=>{let fld=e.target.dataset.pcGenericField;if(!fld)return;let row=e.target.closest('[data-pc-generic-row]'),key=row?.dataset.pcGenericRow,index=Number(row?.dataset.pcGenericIndex);if(!row||!['label','value','detail'].includes(fld))return;pcRuleEditableData(pcDraft)[key][index][fld]=e.target.value;pcRuleRefreshGroupCount(e.target.closest('[data-pc-rule-group]'),key);const hint=row.querySelector('.pc-rule-unnamed-hint'),pending=pcRuleNeedsName(pcRuleCurrentData(pcDraft)[key][index]);if(hint)hint.hidden=!pending;else if(pending)row.insertAdjacentHTML('afterbegin','<span class="pc-rule-unnamed-hint">未命名 · 请补充名称</span>')});
'''
fixture={'id':'PC-SYNTH','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'','value':'6','detail':'','extension':{'stable':1}},{'label':'生命力','value':'','detail':'公开说明\n带换行'},{'label':'','value':'','detail':'说明的尾部：第1099行'}],'skills':[{'label':'','value':'777','detail':'历史字段'}, *[{'label':'特技'+str(i),'value':str(i),'detail':'描述'+str(i)} for i in range(10)]],'resources':[{'label':'空模板','value':'','detail':''}], 'futureExtension':{'stable':True}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]}},'excelEdits':[{'sheet':'旧卡','ref':'B2','value':'未修改'}],'coc':{'san':50}}
checks=[]
def check(name,ok):
 checks.append((name,bool(ok)))
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':900})
   page.set_content('<style>'+css+'</style><main><div id="reader"></div><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';const originalArchive=JSON.stringify(pcDraft);render();')
   out=page.evaluate('''() => {
      const group=document.querySelector('[data-pc-rule-reading-group="traits"]');const shown=[...group.querySelectorAll('[data-pc-rule-reading-item]')];
      const skills=document.querySelector('[data-pc-rule-reading-group="skills"]');const search=skills.querySelector('input');
      const editor=document.querySelector('[data-pc-rule-group="traits"]');const row=editor.querySelector('[data-pc-generic-index="0"]');
      const start={unnamed:shown[0]?.textContent.includes('未命名字段 1'),detailOnly:shown[2]?.textContent.includes('第1099行'),count:editor.querySelector('[data-pc-rule-count]').textContent,warning:!row.querySelector('.pc-rule-unnamed-hint')?.hidden,tab:document.querySelectorAll('[data-pc-rule-reading-item]').length,searchHeight:search.getBoundingClientRect().height};
      search.value='未命名';search.dispatchEvent(new Event('input',{bubbles:true}));const matched=[...skills.querySelectorAll('[data-pc-rule-reading-item]')].filter(x=>!x.hidden).length;
      const name=row.querySelector('[data-pc-generic-field="label"]');name.value='正式字段';name.dispatchEvent(new Event('input',{bubbles:true}));const after={warning:row.querySelector('.pc-rule-unnamed-hint')?.hidden,count:editor.querySelector('[data-pc-rule-count]').textContent,retained:pcDraft.ruleSheets.insane.traits[0].extension.stable===1};
      const ctx=document.createElement('canvas').getContext('2d'),written=[];const orig=ctx.fillText.bind(ctx);ctx.fillText=(t,x,y)=>{written.push(String(t));orig(t,x,y)};
      const blocks=pcGenericArchiveBlocks(pcDraft,{density:'standard',showOwner:false,showExactDates:false},976);blocks.forEach(b=>b.draw(ctx,0,0,976));
      const other=structuredClone(pcDraft);other.ruleMeta.systemId='shinobigami';const alt=pcGenericArchiveBlocks(other,{density:'standard',showOwner:false,showExactDates:false},976);const original=JSON.stringify(pcDraft)===originalArchive.replace('"label":"","value":"6"','"label":"正式字段","value":"6"');
      return {start,matched,after,exportAlias:written.includes('未命名字段 3'),exportDetail:written.some(s=>s.includes('第1099行')),oneRule:!JSON.stringify(alt).includes('第1099行'),savedValue:pcDraft.ruleSheets.insane.traits[2].detail==='说明的尾部：第1099行',excel:pcDraft.excelEdits[0].value==='未修改',original,overflow:document.documentElement.scrollWidth>innerWidth+1};
   }''')
   for k,v in {'unnamed-value-readable':out['start']['unnamed'],'detail-only-readable':out['start']['detailOnly'],'filled-count':out['start']['count'].startswith('已填 3 / 3 · 待命名 2'),'editor-warning':out['start']['warning'],'no-empty-template':out['start']['tab']==14,'44px-search':out['start']['searchHeight']>=43.5,'search-placeholder':out['matched']==1,'name-clears-warning':out['after']['warning'],'count-updates':out['after']['count']=='已填 3 / 3 · 待命名 1','keeps-extensions':out['after']['retained'],'canvas-fallback-label':out['exportAlias'],'canvas-keeps-tail':out['exportDetail'],'other-rule-isolated':out['oneRule'],'saved-detail':out['savedValue'],'excel-unchanged':out['excel'],'archive-no-other-mutation':out['original'],'no-horizontal-overflow':not out['overflow']}.items():check(f'{width}px:{k}',v)
   if width in (375,1280):page.screenshot(path=str(OUT/f'unnamed-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
result={'tests':len(checks),'passed':sum(v for _,v in checks),'failed':[n for n,v in checks if not v],'mode':'isolated production renderer + synthetic records; no native database'}
(OUT/'round174-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
