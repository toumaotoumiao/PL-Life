#!/usr/bin/env python3
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m): return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim="""<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>"""
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def record(label,ok): checks.append({'test':label,'pass':bool(ok)})
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const cell=(ref,value,kind='inline')=>value===null?`<c r="${ref}"/>`:(kind==='formula'?`<c r="${ref}"><f>${value}</f><v>2</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${pcExcelXmlEscape(String(value))}</t></is></c>`);
 const rowsXml=spec=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{const spec={};const put=(row,ref,value=null,kind='inline')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind));
  if(index===0){put(5,'B5','背景');put(5,'D5');put(8,'B8','种族');put(8,'D8');put(8,'K8','阵营');put(8,'M8');}
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`);}put(30,'D30');put(30,'F30','1+1','formula');put(30,'H30');put(32,'F32');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const file=new File([source],'fictional-preflight.xlsx',{type:PC_XLSX_MIME}),sheets=await pcExcelReadXlsx(await source.arrayBuffer());
 const pc=makeBlankPc(selfProfileId());pc.id='round282';pc.name='导出前检查测试';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(const [label,value] of Object.entries({'背景':'PRIVATE_BG_110','种族／物种':'PRIVATE_RACE_110','阵营':'PRIVATE_ALIGN_110','等级':'9','熟练加值':'+4','先攻':'+2','生命值':'52'})){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}rd.skills.push({label:'察觉',value:'PRIVATE_SKILL_110'},{label:'隐匿',value:'+4'});rd.resources.push({label:'长剑',value:'PRIVATE_SWORD_110'});
 const fixed={背景:'D5','种族／物种':'D8','阵营':'M8','等级':'Y3','熟练加值':'R3','先攻':'D27','生命值':'AH27'};
 const badMap={version:2,layoutId:'layout-21',refs:fixed,extras:[{group:'skills',label:'察觉',sheet:1,ref:'D30'},{group:'skills',label:'隐匿',sheet:1,ref:'F30'},{group:'resources',label:'长剑',sheet:1,ref:'H30'}]};
 const safeMap={version:2,layoutId:'layout-21',refs:fixed,extras:[{group:'skills',label:'察觉',sheet:1,ref:'D30'},{group:'skills',label:'隐匿',sheet:1,ref:'F32'},{group:'resources',label:'长剑',sheet:1,ref:'H30'}]};
 const protectedMap={version:2,layoutId:'layout-21',refs:{...fixed,等级:'I12'},extras:[]};
 const badAudit=pcDndExportAuditFromSheets(pc,sheets,badMap),safeAudit=pcDndExportAuditFromSheets(pc,sheets,safeMap),protectedAudit=pcDndExportAuditFromSheets(pc,sheets,protectedMap);
 pcs.push(pc);openPcEditor(pc.id);await pcDndExportCheckOpen(file,pc,{identityCombatMap:badMap});await new Promise(r=>setTimeout(r,40));const layer=document.getElementById('pcDndExportCheckBackdrop'),body=document.getElementById('pcDndExportCheckBody'),confirm=document.querySelector('[data-pc-dnd-export-check-confirm]'),modalState={top:visibleDialog()?.closest?.('#pcDndExportCheckBackdrop')?.id||visibleDialog()?.closest?.('.pc-manage-backdrop')?.id||'',editorInert:document.getElementById('pcEditorBackdrop').inert,checkInert:layer.inert};const badText=body.textContent,blockedUi=confirm.disabled&&badText.includes('阻断项')&&badText.includes('隐匿')&&badText.includes('公式格');const noSecrets=!badText.includes('PRIVATE_BG_110')&&!badText.includes('PRIVATE_RACE_110')&&!badText.includes('PRIVATE_ALIGN_110')&&!badText.includes('PRIVATE_SKILL_110')&&!badText.includes('PRIVATE_SWORD_110');const noOverflow=document.documentElement.scrollWidth<=innerWidth+2;const controls=[...layer.querySelectorAll('button:not([hidden])')].filter(x=>x.offsetParent!==null);const touch=controls.every(x=>x.getBoundingClientRect().height>=44);
 pcDndExportCheckClose();let commits=0,commitPayload=null;const originalCommit=pcExportDndTemplateWorkbook;pcExportDndTemplateWorkbook=async(f,p,o)=>{commits++;commitPayload={file:f.name,pc:p.id,bind:o.bindTemplate,map:o.identityCombatMap};return true;};await pcDndExportCheckOpen(file,pc,{identityCombatMap:safeMap});await new Promise(r=>setTimeout(r,20));const safeText=document.getElementById('pcDndExportCheckBody').textContent,safeConfirm=document.querySelector('[data-pc-dnd-export-check-confirm]'),beforeConfirm=commits;await pcDndExportCheckConfirm();const afterConfirm=commits;pcExportDndTemplateWorkbook=originalCommit;
 await pcDndExportCheckOpen(file,pc,{bindTemplate:true});const bindLabel=document.querySelector('[data-pc-dnd-export-check-confirm]').textContent,bindMapHidden=document.querySelector('[data-pc-dnd-export-check-map]').hidden;pcDndExportCheckClose();
 const pcOnly=makeBlankPc(selfProfileId());pcOnly.id='round282-only';pcOnly.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const od=pcRuleEditableData(pcOnly);od.traits.forEach(row=>row.value='');const bg=od.resources.find(x=>x.label==='背景');bg.value='仅身份写入';const identityOnly=await pcBuildDndTemplateWorkbook(file,pcOnly,{identityCombatMap:{version:2,layoutId:'layout-21',refs:{背景:'D5'},extras:[]}}),read=await pcExcelReadXlsx(await identityOnly.blob.arrayBuffer()),identityOnlyValue=String(pcInsaneSheetCell(read[0],'D5')??'');
 return {badAudit,safeAudit,protectedAudit,modalState,blockedUi,noSecrets,noOverflow,touch,safeText,beforeConfirm,afterConfirm,commitPayload,bindLabel,bindMapHidden,identityOnlyValue};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1100},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: audit counts six abilities fixed fields skills resources and one blocked formula',r['badAudit']['abilities']['ready']==6 and r['badAudit']['fixed']['mapped']==7 and r['badAudit']['fixed']['exportable']==7 and r['badAudit']['skills']['exportable']==1 and r['badAudit']['skills']['total']==2 and r['badAudit']['resources']['exportable']==1 and len(r['badAudit']['blockers'])==1)
   record(f'{width}: dangerous protected fixed target is caught before export',any('已保护' in x['text'] for x in r['protectedAudit']['blockers']))
   record(f'{width}: blocked audit disables confirmation and lists the actual mapping problem',r['blockedUi'] and not r['badAudit']['canExport'])
   record(f'{width}: export preflight is top modal and inerts the parent editor',r['modalState']['top']=='pcDndExportCheckBackdrop' and r['modalState']['editorInert'] and not r['modalState']['checkInert'])
   record(f'{width}: preflight never renders actual PC character values',r['noSecrets'])
   record(f'{width}: visible preflight controls retain 44px targets and no page overflow',r['touch'] and r['noOverflow'])
   record(f'{width}: safe audit reports complete fixed mapping and skill/resource coverage',r['safeAudit']['canExport'] and r['safeAudit']['fixed']['mapped']==7 and r['safeAudit']['skills']['exportable']==2 and r['safeAudit']['resources']['exportable']==1 and '六属性6/6'.replace(' ','') in r['safeText'].replace(' ',''))
   record(f'{width}: no export commit occurs before explicit confirmation',r['beforeConfirm']==0)
   record(f'{width}: explicit confirmation commits exactly once with the checked mapping',r['afterConfirm']==1 and r['commitPayload']['pc']=='round282' and not r['commitPayload']['bind'] and r['commitPayload']['map']['extras'][1]['ref']=='F32')
   record(f'{width}: first-time template setup uses the same preflight with bind wording',r['bindLabel']=='确认生成并设置模板' and r['bindMapHidden'])
   record(f'{width}: workbook export can write identity fields even when six abilities are blank',r['identityOnlyValue']=='仅身份写入')
   page.screenshot(path=str(out/f'round282-dnd-export-preflight-{width}.png'),full_page=False);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D final export preflight; synthetic workbook and fictional values only'}
(out/'round282-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND282',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
