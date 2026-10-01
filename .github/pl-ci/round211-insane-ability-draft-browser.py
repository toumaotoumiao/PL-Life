from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,os
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser');style='\n'.join(x.get_text() for x in soup.find_all('style'))
a=html.index('/* Stage60 pure controlled-draft gate start.')
b=html.index('/* Stage60 pure controlled-draft gate end */',a)+len('/* Stage60 pure controlled-draft gate end */')
c=html.index('/* Stage61 specialty mapping preflight start.')
d=html.index('let pcInsanePreviewSheets=null',c)
pure=html[a:b]+'\n'+html[c:d]
start=html.index("document.addEventListener('click',async event=>{\n if(!event.target.closest('[data-pc-insane-ability-apply]'))return;")
end=html.index("document.addEventListener('click',event=>{\n if(!event.target.closest('[data-pc-insane-draft-undo]'))return;",start)
handler=html[start:end]
markup='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>''' +style+'''</style></head><body><div class="pc-manage-backdrop" id="pcInsanePreviewBackdrop"><section class="pc-manage-dialog"><header class="pc-manage-head"><strong>Insane Excel 核对</strong></header><div class="pc-manage-body" id="pcInsanePreviewBody"></div><footer class="pc-manage-foot"><span>未保存</span><button class="btn primary" type="button">关闭预览</button></footer></section></div></body></html>'''
js=r'''
const clone=x=>JSON.parse(JSON.stringify(x));
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function pcRuleCurrentData(p){return p.ruleSheets?.insane||{traits:[],skills:[],resources:[]};}
function pcRuleEditableData(p){return (p.ruleSheets??={}).insane??=clone(pcRuleCurrentData(p));}
function pcInsaneSheetCell(sheet,ref){return sheet.cells?.[ref]||'';}
let pcDraft={id:'fictional',name:'虚构人物',ruleMeta:{systemId:'insane',editionId:'2013-original',confirmed:true},ruleSheets:{insane:{traits:[],skills:[],resources:[{label:'原有能力',value:'手写',future:{keep:true}}],futureSection:{keep:true}}}};
let notices=[],toasts=[],renderCount=0,pcInsaneDraftImportReview=null,pcInsaneDraftCompareSession=null;
let editingPcId=pcDraft.id;function canonicalPcFromRuntime(x){return clone(x);}
const supplement={comparison:true,groups:{abilities:[{value:'能力甲',ref:'H18',state:'changed'},{value:'能力乙',ref:'H19',state:'changed'}]}};
const rows=pcInsaneAbilityPreflight(supplement,pcDraft);
function appNotice(msg){notices.push(msg)}function appConfirm(){return Promise.resolve(true)}
function showToast(msg){toasts.push(msg)}function renderPcEditor(){renderCount++}function updatePcEditorSaveState(){}
function pcInsanePreviewClose(){document.getElementById('pcInsanePreviewBackdrop').hidden=true;}
pcInsaneDraftCompareSession={pcDraftRef:pcDraft,pcId:pcDraft.id,rows:[],specialtySupplement:supplement};
document.getElementById('pcInsanePreviewBody').innerHTML=pcInsaneAbilityDraftHTML(rows);
window.__read=()=>({pc:clone(pcDraft),review:!!pcInsaneDraftImportReview,notices,toasts,renderCount});
'''
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR','/mnt/data/stage63_evidence'))
out.mkdir(parents=True,exist_ok=True)
report=[]
with sync_playwright() as pw:
    executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() and os.environ.get('PL_NATIVE_BROWSER_MODE')!='bundled' else None)
    browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
    for width in [320,375,390,430,768,1024,1280,1440]:
        page=browser.new_page(viewport={'width':width,'height':800})
        page.set_content(markup)
        page.add_script_tag(content=js+'\n'+pure+'\n'+handler)
        page.locator('.pc-insane-ability-draft summary').click()
        box=page.evaluate('''() => {let x=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),button=document.querySelector('[data-pc-insane-ability-apply]').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,dialogLeft:x.left,dialogRight:x.right,buttonLeft:button.left,buttonRight:button.right,buttonHeight:button.height}}''')
        good=box['scroll']<=width+1 and box['dialogLeft']>=-1 and box['dialogRight']<=width+1 and box['buttonLeft']>=-1 and box['buttonRight']<=width+1 and box['buttonHeight']>=44
        report.append({'width':width,'pass':good,**box})
        if width in (320,390,1280):page.screenshot(path=str(out/f'round211-ability-{width}.png'))
        if width==390:
            page.locator('[data-pc-insane-ability-ref="H18"]').check()
            page.locator('[data-pc-insane-ability-ack]').check()
            page.locator('[data-pc-insane-ability-apply]').click()
            value=page.evaluate('window.__read()')
            assert len(value['pc']['ruleSheets']['insane']['resources'])==2,value
            assert value['pc']['ruleSheets']['insane']['resources'][-1]['label']=='能力甲',value
            assert value['pc']['ruleSheets']['insane']['resources'][0]['future']['keep'],value
            assert value['review'] and not value['notices'],value
            report.append({'action':'select-confirm-apply-without-formal-save','pass':True,'draftAbilities':len(value['pc']['ruleSheets']['insane']['resources'])})
            page.evaluate('pcDraft.ruleSheets.insane.resources[1].value="手动改动"')
            rejected=page.evaluate('''() => {try{pcInsaneDraftUndoPlan(pcDraft,pcInsaneDraftImportReview);return false}catch(e){return e.message.includes('已被修改')}}''')
            assert rejected
            report.append({'action':'undo-refuses-later-manual-edit','pass':True})
        page.close()
    browser.close()
(out/'round211-browser-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
assert len(report)==10 and all(x['pass'] for x in report),report
print('ROUND211 ISOLATED BROWSER',sum(x['pass'] for x in report),'/',len(report),'8 widths + 2 ability-name draft interactions; not full app native restore')
