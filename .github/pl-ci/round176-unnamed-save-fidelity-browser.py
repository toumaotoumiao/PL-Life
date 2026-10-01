#!/usr/bin/env python3
"""Production validation and rule editor/reader with synthetic PC. No real profile or native IndexedDB."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci'))) / 'round176-evidence'
OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcValidateArchiveInput(','function assertRunLogInputPreserved('),part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){'),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')])
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui}body{padding:10px;background:var(--bg,#f8f7f5);color:var(--ink,#252525)}main{max-width:900px;margin:auto;--t-line:var(--line,#d8d5ce);--t-surface:var(--surf,#fff);--t-surface-2:var(--surf2,#f5f3ef);--t-text:var(--ink,#252525);--t-text-2:var(--muted,#494949);--t-muted:var(--muted,#666);--t-ink:var(--ink,#252525);--t-accent:var(--accent,#b65d43);--t-accent-strong:var(--accent,#a34b2f);--t-warning:var(--warning,#a36928)}.pc-overview-section,.pc-form-section{border:1px solid var(--t-line);border-radius:12px;padding:12px;background:var(--t-surface);margin-bottom:10px}'''
css+=part('/* Stage24: rule field description','@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')
css+='@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}'
setup=r'''
function clone(v){return structuredClone(v)}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalizedEntityNameKey(s){return String(s||'').trim().toLocaleLowerCase()}
const PC_CARD_TIME_REFS={},PC_COC_KEYS=[],PC_BACKGROUND_KEYS=[],privacyMaskEnabled=false;
function moduleRuleDisplay(v){return String(v?.systemId||'generic')}
function pcStatusLabel(v){return String(v||'active')}
function pcOwnerProfile(){return null}function pcOwnerName(){return '虚构PL'}function pcTimelineRows(){return []}
const els={pcEditorBody:document.getElementById('editor')};let pcDraft;
function render(){document.getElementById('reader').innerHTML=pcRuleReadingHTML(pcDraft);els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft)}
els.pcEditorBody.addEventListener('input',e=>{const fld=e.target.dataset.pcGenericField;if(!fld)return;const row=e.target.closest('[data-pc-generic-row]'),key=row?.dataset.pcGenericRow,index=Number(row?.dataset.pcGenericIndex);if(!row||!['label','value','detail'].includes(fld))return;pcRuleEditableData(pcDraft)[key][index][fld]=e.target.value;pcRuleRefreshGroupCount(e.target.closest('[data-pc-rule-group]'),key)});
'''
fixture={'id':'PC-R176-SYNTH','name':'虚构 PC','notes':'原始备注','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[{'label':'','value':'旧值','detail':'旧公开说明','future':{'stable':1}}],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'','value':'6','detail':'','future':{'stable':2}},{'label':'','value':'','detail':'说明尾部保留\n最后一行'},{'label':'生命力','value':'5','detail':''}],'skills':[{'label':'','value':'77','detail':'旧特技'}]+[{'label':f'特技{i}','value':str(i),'detail':f'说明{i}'} for i in range(9)],'resources':[],'future':{'version':'preserve'}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]},'future-system':{'preserve':True}},'excelEdits':[{'sheet':'旧卡','ref':'B2','value':'原件保留'}],'coc':{'san':40},'skills':[],'weapons':[],'snapshots':[]}
checks=[]
def check(name,okay):
 checks.append((name,bool(okay)))
 if not okay:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':900})
   page.set_content('<style>'+css+'</style><main><div id="reader"></div><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';render();')
   out=page.evaluate('''()=>{
     const before=JSON.stringify(pcDraft),validation=pcValidateArchiveInput(pcDraft);
     const editor=document.getElementById('editor'),reader=document.getElementById('reader'),warning=editor.querySelector('.pc-rule-unnamed-hint')?.textContent;
     const row=editor.querySelector('[data-pc-rule-group="traits"] [data-pc-generic-index="1"]');
     const detail=row.querySelector('textarea');detail.value='说明尾部保留\\n最后一行\\n本次补充';detail.dispatchEvent(new Event('input',{bubbles:true}));
     pcDraft.notes='只修改其他备注';const guard=pcValidateArchiveInput(pcDraft),serialized=JSON.stringify(pcDraft);
     let restored=JSON.parse(serialized);restored.ruleData=normalizePcRuleData(restored.ruleData);restored.ruleSheets=normalizePcRuleSheets(restored.ruleSheets);
     const sameSheets=JSON.stringify(restored.ruleSheets)===JSON.stringify(pcDraft.ruleSheets),sameLegacy=JSON.stringify(restored.ruleData)===JSON.stringify(pcDraft.ruleData);
     const untouched={future:restored.ruleSheets['future-system'].preserve,legacy:restored.ruleData.traits[0].future.stable===1,excel:restored.excelEdits[0].value,unnamed:restored.ruleSheets.insane.traits[0].label==='',tail:restored.ruleSheets.insane.traits[1].detail.endsWith('本次补充')};
     pcDraft=restored;render();const readerAfter=document.getElementById('reader').textContent;
     pcDraft.ruleMeta.systemId='shinobigami';render();const other=document.getElementById('reader').textContent;
     pcDraft.ruleMeta.systemId='insane';render();const returnRead=document.getElementById('reader').textContent;
     const limit=structuredClone(pcDraft);limit.ruleSheets.insane.traits[0].detail='x'.repeat(3001);const tooLong=pcValidateArchiveInput(limit);
     const limit2=structuredClone(pcDraft);limit2.ruleSheets.insane.skills=Array.from({length:101},(_,i)=>({label:String(i),value:''}));const tooMany=pcValidateArchiveInput(limit2);
     const coc=structuredClone(pcDraft);coc.skills=[{name:'',value:60}];const cocGuard=pcValidateArchiveInput(coc);
     return {validation,guard,warning,before,serialized,sameSheets,sameLegacy,untouched,readerAfter,other,returnRead,tooLong,tooMany,cocGuard,overflow:document.documentElement.scrollWidth>innerWidth+1};
   }''')
   expected={'legacy-unnamed-not-blocked':out['validation']=='','edited-unnamed-not-blocked':out['guard']=='','hint-optional':('可补充名称' in (out['warning'] or '')),'sheet-bytes-retained':out['sameSheets'],'legacy-bytes-retained':out['sameLegacy'],'future-key-retained':out['untouched']['future'],'old-extension-retained':out['untouched']['legacy'],'excel-cell-retained':out['untouched']['excel']=='原件保留','name-remains-empty':out['untouched']['unnamed'],'note-tail-retained':out['untouched']['tail'],'reader-unnamed':('未命名字段 1' in out['readerAfter']),'reader-note':('本次补充' in out['readerAfter']),'other-rule-isolated':('本次补充' not in out['other'] and '流派' in out['other']),'switch-back':('本次补充' in out['returnRead']),'length-guard':('过长' in out['tooLong']),'count-guard':('超过 100 项' in out['tooMany']),'coc-name-guard':('补充技能名称' in out['cocGuard']),'no-overflow':not out['overflow']}
   for k,v in expected.items():check(f'{width}px:{k}',v)
   if width in (320,375,1280):page.screenshot(path=str(OUT/f'unnamed-save-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':[k for k,v in checks if not v],'mode':'production parser/validator/renderer in isolated Chromium with synthetic PC; not full app or native IndexedDB'}
(OUT/'round176-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
