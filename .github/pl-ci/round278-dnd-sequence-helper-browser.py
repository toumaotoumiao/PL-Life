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
 const cell=(ref,value,kind='inline')=>value===null?`<c r="${ref}"/>`:(kind==='formula'?`<c r="${ref}"><f>${value}</f><v>2</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${pcExcelXmlEscape(String(value))}</t></is></c>`);
 const rowsXml=spec=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{const spec={};const put=(row,ref,value=null,kind='inline')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind));
  if(index===0){put(5,'B5','背景');put(5,'D5');put(8,'B8','种族');put(8,'D8');put(8,'K8','阵营');put(8,'M8');}
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}put(40,'D40');put(42,'D42');put(44,'D44','1+1','formula');put(44,'F44');put(46,'D46');put(48,'F48');put(50,'E50');put(50,'G50');put(50,'I50');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round278';pc.name='连续坐标辅助';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(let i=1;i<=5;i++)rd.skills.push({label:`连续${String(i).padStart(2,'0')}`,value:`+${i}`});rd.skills.push({label:'其他技能',value:'+9'});rd.resources.push({label:'资源甲',value:'A'},{label:'资源乙',value:'B'},{label:'资源丙',value:'C'});
 const row={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-sequence.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]},updatedAt:Date.now()};pcWorkbookGet=async()=>row;settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();const body=document.getElementById('pcDndMapBody'),rows=[...body.querySelectorAll('[data-pc-dnd-extra-row]')],search=body.querySelector('[data-pc-dnd-extra-search]'),group=body.querySelector('[data-pc-dnd-extra-group-filter]');
 search.value='连续';search.dispatchEvent(new Event('input',{bubbles:true}));body.querySelector('[data-pc-dnd-extra-select-visible]').click();const visibleSelected=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked),hiddenOther=rows.find(r=>r.dataset.pcDndExtraLabel==='其他技能');
 const first=visibleSelected[0];first.querySelector('[data-pc-dnd-extra-sheet]').value='1';first.querySelector('[data-pc-dnd-extra-ref]').value='D40';pcDndMapRefresh();body.querySelector('[data-pc-dnd-seq-from-first]').click();const start=body.querySelector('[data-pc-dnd-seq-start]').value,sheet=body.querySelector('[data-pc-dnd-seq-sheet]').value;body.querySelector('[data-pc-dnd-seq-step]').value='2';const pendingBefore=pcWorkbookPending;body.querySelector('[data-pc-dnd-seq-apply]').click();
 const skillRefs=visibleSelected.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),skillStates=visibleSelected.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim()),seqStatus=body.querySelector('[data-pc-dnd-seq-status]').textContent.trim(),pendingAfter=pcWorkbookPending;
 visibleSelected[2].querySelector('[data-pc-dnd-extra-ref]').value='F44';visibleSelected[4].querySelector('[data-pc-dnd-extra-ref]').value='F48';pcDndMapRefresh();const fixedStates=visibleSelected.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim());
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));group.value='resources';group.dispatchEvent(new Event('change',{bubbles:true}));body.querySelector('[data-pc-dnd-extra-select-visible]').click();const resources=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked);body.querySelector('[data-pc-dnd-seq-sheet]').value='1';body.querySelector('[data-pc-dnd-seq-start]').value='E50';body.querySelector('[data-pc-dnd-seq-mode]').value='right';body.querySelector('[data-pc-dnd-seq-mode]').dispatchEvent(new Event('change',{bubbles:true}));body.querySelector('[data-pc-dnd-seq-step]').value='2';body.querySelector('[data-pc-dnd-seq-apply]').click();const resourceRefs=resources.map(r=>r.querySelector('[data-pc-dnd-extra-ref]').value),resourceStates=resources.map(r=>r.querySelector('[data-pc-dnd-extra-state]').textContent.trim());
 const controls=[...body.querySelectorAll('.pc-dnd-map-seq select,.pc-dnd-map-seq input[type="text"],.pc-dnd-map-seq input[type="number"],.pc-dnd-map-seq button')].filter(x=>x.offsetParent!==null);return {visibleSelected:visibleSelected.length,hiddenOtherChecked:hiddenOther.querySelector('[data-pc-dnd-extra-enable]').checked,start,sheet,skillRefs,skillStates,seqStatus,noAutoSave:pendingBefore===pendingAfter, fixedStates,resourceRefs,resourceStates,touch:controls.every(x=>x.getBoundingClientRect().height>=44),overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: sequence helper targets only filtered selected skills',r['visibleSelected']==5 and not r['hiddenOtherChecked'])
   record(f'{width}: start point can be copied from first mapped item',r['start']=='D40' and r['sheet']=='1')
   record(f'{width}: downward step preserves first mapping and fills blank candidates',r['skillRefs']==['D40','D42','D44','D46','D48'])
   record(f'{width}: generated formula/missing targets remain blocked by existing validator',r['skillStates']==['已核对','已核对','公式格','已核对','模板中不存在'])
   record(f'{width}: sequence status reports valid and pending candidates',('跳过已有 1' in r['seqStatus'] and '已核对 3' in r['seqStatus'] and '待处理 2' in r['seqStatus']))
   record(f'{width}: candidate generation never saves workbook automatically',r['noAutoSave'])
   record(f'{width}: manual corrections still pass normal validation',r['fixedStates']==['已核对']*5)
   record(f'{width}: horizontal stepping maps selected resources in order',r['resourceRefs']==['E50','G50','I50'] and r['resourceStates']==['已核对']*3)
   record(f'{width}: sequence controls keep 44px touch targets',r['touch'])
   record(f'{width}: sequence helper does not create page overflow',r['overflow'])
   page.screenshot(path=str(out/f'round278-dnd-sequence-helper-{width}.png'),full_page=False);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D sequential coordinate candidate helper; synthetic workbook and fictional PC only'}
(out/'round278-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND278',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
