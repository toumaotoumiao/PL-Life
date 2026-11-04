from synthetic_browser_origin import prepare_synthetic_origin
"""Real Chromium regression for delayed programmatic modal history cleanup and actual Back. Synthetic fixtures only."""
from pathlib import Path
import os,re,json,traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci/visual-evidence')))/'round162-modal-history'
OUT.mkdir(parents=True,exist_ok=True)
html=(ROOT/'index.html').read_text(encoding='utf-8')
checks=[];fails=[];shots=[]
def assert_state(ok,name,data=None):
 checks.append(name)
 if not ok:fails.append({'check':name,'state':data})
with sync_playwright() as p:
 options={'headless':True,'args':['--no-sandbox']}
 if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
 elif Path('/usr/bin/chromium').exists():options['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**options)
 for width in (375,1280):
  page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   # Open index.html as the first real browser navigation. Both set_content()
   # and an earlier test-only bootstrap page distort the Back destination.
   origin=prepare_synthetic_origin(page,bootstrap=False)
   page.goto(origin+'/index.html',wait_until='domcontentloaded',timeout=90000)
   page.wait_for_function('''()=>history.state?.tag===HISTORY_STATE_TAG && typeof openPcEditor==='function' && typeof closePcEditor==='function' ''',timeout=90000)
   page.evaluate('''()=>{document.documentElement.dataset.round162App='1';localStorage.setItem(ONBOARDING_KEY,'1');let a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert');pcs.push(normalizePcArchive({id:'audit-pc-a',name:'测试角色 A',ownerPlId:selfProfileId(),ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e',confirmed:true}},null));pcs.push(normalizePcArchive({id:'audit-pc-b',name:'测试角色 B',ownerPlId:selfProfileId(),ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e',confirmed:true}},null));runPlans.push(normalizeRunPlan({id:'audit-plan-a',moduleName:'合成计划A'}));runPlans.push(normalizeRunPlan({id:'audit-plan-b',moduleName:'合成计划B'}));}''')
   page.wait_for_timeout(550)
   baseline=page.evaluate('''()=>({origin:location.origin,path:location.pathname,historyLength:history.length,historyState:history.state,navigationEntries:typeof navigation!=='undefined'&&typeof navigation.entries==='function'?navigation.entries().map(e=>({url:e.url,index:e.index})):[]})''')
   assert_state(baseline['path']=='/index.html' and baseline['historyState'] is not None,
     f'{width} app initializes a real same-origin history entry',baseline)
   # Force history.back to land after the next modal is already open, rather than relying on natural timing.
   page.evaluate('''()=>{window.__originalHistoryBack=history.back.bind(history);window.__round162UnexpectedBack=0;history.back=function(){window.__round162UnexpectedBack++;setTimeout(()=>window.__originalHistoryBack(),65)};}''')
   page.evaluate('openPcEditor("audit-pc-a")')
   page.wait_for_timeout(30) # allow modal lifecycle observer to push A's navigation entry
   page.evaluate('async()=>await closePcEditor({force:true})')
   page.wait_for_timeout(15) # pending programmatic history.back is scheduled; its event has not landed
   page.evaluate('openPcEditor("audit-pc-b")')
   page.wait_for_timeout(300)
   state=page.evaluate('''()=>({open:!document.getElementById('pcEditorBackdrop').hidden,id:pcDraft?.id,path:location.pathname,modal:history.state?.modal,modalGuardCreated:history.state?.modalGuardCreated===true,historyLength:history.length,navigationEntries:typeof navigation!=='undefined'&&typeof navigation.entries==='function'?navigation.entries().map(e=>({url:e.url,index:e.index})):[],autoBack:window.__round162UnexpectedBack||0,pending:typeof pendingInternalModalHistoryBack==='number'?pendingInternalModalHistoryBack:-1})''')
   assert_state(state['open'] and state['id']=='audit-pc-b',f'{width} delayed cleanup does not dismiss next PC editor',state)
   assert_state(state['modal']=='pcEditorBackdrop' and state['modalGuardCreated'] and state['historyLength']>=baseline['historyLength']+1 and state['pending'] in (0,-1),f'{width} next PC retains an intact history guard',state)
   assert_state(state['autoBack']==0,f'{width} no delayed programmatic Back while switching PC editors',state)
   page.evaluate('history.back=window.__originalHistoryBack')
   page.evaluate('history.back()')
   page.wait_for_timeout(300)
   pc=page.evaluate('''()=>({present:!!document.getElementById('pcEditorBackdrop'),hidden:document.getElementById('pcEditorBackdrop')?.hidden??null,appLoaded:document.documentElement.dataset.round162App==='1',path:location.pathname,historyState:history.state,autoBack:window.__round162UnexpectedBack||0,pending:typeof pendingInternalModalHistoryBack==='number'?pendingInternalModalHistoryBack:-1})''')
   assert_state(pc['present'] and pc['appLoaded'],f'{width} page did not navigate away from the application',{'afterBack':pc,'beforeBack':state,'baseline':baseline})
   if not pc['present'] or not pc['appLoaded']:continue
   assert_state(pc['hidden'] and pc['pending'] in (0,-1),f'{width} real browser Back dismisses PC editor',pc)
   page.evaluate('''()=>{window.__originalHistoryBack=history.back.bind(history);window.__round162UnexpectedBack=0;history.back=function(){window.__round162UnexpectedBack++;setTimeout(()=>window.__originalHistoryBack(),65)};}''')
   page.evaluate('openPlanEditor("audit-plan-a")')
   page.wait_for_timeout(30)
   page.evaluate('closePlanEditor()')
   page.wait_for_timeout(15)
   page.evaluate('openPlanEditor("audit-plan-b")')
   page.wait_for_timeout(330)
   plan=page.evaluate('''()=>({open:!document.getElementById('planEditorBackdrop').hidden,id:editingPlanId,modal:history.state?.modal,autoBack:window.__round162UnexpectedBack||0,pending:typeof pendingInternalModalHistoryBack==='number'?pendingInternalModalHistoryBack:-1})''')
   assert_state(plan['open'] and plan['id']=='audit-plan-b',f'{width} delayed cleanup does not dismiss next plan editor',plan)
   assert_state(plan['modal']=='planEditorBackdrop' and plan['pending'] in (0,-1),f'{width} next plan retains a history guard',plan)
   assert_state(plan['autoBack']==0,f'{width} no delayed programmatic Back while switching plan editors',plan)
   page.evaluate('history.back=window.__originalHistoryBack')
   page.evaluate('history.back()')
   page.wait_for_timeout(300)
   closed=page.evaluate('''()=>({hidden:document.getElementById('planEditorBackdrop').hidden,autoBack:window.__round162UnexpectedBack||0,pending:typeof pendingInternalModalHistoryBack==='number'?pendingInternalModalHistoryBack:-1})''')
   assert_state(closed['hidden'] and closed['pending'] in (0,-1),f'{width} real browser Back dismisses plan editor',closed)
   assert_state(not errors,f'{width} no browser exception',errors[:3])
   name=f'modal-history-{width}.png';page.screenshot(path=str(OUT/name),full_page=False);shots.append(name)
  except Exception: fails.append({'check':f'{width} runtime failure','state':traceback.format_exc()[-1600:]})
  finally:page.close()
 browser.close()
result={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'failures':fails,'screenshots':shots}
(OUT/'round162-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'ROUND162: {len(checks)} checks, {len(fails)} failures, {len(shots)} screenshots')
for err in fails:print('FAIL',json.dumps(err,ensure_ascii=False)[:900])
if fails:raise SystemExit(1)
