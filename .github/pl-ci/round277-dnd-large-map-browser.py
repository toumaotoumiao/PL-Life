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
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}put(30,'D30');put(30,'F30');put(30,'H30');put(30,'J30');}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round277';pc.name='大量技能映射';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));
 rd.skills.push({label:'察觉',value:'+5'},{label:'奥秘',value:'+3'},{label:'奥秘',value:'+6'});for(let i=1;i<=160;i++)rd.skills.push({label:`技能${String(i).padStart(3,'0')}`,value:`+${(i%9)+1}`});rd.resources.push({label:'长剑',value:'1d8+3'});
 const row={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]},updatedAt:Date.now()};pcWorkbookGet=async()=>row;settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();const body=document.getElementById('pcDndMapBody');const rows=[...body.querySelectorAll('[data-pc-dnd-extra-row]')];
 const total=rows.length,lastPresent=rows.some(r=>r.dataset.pcDndExtraLabel==='技能160'),dupes=rows.filter(r=>r.dataset.pcDndExtraDuplicate==='true').length;
 const search=body.querySelector('[data-pc-dnd-extra-search]'),group=body.querySelector('[data-pc-dnd-extra-group-filter]'),state=body.querySelector('[data-pc-dnd-extra-state-filter]');
 search.value='cj';search.dispatchEvent(new Event('input',{bubbles:true}));const pinyinVisible=rows.filter(r=>!r.hidden).map(r=>r.dataset.pcDndExtraLabel);
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));state.value='conflicts';state.dispatchEvent(new Event('change',{bubbles:true}));const conflictVisible=rows.filter(r=>!r.hidden).map(r=>r.dataset.pcDndExtraLabel);
 state.value='all';state.dispatchEvent(new Event('change',{bubbles:true}));group.value='resources';group.dispatchEvent(new Event('change',{bubbles:true}));const resourceVisible=rows.filter(r=>!r.hidden).map(r=>r.dataset.pcDndExtraLabel);
 group.value='skills';group.dispatchEvent(new Event('change',{bubbles:true}));search.value='技能1';search.dispatchEvent(new Event('input',{bubbles:true}));const currentVisible=rows.filter(r=>!r.hidden),eligible=currentVisible.filter(r=>!r.querySelector('[data-pc-dnd-extra-enable]').disabled).length;body.querySelector('[data-pc-dnd-extra-select-visible]').click();const checkedAfterSelect=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked).length;body.querySelector('[data-pc-dnd-extra-clear-visible]').click();const checkedAfterClear=rows.filter(r=>!r.hidden&&r.querySelector('[data-pc-dnd-extra-enable]').checked).length;
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));group.value='all';group.dispatchEvent(new Event('change',{bubbles:true}));
 pcDndMapApplyExtras([{group:'skills',label:'察觉',sheet:1,ref:'D30'},{group:'resources',label:'长剑',sheet:1,ref:'H30'}]);state.value='mapped';state.dispatchEvent(new Event('change',{bubbles:true}));const mappedVisible=rows.filter(r=>!r.hidden).map(r=>r.dataset.pcDndExtraLabel).sort();state.value='exportable';state.dispatchEvent(new Event('change',{bubbles:true}));const exportVisible=rows.filter(r=>!r.hidden).map(r=>r.dataset.pcDndExtraLabel).sort();
 const counter=body.querySelector('[data-pc-dnd-extra-visible]').textContent.trim(),touch=[...body.querySelectorAll('.pc-dnd-map-extra-tools input,.pc-dnd-map-extra-tools select,.pc-dnd-map-extra-tools button')].filter(x=>x.offsetParent!==null).every(x=>x.getBoundingClientRect().height>=44);
 return {total,lastPresent,dupes,pinyinVisible,conflictVisible,resourceVisible,eligible,checkedAfterSelect,checkedAfterClear,mappedVisible,exportVisible,counter,touch,overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: more than 140 extended candidates are retained',r['total']>=164 and r['lastPresent'])
   record(f'{width}: duplicate-name conflicts stay isolated',r['dupes']==2 and r['conflictVisible']==['奥秘','奥秘'])
   record(f'{width}: pinyin-initial search finds 察觉',r['pinyinVisible']==['察觉'])
   record(f'{width}: group filter isolates equipment/resources',r['resourceVisible']==['长剑'])
   record(f'{width}: bulk select affects only current visible eligible rows',r['eligible']>0 and r['checkedAfterSelect']==r['eligible'])
   record(f'{width}: bulk clear affects only current visible rows',r['checkedAfterClear']==0)
   record(f'{width}: mapped filter shows only validated mappings',r['mappedVisible']==['察觉','长剑'])
   record(f'{width}: exportable filter matches mapped fields with current PC values',r['exportVisible']==['察觉','长剑'])
   record(f'{width}: filter controls keep 44px touch targets',r['touch'])
   record(f'{width}: large mapping UI does not create page overflow',r['overflow'])
   page.screenshot(path=str(out/f'round277-dnd-large-map-{width}.png'),full_page=False);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'large D&D mapping management; synthetic workbook and fictional PC only'}
(out/'round277-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND277',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
