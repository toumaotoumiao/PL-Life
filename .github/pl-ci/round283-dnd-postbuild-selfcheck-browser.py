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
def record(label,ok): checks.append({'test':label,'pass':bool(ok)})
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const cell=(ref,value,kind='inline',style='')=>value===null?`<c r="${ref}"${style?` s="${style}"`:''}/>`:(kind==='formula'?`<c r="${ref}"${style?` s="${style}"`:''}><f>${value}</f><v>2</v></c>`:`<c r="${ref}"${style?` s="${style}"`:''} t="inlineStr"><is><t>${pcExcelXmlEscape(String(value))}</t></is></c>`);
 const rowsXml=spec=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{const spec={};const put=(row,ref,value=null,kind='inline',style='')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind,style));
  if(index===0){put(5,'B5','背景');put(5,'D5',null,'inline','3');put(8,'B8','种族');put(8,'D8',null,'inline','3');put(8,'K8','阵营');put(8,'M8',null,'inline','3');}
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3',null,'inline','3');put(3,'W3','等级');put(3,'Y3',null,'inline','3');put(27,'B27','先攻');put(27,'D27',null,'inline','3');put(27,'AF27','生命值');put(27,'AH27',null,'inline','3');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i,'inline','5');}put(30,'D30',null,'inline','7');put(30,'J30','保持原值','inline','8');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData><mergeCells count="1"><mergeCell ref="A90:B90"/></mergeCells></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},{name:'xl/styles.xml',data:'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts></styleSheet>'},{name:'xl/media/image1.png',data:new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])},{name:'xl/drawings/drawing1.xml',data:'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>'},{name:'xl/worksheets/_rels/sheet2.xml.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDraw" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round283';pc.name='生成后自检';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));const bg=rd.resources.find(x=>x.label==='背景');if(bg)bg.value='侍从';rd.skills.push({label:'察觉',value:'+5'});
 const map={version:2,layoutId:'layout-21',refs:{'背景':'D5'},extras:[{group:'skills',label:'察觉',sheet:1,ref:'D30'}]};
 const file=new File([source],'fictional-stage111.xlsx',{type:PC_XLSX_MIME});const built=await pcBuildDndTemplateWorkbook(file,pc,{identityCombatMap:map});
 const sourceFiles=await pcExcelUnzip(await source.arrayBuffer()),outFiles=await pcExcelUnzip(await built.blob.arrayBuffer()),sourceSheets=await pcExcelReadXlsx(await source.arrayBuffer()),outSheets=await pcExcelReadXlsx(await built.blob.arrayBuffer());
 const ability=pcDndTemplateAbilityPlan(pc,sourceSheets,{allowEmpty:true}),identity=pcDndIdentityCombatPlan(pc,sourceSheets,ability.layoutId,map),sheetChanges=new Map([[1,new Map(ability.changes)]]);for(const [si,changes] of identity.changesBySheet){let target=sheetChanges.get(si);if(!target){target=new Map();sheetChanges.set(si,target);}for(const [ref,value] of changes)target.set(ref,value);}
 const direct=pcDndVerifyGeneratedWorkbook(sourceFiles,outFiles,sourceSheets,outSheets,sheetChanges);
 const preserved=['xl/styles.xml','xl/media/image1.png','xl/drawings/drawing1.xml','xl/worksheets/_rels/sheet2.xml.rels'].every(name=>pcDndBytesEqual(sourceFiles[name],outFiles[name]));
 const values={str:String(pcInsaneSheetCell(outSheets[1],'I12')??''),bg:String(pcInsaneSheetCell(outSheets[0],'D5')??''),skill:String(pcInsaneSheetCell(outSheets[1],'D30')??''),untouched:String(pcInsaneSheetCell(outSheets[1],'J30')??'')};
 let packageTamper=false;try{const bad={...outFiles,'xl/styles.xml':new TextEncoder().encode('<styleSheet tampered="1"/>')};pcDndVerifyGeneratedWorkbook(sourceFiles,bad,sourceSheets,outSheets,sheetChanges);}catch(e){packageTamper=/非目标部件/.test(String(e));}
 let sheetTamper=false;try{const bad={...outFiles},path=pcExcelWorkbookSheetPath(bad,'Sheet2'),xml=pcExcelDecodeXml(bad[path]);bad[path]=new TextEncoder().encode(pcExcelPatchCells(xml,new Map([['J30','被篡改']])));pcDndVerifyGeneratedWorkbook(sourceFiles,bad,sourceSheets,outSheets,sheetChanges);}catch(e){sheetTamper=/计划外结构或单元格变化/.test(String(e));}
 let valueTamper=false;const old=outSheets[1].rows[11][8];try{outSheets[1].rows[11][8]=99;pcDndVerifyGeneratedWorkbook(sourceFiles,outFiles,sourceSheets,outSheets,sheetChanges);}catch(e){valueTamper=/回读值不一致/.test(String(e));}finally{outSheets[1].rows[11][8]=old;}
 return {selfCheck:built.selfCheck,direct,preserved,values,packageTamper,sheetTamper,valueTamper,overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: build returns a successful post-build self-check',r['selfCheck']['verified'] and r['selfCheck']['plannedWrites']==8 and r['direct']['plannedWrites']==8)
   record(f'{width}: all planned ability/fixed/skill values re-read exactly',r['values']=={'str':'15','bg':'侍从','skill':'+5','untouched':'保持原值'})
   record(f'{width}: styles media drawings and worksheet relationships remain byte-identical',r['preserved'])
   record(f'{width}: modified sheets preserve non-target content',r['values']['untouched']=='保持原值')
   record(f'{width}: non-target package tamper is rejected',r['packageTamper'])
   record(f'{width}: unplanned cell mutation inside a modified sheet is rejected',r['sheetTamper'])
   record(f'{width}: planned-write readback mismatch is rejected',r['valueTamper'])
   record(f'{width}: post-build verification causes no page overflow',r['overflow'])
   page.screenshot(path=str(out/f'round283-dnd-postbuild-selfcheck-{width}.png'),full_page=True);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D post-build XLSX verification; fictional workbook only'}
(out/'round283-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND283',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
