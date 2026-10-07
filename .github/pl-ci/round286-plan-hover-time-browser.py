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
setup=r'''()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 let p=makeBlankRunPlan();p.id='round286-plan';p.moduleName='悬浮时间测试';p.tableName='A桌';p.schedulePreset=normalizePlanSchedulePreset({startTime:'19:00',endTime:'23:00'});p.timeSlots=[{id:'round286-slot-a',date:'2026-10-08',daypart:'evening',startTime:'19:00',endTime:'23:00',order:1},{id:'round286-slot-b',date:'2026-10-09',daypart:'evening',startTime:'20:00',endTime:'23:30',order:1}];runPlans=[normalizeRunPlan(p,new Set())];runRecords=[];plannerSelectedDate='2026-10-08';plannerMonthCursor=monthCursorFor(plannerSelectedDate);plannerPickedPlanId=null;plannerVisiblePlanIds=null;plannerViewMode=innerWidth<=760?'three':'week';switchView('plans');renderRunPlans();renderPlannerCalendars();return {hover:plannerQuickTimeHoverMedia.matches,view:plannerViewMode};
}'''
def state_script():
 return r'''()=>{const plan=runPlans.find(x=>x.id==='round286-plan'),a=plan.timeSlots.find(x=>x.id==='round286-slot-a'),b=plan.timeSlots.find(x=>x.id==='round286-slot-b'),pop=document.querySelector('.planner-quick-time-popover'),ev=document.querySelector('[data-week-event-slot="round286-slot-a"]'),time=ev?.querySelector('.calendar-event-time')?.textContent.trim()||'',r=pop&&!pop.hidden?pop.getBoundingClientRect():null;return{a:{start:a?.startTime||'',end:a?.endTime||''},b:{start:b?.startTime||'',end:b?.endTime||''},preset:plan.schedulePreset,time,popVisible:!!pop&&!pop.hidden,popRect:r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null,pageOverflow:document.documentElement.scrollWidth<=innerWidth+2,popInputs:pop&&!pop.hidden?[pop.querySelector('[data-quick-time-start]')?.value||'',pop.querySelector('[data-quick-time-end]')?.value||'']:[]};}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   page.set_content(html,wait_until='domcontentloaded',timeout=90000)
   meta=page.evaluate(setup)
   event='[data-week-event-slot="round286-slot-a"]'
   page.hover(event);page.wait_for_timeout(230)
   s=page.evaluate(state_script())
   rect=s['popRect'] or {}
   contained=bool(rect) and rect['left']>=-0.5 and rect['top']>=-0.5 and rect['right']<=width+0.5 and rect['bottom']<=900+0.5
   rec(f'{width}: mouse hover opens quick-time editor',meta['hover'] and s['popVisible'])
   rec(f'{width}: quick editor starts with this occurrence values',s['popInputs']==['19:00','23:00'])
   rec(f'{width}: quick editor is contained in viewport',contained and s['pageOverflow'])
   if width in (390,1280): page.screenshot(path=str(out/f'round286-plan-hover-time-open-{width}.png'),full_page=True)
   page.locator('[data-quick-time-start]').fill('18:30')
   page.locator('[data-quick-time-end]').fill('22:30')
   page.locator('[data-quick-time-save]').click();page.wait_for_timeout(80)
   s=page.evaluate(state_script())
   rec(f'{width}: save changes only selected occurrence',s['a']=={'start':'18:30','end':'22:30'} and s['b']=={'start':'20:00','end':'23:30'} and s['preset'].get('startTime')=='19:00' and s['preset'].get('endTime')=='23:00')
   rec(f'{width}: calendar immediately reflects saved exact time',s['time']=='18:30–22:30' and not s['popVisible'])
   page.locator(event+' .calendar-event-time').click();page.wait_for_timeout(60)
   s=page.evaluate(state_script())
   rec(f'{width}: clicking the time text reopens the same editor',s['popVisible'] and s['popInputs']==['18:30','22:30'])
   page.locator('[data-quick-time-default]').click();page.wait_for_timeout(70)
   s=page.evaluate(state_script())
   rec(f'{width}: apply-default affects only this occurrence',s['a']=={'start':'19:00','end':'23:00'} and s['b']=={'start':'20:00','end':'23:30'} and s['preset'].get('startTime')=='19:00')
   page.locator(event+' .calendar-event-time').click();page.wait_for_timeout(40)
   page.locator('[data-quick-time-clear]').click();page.wait_for_timeout(70)
   s=page.evaluate(state_script())
   rec(f'{width}: clear removes exact hours but keeps arrangement',s['a']=={'start':'','end':''} and s['time']=='晚' and s['b']=={'start':'20:00','end':'23:30'})
   page.screenshot(path=str(out/f'round286-plan-hover-time-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'planner occurrence hover/click exact-time quick editor'}
(out/'round286-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND286',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
