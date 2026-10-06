#!/usr/bin/env python3
"""Synthetic D&D XLSX browser round-trip and eight-width export-menu check.
No user workbook or permanent native storage is opened."""
from pathlib import Path
import json,os,re,base64
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
  page=browser.new_page(viewport={'width':375,'height':900},service_workers='block')
  page.set_content(html,wait_until='domcontentloaded',timeout=90000)
  for edition in ['5e-2014','5e-2024']:
   data=page.evaluate('''async edition=>{
     const pc=makeBlankPc(selfProfileId());pc.id='round242-fiction';pc.name='合成值<&>测试';
     pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:edition,confirmed:true,source:'user-selected'};
     pc.futurePrivate={secret:'DO_NOT_EXPORT_SYNTHETIC'};
     const rows=pcRuleEditableData(pc);rows.traits[0].value='15';
     rows.skills.push({label:'合成检定',value:'=2+3',detail:'保留+号和引号"'});
     rows.resources.find(x=>x.label==='等级').value='4';
     rows.resources.find(x=>x.label==='生命值').value='024';
     rows.resources.find(x=>x.label==='种族／物种').value='FictionalSpecies_测试';
     const before=JSON.stringify(pc),build=await pcBuildDndRuleWorkbook(pc),raw=await build.blob.arrayBuffer();
     const parsed=await pcExcelReadXlsx(raw),all=await pcExcelUnzip(raw),xml=new TextDecoder().decode(all['xl/worksheets/sheet1.xml']);
     const seen=parsed[0].rows.map(x=>x.join('|')).join('\\n');
     let download=null;const original=downloadBlobFile;downloadBlobFile=(b,n)=>{download={name:n,size:b.size};return true};
     const clicked=await pcExportDndRuleWorkbook(pc);downloadBlobFile=original;
     const response={edition,immutable:before===JSON.stringify(pc),scope:parsed.length===1&&parsed[0].name==='DND规则数据'&&seen.includes(edition.slice(3)),
       values:['15','=2+3','4','024','FictionalSpecies_测试'].every(v=>seen.includes(v)),
       notes:seen.includes('保留+号和引号"'),blank:!seen.includes('背景|'),
       privacy:!seen.includes('DO_NOT_EXPORT_SYNTHETIC')&&!xml.includes('DO_NOT_EXPORT_SYNTHETIC'),
       textCell:xml.includes('=2+3')&&!xml.includes('<f>'),
       zipParts:['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'].every(n=>!!all[n]),
       legacyDiagnosticExport:clicked===true&&download?.name.includes(edition.slice(3))&&download.name.endsWith('.xlsx')&&download.size>1500,
       rows:parsed[0].rows.length,bytes:build.blob.size};
     const verified=await pcDndVerifyStandaloneFile(new File([raw],'fiction.xlsx'),pc);
     response.readonlyVerify=verified.exact&&verified.matching===build.count&&verified.changed===0;
     const altered=pcExcelReadXlsx(raw).then(parts=>{const rows=parts[0].rows;rows[6][2]='different';return pcDndCompareStandaloneRows(parts,pc)});
     response.readonlyDetectsChange=(await altered).changed===1;
     // Real app JS readback: cosmetic worksheet sorting must not look like data loss.
     const reordered=await pcExcelReadXlsx(raw);const content=reordered[0].rows.splice(6).reverse();reordered[0].rows.push(...content);
     const resorted=pcDndCompareStandaloneRows(reordered,pc);
     response.readonlySortInvariant=resorted.exact&&resorted.changed===0;
     const editedSorted=await pcExcelReadXlsx(raw);editedSorted[0].rows[6][2]='changed';editedSorted[0].rows.splice(6).reverse().forEach(row=>editedSorted[0].rows.push(row));
     response.readonlySortStillDetectsEdit=pcDndCompareStandaloneRows(editedSorted,pc).changed===1;
     // ZIP contents can be valid while worksheet coordinates are duplicated or
     // shifted. Such files must never receive a misleading read-only match.
     const tamper=async changed=>{
       const entries=Object.entries(all).map(([name,data])=>({name,data:name==='xl/worksheets/sheet1.xml'?new TextEncoder().encode(changed):data}));
       const broken=await pcMakeExcelZipEntries(entries);
       try{await pcDndVerifyStandaloneFile(new File([broken],'altered.xlsx'),pc);return false}
       catch(e){return /单元格坐标|行号不连续/.test(String(e?.message||e));}
     };
     response.rejectDuplicateCell=await tamper(xml.replace('<c r="B7"','<c r="A7"'));
     response.rejectShiftedRow=await tamper(xml.replace('<row r="7"','<row r="8"'));
     // Simulate a normal Excel/WPS re-save without relying on desktop software in CI:
     // move inline strings to sharedStrings and add standard document properties.
     const safeOfficeResave=async()=>{
       const entries={...all},parser=new DOMParser(),serializer=new XMLSerializer(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
       const doc=parser.parseFromString(new TextDecoder().decode(entries['xl/worksheets/sheet1.xml']),'application/xml');
       const strings=[];
       for(const cell of [...doc.getElementsByTagNameNS('*','c')]){
         const inline=cell.getElementsByTagNameNS('*','is')[0];if(!inline)continue;
         const value=inline.textContent||'';if(value==='')continue;
         const idx=strings.length;strings.push(value);cell.setAttribute('t','s');cell.removeChild(inline);
         const v=doc.createElementNS(ns,'v');v.textContent=String(idx);cell.appendChild(v);
       }
       // Real Office/WPS often drops physically empty cells on save. Keep the
       // logical value blank but remove the XML node to exercise sparse A-D rows.
       for(const cell of [...doc.getElementsByTagNameNS('*','c')]){
         const inline=cell.getElementsByTagNameNS('*','is')[0];
         if(inline&&(inline.textContent||'')==='')cell.parentNode.removeChild(cell);
       }
       entries['xl/worksheets/sheet1.xml']=new TextEncoder().encode(serializer.serializeToString(doc));
       entries['xl/sharedStrings.xml']=new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="'+ns+'" count="'+strings.length+'" uniqueCount="'+strings.length+'">'+strings.map(x=>'<si><t xml:space="preserve">'+pcExcelXmlEscape(x)+'</t></si>').join('')+'</sst>');
       entries['docProps/core.xml']=new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>');
       entries['docProps/app.xml']=new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>');
       const relText=new TextDecoder().decode(entries['xl/_rels/workbook.xml.rels']).replace('</Relationships>','<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
       entries['xl/_rels/workbook.xml.rels']=new TextEncoder().encode(relText);
       const rootRels=new TextDecoder().decode(entries['_rels/.rels']).replace('</Relationships>','<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
       entries['_rels/.rels']=new TextEncoder().encode(rootRels);
       const types=new TextDecoder().decode(entries['[Content_Types].xml']).replace('</Types>','<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
       entries['[Content_Types].xml']=new TextEncoder().encode(types);
       return pcMakeExcelZipEntries(Object.entries(entries).map(([name,data])=>({name,data})));
     };
     const officeBlob=await safeOfficeResave();
     const officeResult=await pcDndVerifyStandaloneFile(new File([officeBlob],'office-resaved.xlsx'),pc);
     response.safeOfficeResave=officeResult.exact&&officeResult.changed===0&&officeResult.officeNormalized===true;
     response.safeOfficeSparseBlankCells=new TextDecoder().decode((await pcExcelUnzip(await officeBlob.arrayBuffer()))['xl/worksheets/sheet1.xml']).split('<c ').length-1 < xml.split('<c ').length-1;
     if(edition==='5e-2024'){let officeBytes=new Uint8Array(await officeBlob.arrayBuffer()),officeStr='';for(let i=0;i<officeBytes.length;i+=8192)officeStr+=String.fromCharCode(...officeBytes.slice(i,i+8192));response.officeB64=btoa(officeStr)}
     const officeParts=await pcExcelUnzip(await officeBlob.arrayBuffer());
     response.safeSharedStrings=!!officeParts['xl/sharedStrings.xml']&&new TextDecoder().decode(officeParts['xl/worksheets/sheet1.xml']).includes('t="s"');
     const rejectExtra=async(name,data)=>{const items={...all,[name]:new TextEncoder().encode(data)};const blob=await pcMakeExcelZipEntries(Object.entries(items).map(([name,data])=>({name,data})));try{await pcDndVerifyStandaloneFile(new File([blob],'unsafe.xlsx'),pc);return false}catch(e){return /暂不支持|宏|附件|工作表/.test(String(e?.message||e));}};
     response.rejectMacroPart=await rejectExtra('xl/vbaProject.bin','fictional');
     response.rejectExtraSheetPart=await rejectExtra('xl/worksheets/sheet2.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>');

     if(edition==='5e-2024'){let bytes=new Uint8Array(raw),str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.slice(i,i+8192));response.fictionB64=btoa(str)}
     return response;
   }''',edition)
   if edition=='5e-2024':
    sample=out/'round242-fiction-workbook.xlsx';sample.write_bytes(base64.b64decode(data.pop('fictionB64')))
    office=out/'round253-fiction-office-resaved.xlsx';office.write_bytes(base64.b64decode(data.pop('officeB64')))
   for key,value in data.items():
    if key in ('edition','rows','bytes'):continue
    record(f'{edition}:{key}',value)
  # Actual menu across the standard responsive breakpoints. Stage93+ has two legitimate D&D states:
  # no saved template => explicit setup action; matching saved template => direct export action.
  page.evaluate('''()=>{localStorage.setItem(ONBOARDING_KEY,'1');const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert');window.__round242Workbook=null;pcWorkbookGet=async id=>window.__round242Workbook&&String(window.__round242Workbook.pcId)===String(id)?window.__round242Workbook:null;const pc=makeBlankPc(selfProfileId());pc.id='round242-ui';pc.name='合成导出角色';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};pcs.push(pc);openPcEditor(pc.id);}''')
  page.wait_for_timeout(80)
  for width in [320,375,390,430,768,1024,1280,1440]:
   page.set_viewport_size({'width':width,'height':900})
   page.evaluate('''()=>{const more=document.querySelector('.pc-foot-more-v72');if(more)more.open=true;const menu=document.querySelector('.pc-footer-export-menu');if(menu)menu.open=true;}''')
   geom=page.evaluate('''()=>{const b=document.querySelector('#pcFooterExportExcelBtn'),e=b.getBoundingClientRect();return {setup:b.dataset.pcDndTemplateState==='missing'&&b.dataset.pcExcelExportState==='ready'&&!b.disabled&&b.textContent.includes('设置 D&D 角色卡模板'),width:e.width,height:e.height,left:e.left,right:e.right,overflow:document.documentElement.scrollWidth-innerWidth}}''')
   record(f'{width}:template-setup-ready',geom['setup'])
   record(f'{width}:export-button-readable',geom['width']>80 and geom['height']>=40 and geom['left']>=-2 and geom['right']<=width+2 and geom['overflow']<=3)
   verify=page.evaluate('''()=>{const b=document.getElementById('pcFooterVerifyDndXlsxBtn'),r=b.getBoundingClientRect();return {hidden:b.hidden,width:r.width,height:r.height}}''')
   record(f'{width}:legacy-verify-hidden',verify['hidden'] and verify['width']==0 and verify['height']==0)
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round242-setup-{width}.png'),full_page=False)
  # Simulate the per-PC saved attachment metadata only; no user workbook is used.
  page.evaluate('''async()=>{window.__round242Workbook={pcId:'round242-ui',blob:new Blob(['fictional-template']),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'2024',layoutId:'fictional'};syncPcExcelExportUi(pcDraft);await new Promise(r=>setTimeout(r,80));}''')
  for width in [320,375,390,430,768,1024,1280,1440]:
   page.set_viewport_size({'width':width,'height':900})
   page.evaluate('''()=>{const more=document.querySelector('.pc-foot-more-v72');if(more)more.open=true;const menu=document.querySelector('.pc-footer-export-menu');if(menu)menu.open=true;}''')
   geom=page.evaluate('''()=>{const b=document.querySelector('#pcFooterExportExcelBtn'),e=b.getBoundingClientRect();return {ready:b.dataset.pcDndTemplateState==='saved'&&b.dataset.pcExcelExportState==='ready'&&!b.disabled&&b.textContent.includes('导出 D&D 角色 Excel 卡'),width:e.width,height:e.height,left:e.left,right:e.right,overflow:document.documentElement.scrollWidth-innerWidth}}''')
   record(f'{width}:saved-template-export-ready',geom['ready'])
   record(f'{width}:saved-export-readable',geom['width']>80 and geom['height']>=40 and geom['left']>=-2 and geom['right']<=width+2 and geom['overflow']<=3)
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round242-saved-{width}.png'),full_page=False)
  # Standalone XLSX remains an internal compatibility path; it is no longer exposed as the primary D&D export UI.
  record('standalone:legacy-verifier-hidden',page.evaluate("()=>document.getElementById('pcFooterVerifyDndXlsxBtn').hidden===true"))
  hidden=page.evaluate('''()=>{const old=pcDraft.ruleMeta;pcDraft.ruleMeta={familyId:'brp',systemId:'coc',editionId:'7e',confirmed:true};syncPcExcelExportUi(pcDraft);const b=document.getElementById('pcFooterVerifyDndXlsxBtn');const r=b.getBoundingClientRect(),hidden=b.hidden;pcDraft.ruleMeta=old;syncPcExcelExportUi(pcDraft);return {hidden,width:r.width,height:r.height}}''')
  record('non-dnd:readonly-verify-hidden',hidden['hidden'] and hidden['width']==0 and hidden['height']==0)
  page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(r['pass'] for r in checks),'failures':[r for r in checks if not r['pass']],'mode':'synthetic full-app JS + actual XLSX ZIP/OOXML read-back; isolated browser, no native IDB'}
(out/'round242-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND242',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:print(report['failures']);raise SystemExit(1)
