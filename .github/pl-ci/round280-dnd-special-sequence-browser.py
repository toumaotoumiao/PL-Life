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
  else if(index===2){for(const ref of ['K40','K42','K44']){const m=ref.match(/([A-Z]+)(\d+)/);put(Number(m[2]),ref);}}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round280';pc.name='特殊坐标辅助';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(let i=1;i<=6;i++)rd.skills.push({label:`蛇形${String(i).padStart(2,'0')}`,value:`+${i}`});for(let i=1;i<=4;i++)rd.resources.push({label:`资源${String(i).padStart(2,'0')}`,value:`R${i}`});
 const saved={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-special.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]},updatedAt:Date.now()};pcWorkbookGet=async()=>saved;settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();
 const body=document.getElementById('pcDndMapBody'),rows=[...body.querySelectorAll('[data-pc-dnd-extra-row]')],search=body.querySelector('[data-pc-dnd-extra-search]'),group=body.querySelector('[data-pc-dnd-extra-group-filter]'),mode=body.querySelector('[data-pc-dnd-seq-mode]'),groupSize=body.querySelector('[data-pc-dnd-seq-group]'),cross=body.querySelector('[data-pc-dnd-seq-cross]'),step=body.querySelector('[data-pc-dnd-seq-step]'),start=body.querySelector('[data-pc-dnd-seq-start]'),sheet=body.querySelector('[data-pc-dnd-seq-sheet]'),blocks=body.querySelector('[data-pc-dnd-seq-blocks]'),blockWrap=body.querySelector('[data-pc-dnd-seq-block-wrap]'),fromFirst=body.querySelector('[data-pc-dnd-seq-from-first]');
 search.value='蛇形';search.dispatchEvent(new Event('input',{bubbles:true}));body.querySelector('[data-pc-dnd-extra-select-visible]').click();const skillRows=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked);sheet.value='1';start.value='D60';mode.value='snake-columns';mode.dispatchEvent(new Event('change',{bubbles:true}));step.value='2';groupSize.value='3';cross.value='3';const snakeEnabled=!groupSize.disabled&&!cross.disabled&&blockWrap.hidden;const pendingBefore=pcWorkbookPending;body.querySelector('[data-pc-dnd-seq-apply]').click();const snakeRefs=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),snakeStates=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim());
 const pureSnake=[0,1,2,3,4,5].map(i=>pcDndSequenceCandidate({col:4,row:60},i,'snake-columns',2,3,3,6));const partialSnake=[0,1,2,3,4].map(i=>pcDndSequenceCandidate({col:4,row:60},i,'snake-columns',2,3,3,5));
 // Multi-block: reuse the six visible skill rows, deliberately overriding the snake candidates.
 body.querySelector('[data-pc-dnd-seq-empty]').checked=false;mode.value='blocks-down';mode.dispatchEvent(new Event('change',{bubbles:true}));blocks.value='2!D60*3\n3!K40*3';step.value='2';const blockUi=!blockWrap.hidden&&blocks.disabled===false&&sheet.disabled&&start.disabled&&fromFirst.disabled;body.querySelector('[data-pc-dnd-seq-apply]').click();const blockRefs=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),blockSheets=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-sheet]').value),blockStates=skillRows.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim());let mismatchRejected=false;try{pcDndSequenceBlocksParse('2!D60*2',21,6);}catch(e){mismatchRejected=String(e?.message||e).includes('区块项数合计');}
 // Snake-row pure order covers the alternate direction variant without changing saved mapping.
 const snakeRows=[0,1,2,3].map(i=>pcDndSequenceCandidate({col:5,row:70},i,'snake-rows',3,2,2,4));
 const controls=[...body.querySelectorAll('.pc-dnd-map-seq select,.pc-dnd-map-seq input[type="text"],.pc-dnd-map-seq input[type="number"],.pc-dnd-map-seq textarea,.pc-dnd-map-seq button')].filter(x=>x.offsetParent!==null&&!x.disabled);return {snakeEnabled,skillCount:skillRows.length,snakeRefs,snakeStates,pureSnake,partialSnake,blockUi,blockRefs,blockSheets,blockStates,mismatchRejected,snakeRows,noAutoSave:pendingBefore===pcWorkbookPending,touch:controls.every(x=>x.getBoundingClientRect().height>=44),overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: snake mode enables grid controls and hides block editor',r['snakeEnabled'])
   record(f'{width}: snake mode targets six selected skills',r['skillCount']==6)
   record(f'{width}: snake columns reverse the second column',r['snakeRefs']==['D60','D62','D64','G64','G62','G60'])
   record(f'{width}: formula target remains blocked inside snake candidates',r['snakeStates']==['已核对','已核对','已核对','已核对','公式格','已核对'])
   record(f'{width}: pure snake generator matches full and partial final bands',r['pureSnake']==['D60','D62','D64','G64','G62','G60'] and r['partialSnake']==['D60','D62','D64','G62','G60'])
   record(f'{width}: multi-block mode shows explicit block starts and disables single-start controls',r['blockUi'])
   record(f'{width}: multi-block mode jumps to independent starts',r['blockRefs']==['D60','D62','D64','K40','K42','K44'])
   record(f'{width}: multi-block mode can change worksheets between blocks',r['blockSheets']==['1','1','1','2','2','2'])
   record(f'{width}: explicit block candidates still pass normal cell validation',r['blockStates']==['已核对']*6)
   record(f'{width}: block item-count mismatch is rejected before generation',r['mismatchRejected'])
   record(f'{width}: snake rows reverse the second row',r['snakeRows']==['E70','H70','H72','E72'])
   record(f'{width}: special candidate generation never auto-saves',r['noAutoSave'])
   record(f'{width}: visible special-layout controls keep 44px targets and no overflow',r['touch'] and r['overflow'])
   page.screenshot(path=str(out/f'round280-dnd-special-sequence-{width}.png'),full_page=False);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D snake and explicit multi-block coordinate candidates; synthetic workbook and fictional PC only'}
(out/'round280-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND280',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
