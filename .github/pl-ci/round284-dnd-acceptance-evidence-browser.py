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
def rec(label,ok): checks.append({'test':label,'pass':bool(ok)})
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 const pc=makeBlankPc(selfProfileId());pc.id='SECRET_PC_ID_284';pc.name='SECRET_PC_NAME_284';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.skills.push({label:'SECRET_SKILL_LABEL_284',value:'SECRET_SKILL_VALUE_284'});const bg=rd.resources.find(x=>x.label==='背景');if(bg)bg.value='SECRET_BACKGROUND_284';pcDraft=pc;
 document.getElementById('pcEditorBackdrop').hidden=false;document.getElementById('pcEditorBody').innerHTML=pcGenericRuleEditorHTML(pc);
 pcWorkbookPending={pcId:pc.id,kind:'dnd-template',templateKey:'dnd:5e-2024',blob:new Blob(['x']),fileName:'SECRET_FILE_NAME_284.xlsx',layoutId:'layout-21',identityCombatMap:{version:2,layoutId:'layout-21',refs:{},extras:[]}};
 await syncPcDndTemplateExportUi(pc,{adapterId:'dnd-template'});const button=document.querySelector('[data-pc-dnd-acceptance-open]'),beforeDisabled=button?.disabled===true;
 const result={edition:'2024',layoutId:'layout-21',count:13,selfCheck:{verified:true,plannedWrites:13,modifiedSheets:2,preservedParts:390,packageParts:392}};const audit={canExport:true,abilities:{ready:6},fixed:{exportable:4},skills:{exportable:2},resources:{exportable:1},blockers:[],warnings:[{scope:'x'}]};
 pcDndAcceptanceRecordSuccess(pc,result,audit,{bindTemplate:false});syncPcExcelExportUi(pcDraft);await new Promise(r=>setTimeout(r,30));const afterEnabled=button?.disabled===false;
 const evidence=pcDndAcceptanceSession.evidence,serialized=JSON.stringify(evidence),privateFree=!['SECRET_PC_ID_284','SECRET_PC_NAME_284','SECRET_SKILL_LABEL_284','SECRET_SKILL_VALUE_284','SECRET_BACKGROUND_284','SECRET_FILE_NAME_284'].some(x=>serialized.includes(x));
 const shape=evidence.format==='pl-life-dnd-export-acceptance'&&evidence.coverage.total===13&&evidence.coverage.skills===2&&evidence.postbuild.verified&&evidence.preflight.passed&&evidence.manualReviewStatus==='pending';
 const opened=pcDndAcceptanceOpen();await new Promise(r=>setTimeout(r,40));const layer=document.getElementById('pcDndAcceptanceBackdrop'),modalVisible=opened&&layer&&!layer.hidden,editorInert=document.getElementById('pcEditorBackdrop').inert===true;
 const selects=[...layer.querySelectorAll('[data-pc-dnd-acceptance-manual]')],touch=selects.length===4&&selects.every(x=>x.getBoundingClientRect().height>=44);
 for(const sel of selects){sel.value='pass';sel.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,5));}
 const allPassed=pcDndAcceptanceSession.evidence.manualReviewStatus==='passed'&&Object.values(pcDndAcceptanceSession.evidence.manualReview).every(v=>v===true);
 window.__round284Download=null;window.downloadBlobFile=(blob,name)=>{window.__round284Download={blob,name};return true;};const downloaded=pcDndAcceptanceDownload();const text=await window.__round284Download.blob.text(),json=JSON.parse(text),genericName=/^PL-Life_DND5_匿名验收记录_v[0-9.]+\.json$/.test(window.__round284Download.name),jsonPrivateFree=!['SECRET_PC_ID_284','SECRET_PC_NAME_284','SECRET_SKILL_LABEL_284','SECRET_SKILL_VALUE_284','SECRET_BACKGROUND_284','SECRET_FILE_NAME_284'].some(x=>text.includes(x));
 pcDndAcceptanceClose();await new Promise(r=>setTimeout(r,20));const restored=document.getElementById('pcEditorBackdrop').inert!==true;
 return {beforeDisabled,afterEnabled,privateFree,shape,modalVisible,editorInert,touch,allPassed,downloaded,genericName,jsonPrivateFree,jsonStatus:json.manualReviewStatus,restored,overflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   rec(f'{width}: acceptance action is disabled before successful export and enabled after evidence is recorded',r['beforeDisabled'] and r['afterEnabled'])
   rec(f'{width}: evidence contains aggregate verification only and no PC/file sentinel content',r['privateFree'] and r['shape'])
   rec(f'{width}: acceptance review opens as managed top modal',r['modalVisible'] and r['editorInert'])
   rec(f'{width}: four manual review controls retain >=44px touch targets',r['touch'])
   rec(f'{width}: four manual checks can reach passed state',r['allPassed'])
   rec(f'{width}: downloaded JSON uses generic filename and remains private',r['downloaded'] and r['genericName'] and r['jsonPrivateFree'] and r['jsonStatus']=='passed')
   rec(f'{width}: closing acceptance modal restores PC editor interaction',r['restored'])
   rec(f'{width}: acceptance review causes no horizontal page overflow',r['overflow'])
   page.screenshot(path=str(out/f'round284-dnd-acceptance-evidence-{width}.png'),full_page=True);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D anonymous acceptance evidence and manual Excel/WPS review; no character values retained'}
(out/'round284-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND284',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
