#!/usr/bin/env python3
from pathlib import Path
import json, os, re
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
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const cell=(ref,value,kind='inline')=>value===null?`<c r="${ref}"/>`:(kind==='formula'?`<c r="${ref}"><f>${value}</f><v>2</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${pcExcelXmlEscape(String(value))}</t></is></c>`);
 const rowsXml=(spec)=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{
   const spec={};const put=(row,ref,value=null,kind='inline')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind));
   if(index===0){put(5,'B5','背景');put(5,'D5');put(8,'B8','种族');put(8,'D8');put(8,'K8','阵营');put(8,'M8');}
   else if(index===1){
     put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');
     put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');
     const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];
     for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}
   } else put(1,'A1',`保留页${index+1}`);
   return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;
 };
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([
  {name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round273';pc.name='合成DND身份战斗映射';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};
 const rd=pcRuleEditableData(pc),ability=[15,14,13,12,11,10];rd.traits.forEach((row,i)=>row.value=String(ability[i]));
 const vals={'背景':'侍从','种族／物种':'高等精灵','阵营':'中立善良','等级':'9','熟练加值':'+4','先攻':'-1','生命值':'52'};for(const [label,value] of Object.entries(vals)){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}
 const map={version:1,layoutId:'layout-21',refs:{'背景':'D5','种族／物种':'D8','阵营':'M8','等级':'Y3','熟练加值':'R3','先攻':'D27','生命值':'AH27'}};
 const file=new File([source],'fictional-template.xlsx',{type:PC_XLSX_MIME}),sheets=await pcExcelReadXlsx(await source.arrayBuffer());
 const valid=pcDndIdentityCombatMapValidate(sheets,'layout-21',map);
 const built=await pcBuildDndTemplateWorkbook(file,pc,{identityCombatMap:map}),parsed=await pcExcelReadXlsx(await built.blob.arrayBuffer());
 const actual={background:pcInsaneSheetCell(parsed[0],'D5'),species:pcInsaneSheetCell(parsed[0],'D8'),alignment:pcInsaneSheetCell(parsed[0],'M8'),level:pcInsaneSheetCell(parsed[1],'Y3'),prof:pcInsaneSheetCell(parsed[1],'R3'),initiative:pcInsaneSheetCell(parsed[1],'D27'),hp:pcInsaneSheetCell(parsed[1],'AH27')};
 const reject=async (bad)=>{try{pcDndIdentityCombatMapValidate(sheets,'layout-21',bad);return false}catch(_){return true}};
 const rejects={formula:await reject({version:1,layoutId:'layout-21',refs:{等级:'F12'}}),missing:await reject({version:1,layoutId:'layout-21',refs:{等级:'Z999'}}),duplicate:await reject({version:1,layoutId:'layout-21',refs:{背景:'D5','种族／物种':'D5'}}),label:await reject({version:1,layoutId:'layout-21',refs:{背景:'B5'}})};
 // UI: only the bound local template and mapping coordinates are exposed.
 let mem={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',updatedAt:Date.now()};
 pcWorkbookGet=async id=>String(id)===pc.id?mem:null;pcWorkbookPut=async row=>(mem=row,row);pcs.push(pc);openPcEditor(pc.id);await pcDndMapOpen();
 const layer=document.getElementById('pcDndMapBackdrop'),body=document.getElementById('pcDndMapBody'),inputs=[...body.querySelectorAll('[data-pc-dnd-map-ref]')];
 const uiBefore={open:!layer.hidden,rows:inputs.length,labels:inputs.map(x=>x.dataset.pcDndMapRef),touch:[...body.querySelectorAll('.pc-dnd-map-row input')].every(x=>x.getBoundingClientRect().height>=44)};
 for(const input of inputs)input.value=map.refs[input.dataset.pcDndMapRef]||'';body.querySelector('[data-pc-dnd-map-attest]').checked=true;await pcDndMapSave();
 const pending=pcWorkbookPending?.identityCombatMap, backupMeta=backupUnlinkedMeta({pcId:pc.id,kind:'dnd-template',identityCombatMap:pending,blob:new Blob(['x'])});
 return {validCount:valid.verified.length,builtCount:built.count,identityCount:built.identityWritten.length,actual,rejects,uiBefore,pendingRefs:pending?.refs||{},backupRefs:backupMeta.identityCombatMap?.refs||{},dirty:pcEditorDirty()};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':950},service_workers='block')
   page.set_content(html,wait_until='domcontentloaded',timeout=90000)
   result=page.evaluate(script)
   record(f'{width}: seven mappings validate',result['validCount']==7)
   record(f'{width}: export writes six abilities plus seven mapped fields',result['builtCount']==13 and result['identityCount']==7)
   record(f'{width}: mapped values round-trip',result['actual']=={'background':'侍从','species':'高等精灵','alignment':'中立善良','level':9,'prof':4,'initiative':-1,'hp':52})
   record(f'{width}: unsafe mapping targets rejected',all(result['rejects'].values()))
   record(f'{width}: map dialog exposes seven coordinate rows',result['uiBefore']['open'] and result['uiBefore']['rows']==7 and len(result['uiBefore']['labels'])==7)
   record(f'{width}: coordinate controls are touch sized',result['uiBefore']['touch'])
   record(f'{width}: confirmed mapping enters pending PC attachment',len(result['pendingRefs'])==7 and result['dirty'])
   record(f'{width}: mapping metadata survives complete-backup serializer',result['backupRefs']==result['pendingRefs'])
   page.screenshot(path=str(out/f'round273-dnd-map-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'synthetic 21-sheet D&D template: manually confirmed coordinate mapping + safe fill; no user workbook'}
(out/'round273-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND273',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
