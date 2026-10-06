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
def rec(label,ok):checks.append({'test':label,'pass':bool(ok)})
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 let p=makeBlankRunPlan();p.id='round285-plan';p.moduleName='固定时间测试';p.tableName='测试桌';p.schedulePreset=normalizePlanSchedulePreset({startTime:'19:00',endTime:'23:00'});p.timeSlots=[];runPlans=[p];runRecords=[];
 schedulePlanOnDaypart(p.id,'2026-10-14','evening');await new Promise(r=>setTimeout(r,30));
 let live=runPlans.find(x=>x.id===p.id),first=live.timeSlots.find(s=>s.date==='2026-10-14');const inherited=!!first&&first.startTime==='19:00'&&first.endTime==='23:00';
 const firstId=first.id;live.schedulePreset=normalizePlanSchedulePreset({startTime:'20:00',endTime:'23:30'});const oldUnaffected=first.startTime==='19:00'&&first.endTime==='23:00';
 movePlanSlotToDaypart(p.id,firstId,'2026-10-15','afternoon');await new Promise(r=>setTimeout(r,20));live=runPlans.find(x=>x.id===p.id);first=live.timeSlots.find(s=>s.id===firstId);const movePreserved=first.date==='2026-10-15'&&first.daypart==='afternoon'&&first.startTime==='19:00'&&first.endTime==='23:00';
 schedulePlanOnDaypart(p.id,'2026-10-16','evening');await new Promise(r=>setTimeout(r,20));live=runPlans.find(x=>x.id===p.id);const second=live.timeSlots.find(s=>s.date==='2026-10-16');const newUsesNewPreset=!!second&&second.startTime==='20:00'&&second.endTime==='23:30';
 openPlanEditor(p.id);await new Promise(r=>setTimeout(r,40));
 const drawer=document.getElementById('planEditorDrawer'),presetStart=drawer.querySelector('[data-plan-schedule-preset-start]'),presetEnd=drawer.querySelector('[data-plan-schedule-preset-end]'),firstStart=drawer.querySelector(`[data-editor-slot-start="${firstId}"]`),firstEnd=drawer.querySelector(`[data-editor-slot-end="${firstId}"]`),useDefault=drawer.querySelector(`[data-editor-use-schedule-preset="${firstId}"]`);
 const editorValues=presetStart?.value==='20:00'&&presetEnd?.value==='23:30'&&firstStart?.value==='19:00'&&firstEnd?.value==='23:00'&&!!useDefault;
 firstStart.value='18:30';firstStart.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,550));live=runPlans.find(x=>x.id===p.id);first=live.timeSlots.find(s=>s.id===firstId);const perOccurrence=first.startTime==='18:30'&&live.schedulePreset.startTime==='20:00'&&live.timeSlots.find(s=>s.id===second.id).startTime==='20:00';
 const firstExact=first.endTime==='23:00';
 presetStart.value='20:15';presetStart.dispatchEvent(new Event('input',{bubbles:true}));presetStart.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,80));live=runPlans.find(x=>x.id===p.id);const presetStartLive=drawer.querySelector('[data-plan-schedule-preset-start]'),applyLive=drawer.querySelector('[data-editor-apply-schedule-preset]'),useLive=drawer.querySelector(`[data-editor-use-schedule-preset="${firstId}"]`);const presetControlsRefresh=live.schedulePreset.startTime==='20:15'&&presetStartLive?.value==='20:15'&&applyLive?.disabled===false&&!!useLive;
 const controls=[...drawer.querySelectorAll('.plan-schedule-time-field input,.plan-editor-schedule-time input')];const controlsVisible=controls.length>=6&&controls.every(el=>{const r=el.getBoundingClientRect();return r.width>40&&r.height>=32;});
 const drawerNoOverflow=drawer.scrollWidth<=drawer.clientWidth+2;
 plannerSelectedDate='2026-10-16';plannerVisiblePlanIds=null;const calendarHasExact=plannerWeekHTML().includes('20:00–23:30');drawer.querySelector('.plan-schedule-preset')?.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,30));
 return {inherited,oldUnaffected,movePreserved,newUsesNewPreset,editorValues,perOccurrence,firstExact,presetControlsRefresh,controlsVisible,drawerNoOverflow,calendarHasExact,pageOverflow:document.documentElement.scrollWidth<=innerWidth+2};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':1000},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   rec(f'{width}: manual placement inherits plan default exact time',r['inherited'])
   rec(f'{width}: changing default does not silently rewrite existing occurrence',r['oldUnaffected'])
   rec(f'{width}: moving an occurrence preserves its custom exact time',r['movePreserved'])
   rec(f'{width}: later manual placement uses the updated default',r['newUsesNewPreset'])
   rec(f'{width}: plan editor exposes preset and independent occurrence values',r['editorValues'])
   rec(f'{width}: editing one occurrence changes neither preset nor another occurrence',r['perOccurrence'] and r['firstExact'])
   rec(f'{width}: changing preset refreshes bulk/per-occurrence controls immediately',r['presetControlsRefresh'])
   rec(f'{width}: exact-time controls remain visible and contained',r['controlsVisible'] and r['drawerNoOverflow'] and r['pageOverflow'])
   rec(f'{width}: calendar renders the exact time copied into the occurrence',r['calendarHasExact'])
   page.screenshot(path=str(out/f'round285-plan-default-time-{width}.png'),full_page=True);page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'plan default exact-time preset + independent per-occurrence overrides'}
(out/'round285-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND285',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
