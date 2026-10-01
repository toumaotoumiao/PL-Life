#!/usr/bin/env python3
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim="""<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>"""
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def record(label,ok):checks.append({'test':label,'pass':bool(ok)})
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  page=browser.new_page(viewport={'width':390,'height':900},service_workers='block')
  page.set_content(html,wait_until='domcontentloaded',timeout=90000)
  result=page.evaluate("""async()=>{
    localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
    let workbookMemory=null;pcWorkbookGet=async id=>workbookMemory&&String(workbookMemory.pcId)===String(id)?workbookMemory:null;pcWorkbookPut=async row=>(workbookMemory=row,row);
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',labels=['力量','敏捷','体质','智力','感知','魅力'],rows=[12,14,16,18,20,22];
    const sheetXml=i=>{if(i!==2)return `<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"${ns}\"><sheetData><row r=\"1\"><c r=\"A1\" t=\"inlineStr\"><is><t>保留页${i}</t></is></c></row></sheetData></worksheet>`;let body='';for(let x=0;x<6;x++){const r=rows[x];body+=`<row r=\"${r}\"><c r=\"C${r}\" t=\"inlineStr\"><is><t>${labels[x]}</t></is></c><c r=\"F${r}\"><f>1+1</f><v>2</v></c><c r=\"I${r}\"><v>${8+x}</v></c></row>`}return `<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"${ns}\"><sheetData>${body}</sheetData></worksheet>`;};
    const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name=\"Sheet${i}\" sheetId=\"${i}\" r:id=\"rId${i}\"/>`);rels.push(`<Relationship Id=\"rId${i}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet${i}.xml\"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i)});}
    const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>'},{name:'_rels/.rels',data:'<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version=\"1.0\"?><workbook xmlns=\"${ns}\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">${rels.join('')}</Relationships>`},...parts]);
    const pc=makeBlankPc(selfProfileId());pc.id='round268';pc.name='DND模板绑定';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc),vals=[15,14,13,12,11,10];rd.traits.forEach((row,i)=>row.value=String(vals[i]));pcs.push(pc);openPcEditor(pc.id);document.querySelector('.pc-foot-more-v72').open=true;document.querySelector('.pc-footer-export-menu').open=true;
    await new Promise(r=>setTimeout(r,50));const button=document.getElementById('pcFooterExportExcelBtn');const before={label:button.textContent,state:button.dataset.pcDndTemplateState};
    const oldDownload=downloadBlobFile;downloadBlobFile=()=>true;const file=new File([source],'fictional-template.xlsx',{type:PC_XLSX_MIME});const bound=await pcExportDndTemplateWorkbook(file,pcDraft,{bindTemplate:true});await new Promise(r=>setTimeout(r,50));const afterBind={label:button.textContent,state:button.dataset.pcDndTemplateState,dirty:pcEditorDirty(),kind:pcWorkbookPending?.kind,key:pcWorkbookPending?.templateKey,source:pcDraft.excelSource?.kind};
    const pending=pcWorkbookPending;await pcWorkbookPut({pcId:pc.id,blob:pending.blob,fileName:pending.fileName,kind:pending.kind,templateKey:pending.templateKey,editionId:pending.editionId,layoutId:pending.layoutId,updatedAt:Date.now()});pcWorkbookPending=null;const saved=pcById(pc.id);saved.excelSource={kind:'dnd-template',fileName:'fictional-template.xlsx',templateId:'dnd:5e-2024',storedAt:Date.now()};pcDraft=clone(saved);syncPcExcelExportUi(pcDraft);await new Promise(r=>setTimeout(r,50));
    let picker=0;const oldReq=pcRequestDndTemplateExport;pcRequestDndTemplateExport=()=>{picker++;return true};const direct=await pcExportDndCharacterCard(pcDraft);const afterSaved={label:button.textContent,state:button.dataset.pcDndTemplateState,picker};
    pcDraft.ruleMeta.editionId='5e-2014';syncPcExcelExportUi(pcDraft);await new Promise(r=>setTimeout(r,50));picker=0;const mismatch=await pcExportDndCharacterCard(pcDraft);const afterMismatch={label:button.textContent,state:button.dataset.pcDndTemplateState,picker};
    pcRequestDndTemplateExport=oldReq;downloadBlobFile=oldDownload;
    return {before,bound,afterBind,direct,afterSaved,mismatch,afterMismatch};
  }""")
  record('initial setup label',result['before']['label']=='设置 D&D 角色卡模板' and result['before']['state']=='missing')
  record('bind succeeds',result['bound'] is True)
  record('pending attachment marked dnd template',result['afterBind']['kind']=='dnd-template' and result['afterBind']['key']=='dnd:5e-2024' and result['afterBind']['source']=='dnd-template')
  record('binding marks editor dirty',result['afterBind']['dirty'] is True)
  record('bound session becomes direct export',result['afterBind']['label']=='导出 D&D 角色 Excel 卡' and result['afterBind']['state']=='saved')
  record('saved template direct export succeeds',result['direct'] is True and result['afterSaved']['picker']==0)
  record('saved state label remains direct',result['afterSaved']['label']=='导出 D&D 角色 Excel 卡' and result['afterSaved']['state']=='saved')
  record('edition mismatch requests setup',result['afterMismatch']['picker']==1 and result['afterMismatch']['label']=='设置 D&D 角色卡模板' and result['afterMismatch']['state']=='missing')
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'synthetic D&D template bind + saved direct export with isolated in-memory workbook stub; no user workbook'}
(out/'round268-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND268',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:print(report['failures']);raise SystemExit(1)
