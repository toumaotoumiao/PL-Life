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
 const rowsXml=spec=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{const spec={};const put=(row,ref,value=null,kind='inline')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind));
  if(index===0){put(5,'B5','背景');put(5,'D5');put(8,'B8','种族');put(8,'D8');put(8,'K8','阵营');put(8,'M8');}
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}put(30,'D30');put(30,'F30');put(30,'H30');put(30,'J30');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round281';pc.name='复核测试';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(const [label,value] of Object.entries({'背景':'PRIVATE_BG_90817','等级':'9','熟练加值':'+4','生命值':'52'})){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}rd.skills.push({label:'察觉',value:'PRIVATE_SKILL_87123'},{label:'隐匿',value:'+4'});rd.resources.push({label:'长剑',value:'PRIVATE_SWORD_76123'});
 const saved={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-review.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]},updatedAt:Date.now()};pcWorkbookGet=async()=>saved;settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();const body=document.getElementById('pcDndMapBody');
 body.querySelector('[data-pc-dnd-map-batch-toggle]').click();body.querySelector('[data-pc-dnd-map-batch-text]').value='背景=D5\n种族=D8\n阵营=M8\n等级=Y3\n熟练=R3\n先攻=D27\n生命值=AH27\n技能:察觉=2!D30\n技能:隐匿=2!F30\n装备:长剑=2!H30';pcDndMapApplyBatch();
 const stealth=body.querySelector(`[data-pc-dnd-extra-key="${CSS.escape(pcDndExtendedLabelKey('skills','隐匿'))}"]`);stealth.querySelector('[data-pc-dnd-extra-ref]').value='F12';pcDndMapRefresh();
 const modalFocus={mapInert:document.getElementById('pcDndMapBackdrop').inert,editorInert:document.getElementById('pcEditorBackdrop').inert,top:visibleDialog()?.closest?.('#pcDndMapBackdrop')?.id||visibleDialog()?.closest?.('.pc-manage-backdrop')?.id||''};const pendingBefore=pcWorkbookPending;body.querySelector('[data-pc-dnd-review-toggle]').click();let panel=body.querySelector('[data-pc-dnd-review]'),summary=panel.querySelector('[data-pc-dnd-review-summary]').textContent.trim(),panelText=panel.textContent;
 const filter=panel.querySelector('[data-pc-dnd-review-filter]');filter.value='pending';filter.dispatchEvent(new Event('change',{bubbles:true}));let pendingRows=[...panel.querySelectorAll('[data-pc-dnd-review-row]')];const pendingOne=pendingRows.length===1&&pendingRows[0].textContent.includes('隐匿')&&(pendingRows[0].textContent.includes('公式格')||pendingRows[0].textContent.includes('已保护区域'));
 filter.value='exportable';filter.dispatchEvent(new Event('change',{bubbles:true}));const exportRows=[...panel.querySelectorAll('[data-pc-dnd-review-row]')],exportCount=exportRows.length;panel.querySelector('[data-pc-dnd-review-mark-visible]').click();let reviewedAfterExport=[...pcDndMapSession.reviewed.keys()].length;
 filter.value='unreviewed';filter.dispatchEvent(new Event('change',{bubbles:true}));const unreviewedCount=panel.querySelectorAll('[data-pc-dnd-review-row]').length;
 filter.value='valid';filter.dispatchEvent(new Event('change',{bubbles:true}));panel.querySelector('[data-pc-dnd-review-mark-visible]').click();const reviewedAll=pcDndMapSession.reviewed.size;summary=panel.querySelector('[data-pc-dnd-review-summary]').textContent.trim();
 const perception=body.querySelector(`[data-pc-dnd-extra-key="${CSS.escape(pcDndExtendedLabelKey('skills','察觉'))}"]`),perceptionInput=perception.querySelector('[data-pc-dnd-extra-ref]');perceptionInput.value='J30';perceptionInput.dispatchEvent(new Event('input',{bubbles:true}));const reviewedAfterEdit=pcDndMapReviewItems().filter(x=>x.reviewed).length;
 filter.value='all';filter.dispatchEvent(new Event('change',{bubbles:true}));const pkey=`extra:${pcDndExtendedLabelKey('skills','察觉')}`,locate=panel.querySelector(`[data-pc-dnd-review-locate="${CSS.escape(pkey)}"]`);locate.click();await new Promise(resolve=>setTimeout(resolve,10));const located=document.activeElement===perceptionInput;
 const controls=[...panel.querySelectorAll('select,button')].filter(x=>x.offsetParent!==null&&!x.disabled);const touch=controls.every(x=>x.getBoundingClientRect().height>=44),overflow=document.documentElement.scrollWidth<=innerWidth+2,noSecrets=!panelText.includes('PRIVATE_BG_90817')&&!panelText.includes('PRIVATE_SKILL_87123')&&!panelText.includes('PRIVATE_SWORD_76123'),noAutoSave=pendingBefore===pcWorkbookPending;
 const beforeClose=pcDndMapSession.reviewed.size;pcDndMapClose();await pcDndMapOpen();const reset=beforeClose>0&&pcDndMapSession.reviewed.size===0;
 return {modalFocus,summary,pendingOne,exportCount,reviewedAfterExport,unreviewedCount,reviewedAll,reviewedAfterEdit,located,touch,overflow,noSecrets,noAutoSave,reset};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1100},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: D&D mapping submodal owns focus and inerts the parent PC editor',not r['modalFocus']['mapInert'] and r['modalFocus']['editorInert'] and r['modalFocus']['top']=='pcDndMapBackdrop')
   record(f'{width}: review summary combines fixed and enabled extended mappings',r['summary'].startswith('共 10 项') and '已核对 9' in r['summary'] and '已复核 9/9' in r['summary'] and '待处理 1' in r['summary'] and '本次可导出 6' in r['summary'])
   record(f'{width}: pending filter isolates the formula-cell exception',r['pendingOne'])
   record(f'{width}: exportable filter only lists fields that will be written',r['exportCount']==6)
   record(f'{width}: bulk review marks only current valid filtered items',r['reviewedAfterExport']==6 and r['unreviewedCount']==3)
   record(f'{width}: valid filter can finish review without accepting blocked rows',r['reviewedAll']==9)
   record(f'{width}: coordinate edits invalidate the prior review fingerprint',r['reviewedAfterEdit']==8)
   record(f'{width}: locate action focuses the original mapping coordinate input',r['located'])
   record(f'{width}: review panel never renders actual PC field values',r['noSecrets'])
   record(f'{width}: review state stays session-only and never auto-saves',r['noAutoSave'] and r['reset'])
   record(f'{width}: visible review controls keep 44px targets and no page overflow',r['touch'] and r['overflow'])
   page.screenshot(path=str(out/f'round281-dnd-map-review-{width}.png'),full_page=False);page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D mapping review console; synthetic workbook and fictional PC only'}
(out/'round281-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND281',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
