from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import os,json
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser');styles='\n'.join(x.get_text() for x in soup.find_all('style'))
a=html.index('/* Stage60 pure controlled-draft gate start.');b=html.index('/* Stage60 pure controlled-draft gate end */',a)+len('/* Stage60 pure controlled-draft gate end */')
c=html.index('/* Stage61 specialty mapping preflight start.');d=html.index('let pcInsanePreviewSheets=null',c)
pure=html[a:b]+html[c:d]
a=html.index('/* Stage65 consolidated apply; one confirmation');b=html.index("document.addEventListener('click',event=>{\n if(!event.target.closest('[data-pc-insane-draft-undo]'))return;",a)
handler=html[a:b]
markup='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div class="pc-manage-backdrop" id="pcInsanePreviewBackdrop"><section class="pc-manage-dialog"><header class="pc-manage-head"><strong>Insane 联合核对</strong></header><div class="pc-manage-body" id="pcInsanePreviewBody"></div><footer class="pc-manage-foot"><span>未保存 PC 草稿</span><button class="btn primary">关闭预览</button></footer></section></div></body></html>'
js=r'''
const clone=x=>JSON.parse(JSON.stringify(x));
const pcRuleCurrentData=p=>p.ruleSheets?.insane||{traits:[],skills:[],resources:[]};
const pcRuleEditableData=p=>(p.ruleSheets??={}).insane??=clone(pcRuleCurrentData(p));
const pcInsaneSheetCell=(sheet,ref)=>sheet.cells?.[ref]||'';
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,y=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[y]));
let pcDraft={id:'synthetic',name:'旧名',notes:'用户手写备注',ruleMeta:{systemId:'insane',editionId:'2013-original',confirmed:true},ruleSheets:{insane:{traits:[],skills:[],resources:[],future:{keep:true}}}};
let editingPcId=pcDraft.id,pcInsaneDraftImportReview=null,notices=[],toasts=[];
const canonicalPcFromRuntime=x=>clone(x);
let pcInsaneDraftCompareSession={pcDraftRef:pcDraft,pcId:pcDraft.id,rows:[{key:'name',label:'姓名',ref:'B20',target:'name',source:'新名',current:'旧名',targetExists:true,editionId:'2013-original',pcId:'synthetic',eligible:true,reason:''}],specialtySupplement:{comparison:true,groups:{specialties:[{ref:'B29',value:'察觉',state:'changed',match:{domain:1,row:2,ref:'I2'}}],abilities:[{ref:'H18',value:'逃生',state:'changed'}],items:[{ref:'E32',label:'药瓶',value:'2',state:'changed'}]}}};
function appNotice(x){notices.push(x)}function appConfirm(){return Promise.resolve(true)}function showToast(x){toasts.push(x)}function renderPcEditor(){}function updatePcEditorSaveState(){}
function pcInsanePreviewClose(){document.getElementById('pcInsanePreviewBackdrop').hidden=true;}
window.__read=()=>({pc:clone(pcDraft),review:clone(pcInsaneDraftImportReview),notices,toasts});
'''
ui=r'''
const area=document.getElementById('pcInsanePreviewBody');area.innerHTML=`
<details class="pc-insane-detail-group" open><summary>基础字段</summary><label class="pc-insane-draft-item"><input type="checkbox" data-pc-insane-draft-ref="B20"><span>姓名 B20</span></label></details>
<details class="pc-insane-detail-group" open><summary>特技</summary><label class="pc-insane-draft-item"><input type="checkbox" data-pc-insane-specialty-ref="B29"><span>察觉 B29</span></label></details>
<details class="pc-insane-detail-group" open><summary>能力</summary><label class="pc-insane-draft-item"><input type="checkbox" data-pc-insane-ability-ref="H18"><span>逃生 H18</span></label></details>
<details class="pc-insane-detail-group" open><summary>道具</summary><label class="pc-insane-draft-item"><input type="checkbox" data-pc-insane-item-ref="E32"><span>药瓶 E32</span></label></details>`+pcInsaneCombinedDraftHTML();
'''
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR','/mnt/data/stage65_evidence'));out.mkdir(parents=True,exist_ok=True)
records=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() and os.environ.get('PL_NATIVE_BROWSER_MODE')!='bundled' else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 for width in [320,375,390,430,768,1024,1280,1440]:
  page=browser.new_page(viewport={'width':width,'height':800})
  page.set_content(markup);page.add_script_tag(content=js+'\n'+pure+'\n'+ui+'\n'+handler)
  metric=page.evaluate('''() => {const r=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),b=document.querySelector('[data-pc-insane-combined-apply]').getBoundingClientRect();return {computedHeight:getComputedStyle(document.querySelector('[data-pc-insane-combined-apply]')).height,computedMin:getComputedStyle(document.querySelector('[data-pc-insane-combined-apply]')).minHeight,scroll:document.documentElement.scrollWidth,dialogLeft:r.left,dialogRight:r.right,buttonLeft:b.left,buttonRight:b.right,buttonHeight:b.height}}''')
  good=metric['scroll']<=width+1 and metric['dialogLeft']>=-1 and metric['dialogRight']<=width+1 and metric['buttonLeft']>=-1 and metric['buttonRight']<=width+1 and metric['buttonHeight']>=44
  records.append({'width':width,'pass':good,**metric})
  if width in [320,390,1280]:page.screenshot(path=str(out/f'round216-batch-{width}.png'),full_page=True)
  if width==390:
   for sel in ['draft-ref="B20"','specialty-ref="B29"','ability-ref="H18"','item-ref="E32"']:
    page.locator('[data-pc-insane-'+sel+']').check()
   page.locator('[data-pc-insane-combined-ack]').check()
   page.locator('[data-pc-insane-combined-apply]').click()
   result=page.evaluate('window.__read()')
   assert result['review'] and len(result['review']['changes'])==4 and not result['notices'],result
   assert result['pc']['name']=='新名' and len(result['pc']['ruleSheets']['insane']['resources'])==2,result
   records.append({'action':'one-confirmation-four-groups','pass':True})
   after=page.evaluate('''() => {pcDraft.notes='后来手动编辑';const res=pcInsaneDraftUndoPlan(pcDraft,pcInsaneDraftImportReview);return {name:res.next.name,notes:res.next.notes,skills:res.next.ruleSheets.insane.skills.length,resources:res.next.ruleSheets.insane.resources.length}}''')
   assert after=={'name':'旧名','notes':'后来手动编辑','skills':0,'resources':0},after
   records.append({'action':'atomic-undo-preserves-unrelated-edit','pass':True})
  page.close()
 browser.close()
(out/'round216-browser-result.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
assert len(records)==10 and all(x['pass'] for x in records),records
print('ROUND216 ISOLATED BROWSER',sum(x['pass'] for x in records),'/',len(records),'8 widths + combined apply/undo; not full-app native restore')
