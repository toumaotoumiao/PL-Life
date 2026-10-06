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
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}for(const ref of ['D60','D62','D64','G60','G64','E70','H70','E72','H72']){const m=ref.match(/([A-Z]+)(\d+)/);put(Number(m[2]),ref);}put(62,'G62','1+1','formula');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round279';pc.name='二维坐标辅助';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(let i=1;i<=6;i++)rd.skills.push({label:`网格${String(i).padStart(2,'0')}`,value:`+${i}`});for(let i=1;i<=4;i++)rd.resources.push({label:`资源${String(i).padStart(2,'0')}`,value:`R${i}`});
 const row={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-grid.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]},updatedAt:Date.now()};pcWorkbookGet=async()=>row;settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();const body=document.getElementById('pcDndMapBody'),rows=[...body.querySelectorAll('[data-pc-dnd-extra-row]')],search=body.querySelector('[data-pc-dnd-extra-search]'),group=body.querySelector('[data-pc-dnd-extra-group-filter]'),mode=body.querySelector('[data-pc-dnd-seq-mode]'),groupSize=body.querySelector('[data-pc-dnd-seq-group]'),cross=body.querySelector('[data-pc-dnd-seq-cross]');
 const directDisabled=groupSize.disabled&&cross.disabled;
 search.value='网格';search.dispatchEvent(new Event('input',{bubbles:true}));body.querySelector('[data-pc-dnd-extra-select-visible]').click();const skillRows=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked);skillRows[0].querySelector('[data-pc-dnd-extra-sheet]').value='1';skillRows[0].querySelector('[data-pc-dnd-extra-ref]').value='D60';pcDndMapRefresh();body.querySelector('[data-pc-dnd-seq-sheet]').value='1';body.querySelector('[data-pc-dnd-seq-start]').value='D60';mode.value='columns';mode.dispatchEvent(new Event('change',{bubbles:true}));body.querySelector('[data-pc-dnd-seq-step]').value='2';groupSize.value='3';cross.value='3';const gridEnabled=!groupSize.disabled&&!cross.disabled,pendingBefore=pcWorkbookPending;body.querySelector('[data-pc-dnd-seq-apply]').click();const colRefs=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),colStates=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim()),noAutoSave=pendingBefore===pcWorkbookPending;
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));group.value='resources';group.dispatchEvent(new Event('change',{bubbles:true}));body.querySelector('[data-pc-dnd-extra-select-visible]').click();const resourceRows=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked);body.querySelector('[data-pc-dnd-seq-start]').value='E70';mode.value='rows';mode.dispatchEvent(new Event('change',{bubbles:true}));body.querySelector('[data-pc-dnd-seq-step]').value='3';groupSize.value='2';cross.value='2';body.querySelector('[data-pc-dnd-seq-apply]').click();const rowRefs=resourceRows.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),rowStates=resourceRows.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim());
 const pureCols=[0,1,2,3,4,5].map(i=>pcDndSequenceCandidate({col:4,row:60},i,'columns',2,3,3));const pureRows=[0,1,2,3].map(i=>pcDndSequenceCandidate({col:5,row:70},i,'rows',3,2,2));const controls=[...body.querySelectorAll('.pc-dnd-map-seq select,.pc-dnd-map-seq input[type="text"],.pc-dnd-map-seq input[type="number"],.pc-dnd-map-seq button')].filter(x=>x.offsetParent!==null);return {directDisabled,gridEnabled,skillCount:skillRows.length,colRefs,colStates,rowRefs,rowStates,noAutoSave,pureCols,pureRows,touch:controls.every(x=>x.getBoundingClientRect().height>=44),overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: direct mode keeps two-dimensional-only controls disabled',r['directDisabled'])
   record(f'{width}: grid mode enables group size and cross-step controls',r['gridEnabled'])
   record(f'{width}: column-major mode targets six selected skills',r['skillCount']==6)
   record(f'{width}: column-major coordinates fill one column then move to the next',r['colRefs']==['D60','D62','D64','G60','G62','G64'])
   record(f'{width}: formula target remains blocked after two-dimensional generation',r['colStates']==['已核对','已核对','已核对','已核对','公式格','已核对'])
   record(f'{width}: row-major coordinates alternate across columns then move down',r['rowRefs']==['E70','H70','E72','H72'] and r['rowStates']==['已核对']*4)
   record(f'{width}: pure coordinate generator matches column-major order',r['pureCols']==['D60','D62','D64','G60','G62','G64'])
   record(f'{width}: pure coordinate generator matches row-major order',r['pureRows']==['E70','H70','E72','H72'])
   record(f'{width}: two-dimensional candidate generation never auto-saves',r['noAutoSave'])
   record(f'{width}: two-dimensional controls keep 44px targets and no page overflow',r['touch'] and r['overflow'])
   page.screenshot(path=str(out/f'round279-dnd-grid-sequence-{width}.png'),full_page=False);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D two-dimensional coordinate candidate helper; synthetic workbook and fictional PC only'}
(out/'round279-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND279',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
