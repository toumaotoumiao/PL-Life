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
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def record(label,ok):checks.append({'test':label,'pass':bool(ok)})
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  page=browser.new_page(viewport={'width':390,'height':900},service_workers='block')
  page.set_content(html,wait_until='domcontentloaded',timeout=90000)
  result=page.evaluate('''async()=>{
    const esc=pcExcelXmlEscape,ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const labels=['力量','敏捷','体质','智力','感知','魅力'],rows=[12,14,16,18,20,22];
    const sheetXml=i=>{
      if(i!==2)return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>保留页${i}</t></is></c></row></sheetData></worksheet>`;
      let body='';for(let x=0;x<6;x++){const r=rows[x];body+=`<row r="${r}"><c r="C${r}" t="inlineStr"><is><t>${labels[x]}</t></is></c><c r="F${r}"><f>1+1</f><v>2</v></c><c r="I${r}"><v>${8+x}</v></c></row>`}
      return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${body}</sheetData></worksheet>`;
    };
    const sheetTags=[],rels=[],parts=[];
    for(let i=1;i<=21;i++){sheetTags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i)});}
    const files=[
      {name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},
      {name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
      {name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags.join('')}</sheets></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},
      {name:'customXml/item1.xml',data:'<fictional>KEEP_ME</fictional>'},
      {name:'xl/media/image1.png',data:new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])},...parts];
    const source=await pcMakeExcelZipEntries(files),pc=makeBlankPc(selfProfileId());pc.id='round264';pc.name='合成DND模板回填';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};
    const rd=pcRuleEditableData(pc),values=[15,14,13,12,11,10];rd.traits.forEach((row,i)=>row.value=String(values[i]));rd.resources.find(x=>x.label==='等级').value='9';
    const built=await pcBuildDndTemplateWorkbook(new File([source],'template.xlsx'),pc),outParts=await pcExcelUnzip(await built.blob.arrayBuffer()),parsed=await pcExcelReadXlsx(await built.blob.arrayBuffer());
    const second=parsed[1],actual=PC_DND_STRUCTURE_LAYOUTS['layout-21'].candidateRefs.map(ref=>Number(pcInsaneSheetCell(second,ref)));
    const formulaRefs=second.rows.formulaRefs;
    const sourceParts=await pcExcelUnzip(await source.arrayBuffer());
    return {count:built.count===6,values:JSON.stringify(actual)===JSON.stringify(values),sheets:parsed.length===21,preserveCustom:new TextDecoder().decode(outParts['customXml/item1.xml'])==='<fictional>KEEP_ME</fictional>',preserveMedia:pcCrc32(outParts['xl/media/image1.png'])===pcCrc32(sourceParts['xl/media/image1.png']),preserveFormula:['F12','F14','F16','F18','F20','F22'].every(ref=>formulaRefs.has(ref)),route:pcExcelExportAvailability(pc).adapterId==='dnd-template'};
  }''')
  for k,v in result.items():record(k,v)
  # UI uses the real character-card label and legacy standalone verifier is hidden.
  page.evaluate('''()=>{localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');const pc=makeBlankPc(selfProfileId());pc.id='round264-ui';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};pcs.push(pc);openPcEditor(pc.id);document.querySelector('.pc-foot-more-v72').open=true;document.querySelector('.pc-footer-export-menu').open=true;}''')
  ui=page.evaluate('''()=>{const b=document.getElementById('pcFooterExportExcelBtn'),v=document.getElementById('pcFooterVerifyDndXlsxBtn'),i=document.getElementById('pcFooterDndTemplateInput');return {label:b.textContent==='设置 D&D 角色卡模板',ready:!b.disabled&&b.dataset.pcExcelExportState==='ready',legacy:v.hidden===true,input:i&&i.type==='file'}}''')
  for k,v in ui.items():record('ui:'+k,v)
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'synthetic D&D 21-sheet OOXML template fill; no user workbook'}
(out/'round264-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND264',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:print(report['failures']);raise SystemExit(1)
