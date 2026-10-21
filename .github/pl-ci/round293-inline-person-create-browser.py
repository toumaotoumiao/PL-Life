#!/usr/bin/env python3
from synthetic_browser_origin import prepare_synthetic_origin
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
def rec(label,ok,detail=''):checks.append({'test':label,'pass':bool(ok),'detail':detail})
script=r'''async()=>{
  localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
  appConfirm=async()=>true;const toastLog=[];showToast=(m)=>toastLog.push(String(m));
  profiles=[];pcs=[];runRecords=[];
  let p=makeBlankRunPlan();p.id='round293-plan';p.moduleName='列表新建测试';p.tableName='测试桌';p.plIds=[];p.participantAssignments=[];runPlans=[p];
  openPlanEditor(p.id);await new Promise(r=>setTimeout(r,30));
  let drawer=document.getElementById('planEditorDrawer'),plInput=drawer.querySelector('[data-editor-add-pl-query]');
  plInput.value='新朋友';plInput.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));
  let plCreate=drawer.querySelector('[data-editor-create-pl]');
  const plRowVisible=!!plCreate&&!plCreate.closest('[hidden]');
  plCreate?.click();await new Promise(r=>setTimeout(r,80));
  let created=profiles.find(x=>x.name==='新朋友'),live=runPlans.find(x=>x.id===p.id);
  const plLinked=!!created&&live.plIds.includes(created.id);
  const plDuplicateBlocked=!planPlPickerOptionsHTML(live,'新朋友').includes('data-editor-create-pl');
  drawer=document.getElementById('planEditorDrawer');
  let pcInput=drawer.querySelector(`[data-plan-pc-name="${created?.id||''}"]`);
  if(pcInput){pcInput.value='角色甲';pcInput.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));}
  const pcCreate=pcInput?.closest('.assignment-pc-field')?.querySelector('[data-pc-create]');
  const pcRowVisible=!!pcCreate&&!pcCreate.closest('[hidden]');
  pcCreate?.click();await new Promise(r=>setTimeout(r,80));
  live=runPlans.find(x=>x.id===p.id);
  const newPc=pcs.find(x=>x.ownerPlId===created?.id&&x.name==='角色甲');
  const assignment=(live.participantAssignments||[]).find(x=>String(x.plId)===String(created?.id));
  const pcLinked=!!newPc&&String(assignment?.pcId||'')===String(newPc.id);
  const pcDuplicateBlocked=!pcNamePickerOptionsHTML(created?.id||'','角色甲','plan').includes('data-pc-create');
  const lowerCreateHidden=!!drawer.querySelector(`[data-plan-pc-name="${created?.id||''}"]`)?.closest('.assignment-pc-field')?.querySelector('.assignment-pc-actions [data-pc-create]')?.hidden;
  const recordModule=normalizeRichModule({id:'round293-module',name:'记录测试',createdAt:Date.now(),updatedAt:Date.now()},settings.moduleArchive);modules=[recordModule];let record=normalizeRunRecord({id:'round293-record',moduleId:recordModule.id,moduleName:recordModule.name,tableStatus:'completed',plIds:[],participantAssignments:[],createdAt:Date.now(),updatedAt:Date.now()},new Set(profiles.map(x=>x.id)));runRecords=[record];
  setRecordPlPickerQuery(record.id,'记录新人');
  const recordRow=recordPlPickerOptionsHTML(record,'记录新人').includes('data-record-create-pl');const recordQueryBefore=recordPlPickerQuery(record.id),recordExactBefore=exactProfileMatches('记录新人',profiles).map(x=>x.name);
  const recordCreated=await createAndAddProfileFromRunPicker('record',record.id,'记录新人');
  record=runRecords.find(x=>x.id==='round293-record');const recordProfile=profiles.find(x=>x.name==='记录新人');
  const recordLinked=recordCreated&&!!recordProfile&&record.plIds.includes(recordProfile.id);
  const xOverflow=document.documentElement.scrollWidth>innerWidth+2;
  return {plRowVisible,plLinked,plDuplicateBlocked,pcRowVisible,pcLinked,pcDuplicateBlocked,lowerCreateHidden,recordRow,recordLinked,xOverflow,profileCount:profiles.length,pcCount:pcs.length,recordPlIds:record?.plIds||[],recordProfileId:recordProfile?.id||'',recordCreated,recordQueryBefore,recordExactBefore,toastLog};
}'''
with sync_playwright() as p:
  executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
  browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
  try:
    for width in (390,1280):
      page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(getattr(e,'message',None) or str(e)))
      prepare_synthetic_origin(page);page.set_content(html,wait_until='domcontentloaded',timeout=120000);r=page.evaluate(script)
      rec(f'{width}: PL search list offers explicit inline create',r['plRowVisible'],str(r))
      rec(f'{width}: created PL is immediately linked to the plan',r['plLinked'],str(r))
      rec(f'{width}: exact PL duplicate does not offer another create row',r['plDuplicateBlocked'],str(r))
      rec(f'{width}: PC search list offers explicit inline create',r['pcRowVisible'],str(r))
      rec(f'{width}: created PC is linked by id to that PL assignment',r['pcLinked'],str(r))
      rec(f'{width}: same-owner exact PC duplicate does not offer another create row',r['pcDuplicateBlocked'],str(r))
      rec(f'{width}: duplicate lower PC create action is hidden',r['lowerCreateHidden'],str(r))
      rec(f'{width}: run-record PL picker offers and completes inline create',r['recordRow'] and r['recordLinked'],str(r))
      rec(f'{width}: inline person-create flow stays within viewport',not r['xOverflow'],str(r))
      page.screenshot(path=str(out/f'round293-inline-person-create-{width}.png'),full_page=True);page.close()
  finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'plan/record PL + PC inline create-and-link; exact-duplicate guard'}
(out/'round293-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND293',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
  print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
