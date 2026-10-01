from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, os
root=Path(__file__).resolve().parents[2]
src=(root/'index.html').read_text()
soup=BeautifulSoup(src,'html.parser')
styles='\n'.join(s.text for s in soup.find_all('style'))
start=src.index('/* Stage60 pure controlled-draft gate start.')
end=src.index('/* Stage60 pure controlled-draft gate end */',start)+len('/* Stage60 pure controlled-draft gate end */')
pure=src[start:end]
handler_begin=src.index("document.addEventListener('click',event=>{\n if(!event.target.closest('[data-pc-insane-draft-undo]'))return;")
handler_end=src.index("document.getElementById('pcInsanePreviewInput')?.addEventListener",handler_begin)
handler=src[handler_begin:handler_end]
assert 'pcInsaneDraftUndoPlan(pcDraft,pcInsaneDraftImportReview)' in handler
assert 'data-pc-insane-draft-undo' in src[src.index('function pcGenericRuleEditorHTML('):src.index('function pcProfileEditorHTML(')]
markup='''<div class="pc-manage-backdrop" id="pcInsanePreviewBackdrop"><section class="pc-manage-dialog"><header class="pc-manage-head"><strong>Insane 导入撤销</strong></header><div class="pc-manage-body"><section class="pc-insane-undo-bar" role="status"><span>已应用 2 项到未保存草稿</span><button type="button" class="btn small" data-pc-insane-draft-undo>撤销本次导入</button></section><p>当前 PC 草稿</p></div><footer class="pc-manage-foot"><span>未保存</span><button class="btn primary">关闭</button></footer></section></div>'''
script=r'''
const clone=x=>JSON.parse(JSON.stringify(x));
const pcRuleCurrentData=p=>p.ruleSheets?.insane||{traits:[{label:'生命力',value:''},{label:'正气度',value:''}],skills:[],resources:[]};
const pcRuleEditableData=p=>(p.ruleSheets??={}).insane??=clone(pcRuleCurrentData(p));
const pcInsaneSheetCell=(sheet,ref)=>sheet.cells?.[ref]??'';
const old={id:'fictional',name:'原人物',age:'19',gender:'女',occupation:'原职业',ruleMeta:{systemId:'insane',editionId:'2013-original'},ruleSheets:{insane:{traits:[{label:'生命力',value:'6',future:'keep'},{label:'正气度',value:'5'}],skills:[],resources:[],futureSection:1}}};
let pcDraft=clone(old),pcInsaneDraftImportReview=null,pcInsaneDraftCompareSession=null;
let renderCount=0,notices=[];window.__formal=clone(old);
function renderPcEditor(){renderCount++;}function updatePcEditorSaveState(){}
function showToast(msg){window.__toast=msg;}function appNotice(msg){notices.push(msg);}
function prep(){
 const rows=[['name','B20','虚构人物'],['life','E22','8']];
 const compared={comparison:true,format:'insane-community-large-v2-readonly',rows:rows.map(([key,ref,value])=>({key,ref,value,state:'changed'}))};
 const sheets=[{name:'角色表',rows:{formulaRefs:new Set()},cells:Object.fromEntries(rows.map(r=>[r[1],r[2]]))}];
 const before=clone(pcDraft),next=pcInsaneDraftBuildPlan(pcDraft,pcInsaneDraftCandidates(compared,sheets,pcDraft),['B20','E22']);
 pcDraft=next.next;pcInsaneDraftImportReview={pcId:pcDraft.id,editionId:pcDraft.ruleMeta.editionId,changes:next.changes,beforeSheetExisted:true,afterSheet:clone(pcDraft.ruleSheets.insane),saveCommitted:false};return before;
}
window.__read=()=>({name:pcDraft.name,life:pcDraft.ruleSheets.insane.traits[0].value,future:pcDraft.ruleSheets.insane.traits[0].future,formal:window.__formal.name,review:!!pcInsaneDraftImportReview,notices,renderCount});
'''
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR','/mnt/data/stage61_evidence'));out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as pw:
 path=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if os.path.exists('/usr/bin/chromium') and os.environ.get('PL_NATIVE_BROWSER_MODE')!='bundled' else None)
 browser=pw.chromium.launch(headless=True,executable_path=path,args=['--no-sandbox'])
 for width in [320,375,390,430,768,1024,1280,1440]:
  page=browser.new_page(viewport={'width':width,'height':800})
  page.set_content('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style>'+markup)
  page.add_script_tag(content=script+'\n'+pure+'\n'+handler)
  page.evaluate('prep()')
  metrics=page.evaluate('''() => {const dialog=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),undo=document.querySelector('[data-pc-insane-draft-undo]').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,dialogRight:dialog.right,buttonLeft:undo.left,buttonRight:undo.right,buttonHeight:undo.height};}''')
  good=metrics['scroll']<=width+1 and metrics['dialogRight']<=width+1 and metrics['buttonLeft']>=-1 and metrics['buttonRight']<=width+1 and metrics['buttonHeight']>=30
  if width==390:
   page.locator('[data-pc-insane-draft-undo]').click()
   restored=page.evaluate('window.__read()')
   assert restored['name']=='原人物' and restored['life']=='6' and restored['future']=='keep' and restored['formal']=='原人物' and not restored['review'],restored
   reports.append({'action':'undo-after-apply','pass':True,'result':restored})
   page.evaluate('prep();pcDraft.ruleSheets.insane.traits[0].value="9"')
   page.locator('[data-pc-insane-draft-undo]').click()
   refused=page.evaluate('window.__read()')
   assert refused['life']=='9' and refused['review'] and refused['notices'],refused
   reports.append({'action':'reject-undo-after-manual-change','pass':True,'result':refused})
  if width in [320,390,1280]:page.screenshot(path=str(out/f'round207-undo-{width}.png'))
  reports.append({'width':width,'pass':good,**metrics})
  page.close()
 browser.close()
(out/'round207-browser-result.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
assert len(reports)==10 and all(x['pass'] for x in reports),reports
print('ROUND207 ISOLATED BROWSER',sum(x['pass'] for x in reports),'/',len(reports),'8 widths and 2 undo interactions; native full app not asserted')
