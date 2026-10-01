from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,os
root=Path(__file__).resolve().parents[2]; src=(root/'index.html').read_text(); soup=BeautifulSoup(src,'html.parser')
style='\n'.join(t.text for t in soup.find_all('style'))
markup=str(soup.find(id='pcInsanePreviewBackdrop')).replace(' hidden=""','')
start=src.index('/* Stage60 pure controlled-draft gate start.')
end=src.index('/* Stage60 pure controlled-draft gate end */',start)+len('/* Stage60 pure controlled-draft gate end */')
pure=src[start:end]
state=src[src.index('let pcInsanePreviewSheets=null'):src.index('function pcInsanePreviewClose(){')]
click_begin=src.index("document.addEventListener('click',async event=>{\n if(!event.target.closest('[data-pc-insane-draft-apply]'))return;")
click_end=src.index("document.getElementById('pcInsanePreviewInput')?.addEventListener",click_begin)
click_code=src[click_begin:click_end]
stub=r'''
const clone=x=>JSON.parse(JSON.stringify(x));
const canonicalPcFromRuntime=x=>clone(x);
const pcRuleCurrentData=pc=>pc.ruleSheets?.insane||{traits:[{label:'生命力',value:''},{label:'正气度',value:''}],skills:[],resources:[]};
const pcRuleEditableData=pc=>(pc.ruleSheets??={}).insane??=clone(pcRuleCurrentData(pc));
const pcInsaneSheetCell=(sheet,ref)=>sheet.cells[ref]??'';
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pcDraft={id:'pc-ui',name:'原人物',age:'19',gender:'女',occupation:'原职业',ruleMeta:{systemId:'insane',editionId:'2013-original'},ruleSheets:{insane:{traits:[{label:'生命力',value:'6',future:1},{label:'正气度',value:'5'}],skills:[],resources:[]}}};
let editingPcId=pcDraft.id;window.__formal=clone(pcDraft);window.__confirm=false;window.__notices=[];window.__render=0;
async function appConfirm(message){window.__lastConfirmation=message;return window.__confirm;}
function appNotice(message){window.__notices.push(message);}
function renderPcEditor(){window.__render++;}
function updatePcEditorSaveState(){}
function showToast(message){window.__toast=message;}
function pcInsanePreviewClose(){pcInsaneDraftCompareSession=null;document.getElementById('pcInsanePreviewBackdrop').hidden=true;}
'''
html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>:root{--t-line:#d6ded7;--t-surface:#fff;--t-surface-2:#f3f7f4;--t-surface-glass:#fff;--t-ink:#182922;--t-muted:#5c7067;--t-primary:#39765c}body{font-family:system-ui;margin:0}'+style+'</style></head><body>'+markup+'</body></html>'
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR','/mnt/data/stage60_evidence'));out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as pw:
 browser_path=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') and os.environ.get('PL_NATIVE_BROWSER_MODE')!='bundled' else None)
 browser=pw.chromium.launch(headless=True,executable_path=browser_path,args=['--no-sandbox'])
 for width in [320,375,390,430,768,1024,1280,1440]:
  page=browser.new_page(viewport={'width':width,'height':800})
  page.set_content(html,wait_until='domcontentloaded')
  page.add_script_tag(content=stub+'\n'+pure+'\n'+state+'\n'+click_code)
  page.evaluate('''() => {
   document.querySelector('#pcInsanePreviewBackdrop').hidden=false;
   const data=[['name','B20','虚构人物'],['age','B21','29'],['gender','E21','女'],['occupation','B26','调查员'],['life','E22','8'],['sanity','E23','7']];
   const compared={comparison:true,format:'insane-community-large-v2-readonly',rows:data.map(([key,ref,value])=>({key,ref,value,state:'changed'}))};
   const sheets=[{name:'角色表',rows:{formulaRefs:new Set()},cells:Object.fromEntries(data.map(x=>[x[1],x[2]]))}];
   const rows=pcInsaneDraftCandidates(compared,sheets,pcDraft);
   pcInsaneDraftCompareSession={pcDraftRef:pcDraft,pcId:pcDraft.id,rows};
   document.querySelector('#pcInsanePreviewBody').innerHTML=pcInsaneDraftReviewHTML(rows);
   document.querySelector('#pcInsaneDraftApplyBtn').hidden=false;
  }''')
  metrics=page.evaluate('''() => {const root=document.querySelector('#pcInsanePreviewBackdrop'),foot=root.querySelector('footer'),dialog=root.querySelector('.pc-manage-dialog');const f=foot.getBoundingClientRect(),r=dialog.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dialogLeft:r.left,dialogRight:r.right,footerBottom:f.bottom,buttons:[...foot.querySelectorAll('button:not([hidden])')].map(x=>{const b=x.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height}}),choices:root.querySelectorAll('[data-pc-insane-draft-ref]:not(:disabled)').length};}''')
  ok=metrics['scrollWidth']<=width+1 and metrics['dialogLeft']>=-1 and metrics['dialogRight']<=width+1 and metrics['footerBottom']<=801 and all(x['left']>=-1 and x['right']<=width+1 for x in metrics['buttons']) and metrics['choices']==5
  reports.append({'width':width,'pass':ok,**metrics})
  if width in [320,390,1280]: page.screenshot(path=str(out/f'round206-preview-{width}.png'))
  if width==390:
   page.locator('[data-pc-insane-draft-ref="B20"]').check()
   page.locator('[data-pc-insane-draft-ref="E22"]').check()
   page.locator('#pcInsaneDraftApplyBtn').click()
   page.wait_for_timeout(100)
   reject=page.evaluate('''() => ({name:pcDraft.name,life:pcDraft.ruleSheets.insane.traits[0].value,formal:window.__formal.name,confirm:window.__lastConfirmation,session:!!pcInsaneDraftImportReview,notices:window.__notices})''')
   assert reject['name']=='原人物' and reject['life']=='6' and not reject['session'] and '虚构人物' in (reject['confirm'] or ''),reject
   page.evaluate('window.__confirm=true')
   page.locator('#pcInsaneDraftApplyBtn').click()
   page.wait_for_timeout(100)
   accept=page.evaluate('''() => ({name:pcDraft.name,life:pcDraft.ruleSheets.insane.traits[0].value,age:pcDraft.age,formal:window.__formal.name,review:pcInsaneDraftImportReview?.changes.length,closed:document.querySelector('#pcInsanePreviewBackdrop').hidden})''')
   assert accept=={'name':'虚构人物','life':'8','age':'19','formal':'原人物','review':2,'closed':True},accept
   reports.append({'action':'cancel-then-confirm','pass':True,'reject':reject,'accept':accept})
  page.close()
 browser.close()
(out/'round206-browser-result.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
assert len(reports)==9 and all(x['pass'] for x in reports),reports
print('STAGE60 ISOLATED CHROMIUM',sum(x['pass'] for x in reports),'/',len(reports),'WIDTHS 8/8; cancel+confirm 1/1')
for x in [r for r in reports if 'width' in r]:print(x['width'],'PASS' if x['pass'] else 'FAIL','document',x['scrollWidth'],'footer',round(x['footerBottom']),'buttons',len(x['buttons']))
