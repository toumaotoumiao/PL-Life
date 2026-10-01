#!/usr/bin/env python3
"""Stage33: production rule editor markup + actual event branches in isolated Chromium."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round179-evidence'
OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')]); event=part("        const undoGeneric=e.target.closest('[data-pc-rule-undo]')",'        if(e.target.closest("[data-pc-import-excel]"))')
# Use the production CSS region; add only the host shell ordinarily supplied by the full app.
css=part('<style id="pc-rule-row-order-v230-css">','</style>')[len('<style id="pc-rule-row-order-v230-css">'):]
css+='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;background:var(--t-surface-2,#f8f7f5);color:var(--t-text,#292929);font:14px system-ui}main{max-width:920px;margin:auto;padding:12px;min-width:0}.pc-form-section{padding:12px;border-radius:12px;border:1px solid var(--t-line,#ddd);background:var(--t-surface,#fff);min-width:0}.pc-form-grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pc-generic-rule-row{padding:9px;border-radius:9px;border:1px solid var(--t-line,#ddd);min-width:0}.pc-generic-rule-row input{width:100%}.pc-generic-rule-group header{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}button,input,textarea{font:inherit;max-width:100%}.btn{cursor:pointer;border-radius:8px;background:var(--t-surface,#fff);border:1px solid var(--t-line,#ddd);color:var(--t-text,#222)}.pc-rule-delete-undo{max-width:100%}@media(max-width:760px){.pc-form-grid.two{grid-template-columns:1fr}}'''
setup=r'''
function clone(x){return structuredClone(x)}
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function moduleRuleDisplay(m){return m?.customName||m?.systemId||'规则'}
const els={pcEditorBody:document.getElementById('editor')};let pcDraft;
function renderPcEditor(){els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);pcApplyRuleFieldFilters();}
let lastToast='';function showToast(message){lastToast=message;}
function appNotice(message){lastToast=message;}
function updatePcEditorSaveState(){}
els.pcEditorBody.addEventListener('click',e=>{if(!pcDraft)return;
'''+event+r''' });
'''
fixture={'id':'fictional-PC-A','name':'虚构角色','ruleMeta':{'familyId':'other','systemId':'insane','editionId':'','customName':'','customEdition':'','confirmed':True},'ruleData':{'traits':[{'label':'旧资料','value':'旧值'}],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[{'label':'甲','value':'1'},{'label':'乙','value':'2','detail':'有换行\n文字与长说明'*15,'future':{'payload':['原件','未知字段']}},{'label':'丙','value':'3'}],'resources':[]},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]},'future':{'keep':'未来扩展'}} ,'coc':{'san':66},'excelEdits':[{'sheet':'原件','ref':'B2','value':'保持'}]}
checks=[]
def ck(k,v):
 checks.append((k,bool(v)))
 if not v:raise AssertionError(k)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for w in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':w,'height':920})
   page.set_content('<style>'+css+'</style><main><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';renderPcEditor();window.baseline=JSON.stringify(pcDraft);')
   original=page.evaluate('''()=>JSON.stringify(pcRuleCurrentData(pcDraft).skills)''')
   page.locator('[data-pc-generic-remove="skills"][data-pc-generic-index="1"]').click()
   ck(f'{w}:deleted-one',page.evaluate('pcRuleCurrentData(pcDraft).skills.length===2'))
   ck(f'{w}:undo-visible',page.locator('[data-pc-rule-undo="skills"]').is_visible())
   ck(f'{w}:scope-not-leak',page.locator('[data-pc-rule-undo="traits"]').count()==0)
   ck(f'{w}:button-height',page.locator('[data-pc-rule-undo="skills"]').evaluate('(el)=>el.getBoundingClientRect().height>=42'))
   if w==375:page.screenshot(path=str(OUT/'undo-prompt-375.png'),full_page=True)
   page.locator('[data-pc-rule-undo="skills"]').click()
   ck(f'{w}:byte-equivalent-rows',page.evaluate('JSON.stringify(pcRuleCurrentData(pcDraft).skills)')==original)
   ck(f'{w}:undo-consumed',page.locator('[data-pc-rule-undo="skills"]').count()==0)
   ck(f'{w}:other-sheets-and-legacy',page.evaluate('''()=>pcDraft.ruleData.traits[0].value==='旧值'&&pcDraft.ruleSheets.shinobigami.traits[0].value==='甲'&&pcDraft.ruleSheets.future.keep==='未来扩展'&&pcDraft.coc.san===66&&pcDraft.excelEdits[0].value==='保持' '''))
   ck(f'{w}:no-horizontal-overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if w==375:page.screenshot(path=str(OUT/'undo-restored-375.png'),full_page=True)
   page.close()
  for theme,vals in [('plain',['#fff','#faf9f7','#dedbd8','#262626']),('tomato',['#fff9f6','#fff0ec','#e5c6bd','#442c28']),('night',['#322b3e','#24202f','#655878','#f6edff'])]:
   page=browser.new_page(viewport={'width':375,'height':920});page.set_content('<style>'+css+'</style><main><div id="editor"></div></main>')
   page.evaluate('''v=>['--t-surface','--t-surface-2','--t-line','--t-text'].forEach((n,i)=>document.documentElement.style.setProperty(n,v[i]))''',vals)
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';renderPcEditor();')
   page.locator('[data-pc-generic-remove="skills"][data-pc-generic-index="1"]').click()
   ck(theme+':undo-visible',page.locator('[data-pc-rule-undo="skills"]').is_visible())
   ck(theme+':no-overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   page.screenshot(path=str(OUT/f'undo-{theme}-375.png'),full_page=True);page.close()
 finally:browser.close()
result={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':[name for name,success in checks if not success],'mode':'production PC markup and deletion/undo event branch; isolated Chromium with fictional PC; no native IndexedDB'}
(OUT/'round179-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(result,ensure_ascii=False))
