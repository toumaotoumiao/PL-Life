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
 const makePc=(id,name,skillA='+5',skillB='+4')=>{const pc=makeBlankPc(selfProfileId());pc.id=id;pc.name=name;pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(const [label,value] of Object.entries({'背景':'侍从','等级':'9','熟练加值':'+4','生命值':'52'})){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}rd.skills.push({label:'察觉',value:skillA},{label:'隐匿',value:skillB},{label:'奥秘',value:'+3'},{label:'奥秘',value:'+6'});rd.resources.push({label:'长剑',value:'1d8+3'});return pc;};
 const store=new Map(),baseRow=id=>({pcId:id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:1,layoutId:'layout-21',refs:{}},updatedAt:Date.now()});pcWorkbookGet=async id=>store.get(String(id))||null;pcWorkbookPut=async row=>(store.set(String(row.pcId),row),row);settings.pcExcelTemplateProfiles=[];
 const pc=makePc('round276a','扩展映射A');store.set(pc.id,baseRow(pc.id));pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();let body=document.getElementById('pcDndMapBody');
 const candidateRows=[...body.querySelectorAll('[data-pc-dnd-extra-row]')],initial={candidateCount:candidateRows.length,duplicates:candidateRows.filter(x=>x.dataset.pcDndExtraDuplicate==='true').length,summary:body.querySelector('[data-pc-dnd-map-extra]').textContent.trim(),overflow:document.documentElement.scrollWidth<=innerWidth+2};
 const search=body.querySelector('[data-pc-dnd-extra-search]');search.value='察觉';pcDndMapFilterExtras();const filtered={visible:[...candidateRows].filter(x=>!x.hidden).length,text:body.querySelector('[data-pc-dnd-extra-visible]').textContent.trim()};search.value='';pcDndMapFilterExtras();
 body.querySelector('[data-pc-dnd-map-batch-toggle]').click();const ta=body.querySelector('[data-pc-dnd-map-batch-text]');ta.value='背景=D5\n种族=D8\n阵营=M8\n等级=Y3\n熟练=R3\n先攻=D27\n生命值=AH27\n技能:察觉=2!D30\n技能:隐匿=2!F30\n装备:长剑=2!H30';pcDndMapApplyBatch();const afterBatch={fixed:body.querySelector('[data-pc-dnd-map-verified]').textContent.trim(),extra:body.querySelector('[data-pc-dnd-map-extra]').textContent.trim(),extraExport:body.querySelector('[data-pc-dnd-map-extra-exportable]').textContent.trim()};
 const perception=body.querySelector(`[data-pc-dnd-extra-key="${CSS.escape(pcDndExtendedLabelKey('skills','察觉'))}"]`),stealth=body.querySelector(`[data-pc-dnd-extra-key="${CSS.escape(pcDndExtendedLabelKey('skills','隐匿'))}"]`),sword=body.querySelector(`[data-pc-dnd-extra-key="${CSS.escape(pcDndExtendedLabelKey('resources','长剑'))}"]`);
 const setRef=(row,ref)=>{row.querySelector('[data-pc-dnd-extra-ref]').value=ref;pcDndMapRefresh();return row.dataset.state;};const guards={protected:setRef(perception,'I12'),formula:setRef(stealth,'F12')};setRef(perception,'D30');setRef(stealth,'F30');guards.duplicate=setRef(sword,'D30');setRef(sword,'H30');
 const touches=[...body.querySelectorAll('[data-pc-dnd-extra-row] select,[data-pc-dnd-extra-row] input[type="text"],.pc-dnd-map-extra-tools input')].filter(x=>x.offsetParent!==null).every(x=>x.getBoundingClientRect().height>=44);
 body.querySelector('[data-pc-dnd-map-save-profile]').checked=true;body.querySelector('[data-pc-dnd-map-attest]').checked=true;await pcDndMapSave();const map=pcWorkbookPending.identityCombatMap,profile=pcExcelTemplateProfilePending,profileSafe=profile?.kind==='dnd-map-v2'&&profile.extras?.length===3&&!JSON.stringify(profile).includes('+5')&&!JSON.stringify(profile).includes('1d8+3')&&!Object.keys(profile).some(k=>/value/i.test(k));
 const sourceFile=new File([source],'fictional-template.xlsx',{type:PC_XLSX_MIME});const built=await pcBuildDndTemplateWorkbook(sourceFile,pcDraft,{identityCombatMap:map}),readback=await pcExcelReadXlsx(await built.blob.arrayBuffer()),written={perception:String(pcInsaneSheetCell(readback[1],'D30')??''),stealth:String(pcInsaneSheetCell(readback[1],'F30')??''),sword:String(pcInsaneSheetCell(readback[1],'H30')??'')};
 settings.pcExcelTemplateProfiles=pcExcelNormalizeProfiles([profile]);pcExcelTemplateProfilePending=null;pcWorkbookPending=null;
 const pc2=makePc('round276b','扩展映射B','+8','+7');store.set(pc2.id,baseRow(pc2.id));pcs.push(pc2);openPcEditor(pc2.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();body=document.getElementById('pcDndMapBody');const reusable=pcDndMapSession.reusableProfiles.length;pcDndMapApplyReusable();const reused={fixed:body.querySelector('[data-pc-dnd-map-verified]').textContent.trim(),extra:body.querySelector('[data-pc-dnd-map-extra]').textContent.trim(),checked:[...body.querySelectorAll('[data-pc-dnd-extra-enable]:checked')].length};
 return {initial,filtered,afterBatch,guards,touches,mapExtras:map.extras.length,profileSafe,builtCount:built.count,written,reusable,reused,overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1100},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: extended candidates include skills/resources and duplicate labels are flagged',r['initial']['candidateCount']==5 and r['initial']['duplicates']==2 and r['initial']['summary']=='0/5')
   record(f'{width}: extended mapping search filters by field name',r['filtered']['visible']==1 and r['filtered']['text'].startswith('显示 1/5'))
   record(f'{width}: batch entry maps fixed plus three extended fields',r['afterBatch']=={'fixed':'7/7','extra':'3/5','extraExport':'3'})
   record(f'{width}: protected ability cell is rejected',r['guards']['protected']=='blocked')
   record(f'{width}: formula cell is rejected',r['guards']['formula']=='blocked')
   record(f'{width}: duplicate target cell is rejected',r['guards']['duplicate']=='blocked')
   record(f'{width}: visible extended controls keep 44px touch targets',r['touches'])
   record(f'{width}: saved per-PC map includes exactly three extended coordinate records',r['mapExtras']==3)
   record(f'{width}: v2 reusable profile contains no PC values',r['profileSafe'])
   record(f'{width}: actual XLSX export writes extended fields and re-reads them',r['written']=={'perception':'+5','stealth':'+4','sword':'1d8+3'} and r['builtCount']>=13)
   record(f'{width}: same-edition profile is available for second PC',r['reusable']==1)
   record(f'{width}: reusable profile repopulates fixed and extended mappings',r['reused']=={'fixed':'7/7','extra':'3/5','checked':3})
   record(f'{width}: mapping UI does not cause horizontal page overflow',r['initial']['overflow'] and r['overflow'])
   page.screenshot(path=str(out/f'round276-dnd-extended-map-{width}.png'),full_page=True);page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D extended skill/equipment mapping; synthetic workbook only'}
(out/'round276-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND276',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
