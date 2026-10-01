from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import os,json
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser');styles='\n'.join(x.get_text() for x in soup.find_all('style'))
a=html.index('/* Stage60 pure controlled-draft gate start.')
b=html.index('/* Stage60 pure controlled-draft gate end */',a)+len('/* Stage60 pure controlled-draft gate end */')
c=html.index('/* Stage61 specialty mapping preflight start.')
d=html.index('let pcInsanePreviewSheets=null',c)
pure=html[a:b]+html[c:d]
start=html.index("document.addEventListener('click',async event=>{\n if(!event.target.closest('[data-pc-insane-item-apply]'))return;")
end=html.index("document.addEventListener('click',event=>{\n if(!event.target.closest('[data-pc-insane-draft-undo]'))return;",start)
handler=html[start:end]
markup='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'''+styles+'''</style></head><body><div class="pc-manage-backdrop" id="pcInsanePreviewBackdrop"><section class="pc-manage-dialog"><header class="pc-manage-head"><strong>Insane 数量核对</strong></header><div class="pc-manage-body" id="pcInsanePreviewBody"></div><footer class="pc-manage-foot"><span>未保存</span><button class="btn primary" type="button">关闭预览</button></footer></section></div></body></html>'''
js=r'''
const clone=x=>JSON.parse(JSON.stringify(x));
const pcRuleCurrentData=p=>p.ruleSheets?.insane||{traits:[],skills:[],resources:[]};
const pcRuleEditableData=p=>(p.ruleSheets??={}).insane??=clone(pcRuleCurrentData(p));
const pcInsaneSheetCell=(sheet,ref)=>sheet.cells?.[ref]||'';
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,y=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[y]));
let pcDraft={id:'fictional',name:'虚构角色',ruleMeta:{systemId:'insane',editionId:'2013-original',confirmed:true},ruleSheets:{insane:{traits:[],skills:[],resources:[{label:'既有能力',value:'手写',future:{keep:true}}],futureSection:{keep:true}}}};
let notices=[],toasts=[],renderCount=0,pcInsaneDraftImportReview=null,pcInsaneDraftCompareSession=null;
let editingPcId=pcDraft.id;const canonicalPcFromRuntime=x=>clone(x);
const supplement={comparison:true,groups:{items:[{ref:'E32',label:'镇痛剂',value:'2',state:'changed',usage:'使用',usageRef:'D32'},{ref:'E34',label:'武器',value:'1',state:'changed',usage:'使用',usageRef:'D34'},{ref:'E36',label:'护身符',value:'0',state:'changed'}]}};
function appNotice(msg){notices.push(msg)}function appConfirm(){return Promise.resolve(true)}
function showToast(msg){toasts.push(msg)}function renderPcEditor(){renderCount++}function updatePcEditorSaveState(){}
function pcInsanePreviewClose(){document.getElementById('pcInsanePreviewBackdrop').hidden=true;}
const rows=pcInsaneItemPreflight(supplement,pcDraft);
pcInsaneDraftCompareSession={pcDraftRef:pcDraft,pcId:pcDraft.id,rows:[],specialtySupplement:supplement};
document.getElementById('pcInsanePreviewBody').innerHTML=pcInsaneItemDraftHTML(rows);
window.__read=()=>({pc:clone(pcDraft),review:!!pcInsaneDraftImportReview,notices,toasts,renderCount});
'''
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR','/mnt/data/stage64_evidence'));out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() and os.environ.get('PL_NATIVE_BROWSER_MODE')!='bundled' else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 for width in [320,375,390,430,768,1024,1280,1440]:
  page=browser.new_page(viewport={'width':width,'height':800})
  page.set_content(markup);page.add_script_tag(content=js+'\n'+pure+'\n'+handler)
  page.locator('.pc-insane-item-draft summary').click()
  metric=page.evaluate('''() => {let dialog=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),button=document.querySelector('[data-pc-insane-item-apply]').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,dialogLeft:dialog.left,dialogRight:dialog.right,buttonLeft:button.left,buttonRight:button.right,buttonHeight:button.height}}''')
  good=metric['scroll']<=width+1 and metric['dialogLeft']>=-1 and metric['dialogRight']<=width+1 and metric['buttonLeft']>=-1 and metric['buttonRight']<=width+1 and metric['buttonHeight']>=44
  reports.append({'width':width,'pass':good,**metric})
  if width in (320,390,1280):page.screenshot(path=str(out/f'round213-item-{width}.png'))
  if width==390:
   page.locator('[data-pc-insane-item-ref="E32"]').check()
   page.locator('[data-pc-insane-item-ack]').check()
   page.locator('[data-pc-insane-item-apply]').click()
   result=page.evaluate('window.__read()')
   assert result['review'] and not result['notices'] and result['pc']['ruleSheets']['insane']['resources'][-1]['label']=='道具 · 镇痛剂',result
   assert result['pc']['ruleSheets']['insane']['resources'][-1]['value']=='2' and result['pc']['ruleSheets']['insane']['resources'][0]['future']['keep'],result
   assert '使用' not in json.dumps(result['pc']['ruleSheets']['insane']['resources'][-1],ensure_ascii=False),result
   reports.append({'action':'select-confirm-apply-only-count','pass':True})
   page.evaluate("pcDraft.ruleSheets.insane.resources[1].value='4'")
   blocked=page.evaluate('''() => {try{pcInsaneDraftUndoPlan(pcDraft,pcInsaneDraftImportReview);return false}catch(e){return e.message.includes('已被修改')}}''')
   assert blocked
   reports.append({'action':'reject-undo-after-manual-count-change','pass':True})
  page.close()
 browser.close()
(out/'round213-browser-result.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
assert len(reports)==10 and all(x['pass'] for x in reports),reports
print('ROUND213 ISOLATED BROWSER',sum(x['pass'] for x in reports),'/',len(reports),'8 widths + 2 count-draft interactions; not full app native restore')
