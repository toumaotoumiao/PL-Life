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
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round275';pc.name='合成DND批量复用';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));for(const [label,value] of Object.entries({'背景':'侍从','等级':'9','熟练加值':'+4','生命值':'52'})){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}
 let mem={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:1,layoutId:'layout-21',refs:{}},updatedAt:Date.now()};
 pcWorkbookGet=async id=>String(id)===pc.id?mem:null;pcWorkbookPut=async row=>(mem=row,row);settings.pcExcelTemplateProfiles=[];pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await pcDndMapOpen();
 let body=document.getElementById('pcDndMapBody');const groups=[...body.querySelectorAll('[data-pc-dnd-map-group]')].map(x=>({id:x.dataset.pcDndMapGroup,rows:x.querySelectorAll('[data-pc-dnd-map-row]').length}));const profileButton=body.querySelector('[data-pc-dnd-map-apply-profile]');const buttons=[...body.querySelectorAll('.pc-dnd-map-profilebar .btn')];const initial={groups,profileDisabled:profileButton.disabled,touch:buttons.every(x=>x.getBoundingClientRect().height>=44)};
 body.querySelector('[data-pc-dnd-map-batch-toggle]').click();const batch=body.querySelector('[data-pc-dnd-map-batch]'),ta=body.querySelector('[data-pc-dnd-map-batch-text]'),batchTouch=body.querySelector('[data-pc-dnd-map-batch-apply]').getBoundingClientRect().height>=44;ta.value='背景=D5\n种族=D8\n阵营=M8\n等级=Y3\n熟练=R3\n先攻=D27\n生命值=AH27';pcDndMapApplyBatch();const batchResult={visible:!batch.hidden,verified:body.querySelector('[data-pc-dnd-map-verified]').textContent.trim(),refs:Object.fromEntries([...body.querySelectorAll('[data-pc-dnd-map-ref]')].map(x=>[x.dataset.pcDndMapRef,x.value]))};
 const parseBad={unknown:pcDndBatchParse('秘密=A1').errors.length,duplicate:pcDndBatchParse('背景=D5\n背景=E5').errors.length};body.querySelector('[data-pc-dnd-map-save-profile]').checked=true;body.querySelector('[data-pc-dnd-map-attest]').checked=true;await pcDndMapSave();
 const pendingProfile=pcExcelTemplateProfilePending,allowedKeys=['createdAt','editionId','extras','id','kind','layoutId','refs','updatedAt'],pendingSafe=pendingProfile&&pendingProfile.kind==='dnd-map-v2'&&pendingProfile.editionId==='5e-2024'&&pendingProfile.layoutId==='layout-21'&&Object.keys(pendingProfile.refs||{}).length===7&&Array.isArray(pendingProfile.extras)&&pendingProfile.extras.length===0&&Object.keys(pendingProfile).sort().join('|')===allowedKeys.sort().join('|')&&!Object.prototype.hasOwnProperty.call(pendingProfile,'value')&&!Object.prototype.hasOwnProperty.call(pendingProfile,'pcValue')&&!JSON.stringify(pendingProfile).includes('侍从');
 settings.pcExcelTemplateProfiles=pcExcelNormalizeProfiles([pendingProfile]);pcExcelTemplateProfilePending=null;pcWorkbookPending=null;mem={...mem,identityCombatMap:{version:1,layoutId:'layout-21',refs:{}}};
 // Add one unsafe reusable profile; it must be filtered by current workbook revalidation.
 settings.pcExcelTemplateProfiles=pcExcelNormalizeProfiles([...settings.pcExcelTemplateProfiles,{id:'dnd-map-deadbeef',kind:'dnd-map-v1',editionId:'5e-2024',layoutId:'layout-21',refs:{等级:'F12'},createdAt:1,updatedAt:1}]);
 await pcDndMapOpen();body=document.getElementById('pcDndMapBody');const reusableCount=pcDndMapSession.reusableProfiles.length,reuseButton=body.querySelector('[data-pc-dnd-map-apply-profile]');pcDndMapApplyReusable();const afterReuse={enabled:!reuseButton.disabled,text:reuseButton.textContent.trim(),count:reusableCount,verified:body.querySelector('[data-pc-dnd-map-verified]').textContent.trim()};
 const normalized=pcExcelNormalizeProfiles(settings.pcExcelTemplateProfiles),survives=normalized.some(x=>(x.kind==='dnd-map-v1'||x.kind==='dnd-map-v2')&&Object.keys(x.refs||{}).length===7);
 return {initial,batchTouch,batchResult,parseBad,pendingSafe,afterReuse,survives};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: mapping fields are grouped identity/combat',r['initial']['groups']==[{'id':'身份','rows':3},{'id':'战斗','rows':4}])
   record(f'{width}: no reusable config means apply is disabled',r['initial']['profileDisabled'])
   record(f'{width}: new batch/profile controls are touch sized',r['initial']['touch'])
   record(f'{width}: visible batch apply control is touch sized',r['batchTouch'])
   record(f'{width}: batch panel fills all seven coordinate refs',r['batchResult']['visible'] and r['batchResult']['verified']=='7/7' and len(r['batchResult']['refs'])==7)
   record(f'{width}: batch parser rejects unknown and duplicate fields',r['parseBad']=={'unknown':1,'duplicate':1})
   record(f'{width}: staged reusable profile contains coordinates only',r['pendingSafe'])
   record(f'{width}: unsafe saved profile is filtered by current workbook revalidation',r['afterReuse']['count']==1)
   record(f'{width}: reusable profile can repopulate a blank mapping',r['afterReuse']['enabled'] and '1' in r['afterReuse']['text'] and r['afterReuse']['verified']=='7/7')
   record(f'{width}: reusable profile survives settings normalization',r['survives'])
   page.screenshot(path=str(out/f'round275-dnd-map-batch-profile-{width}.png'),full_page=True);page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D grouped/batch/reusable coordinate profile; synthetic workbook only'}
(out/'round275-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND275',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
