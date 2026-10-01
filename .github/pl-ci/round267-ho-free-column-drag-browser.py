#!/usr/bin/env python3
from pathlib import Path
import json,os,re,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def check(label,ok,detail=None):checks.append({'check':label,'pass':bool(ok),'detail':None if ok else detail})
SEED='''()=>{
 localStorage.setItem('tomato_pl_onboarding_v1','1');
 const ob=document.getElementById('onboardingBackdrop');if(ob){ob.hidden=true;ob.style.setProperty('display','none','important')}document.getElementById('appRoot')?.removeAttribute('inert');
 const p=normalizeProfile({id:'audit-pl',name:'合成玩家'});profiles.push(p);
 const m=normalizeRichModule({id:'audit-mod',name:'HO 导出测试模组',hoSystem:'has'},settings.moduleArchive);modules.push(m);
 let n=0;
 for(let ho=1;ho<=6;ho++)for(let k=0;k<18;k++){
   n++;const a={plId:p.id,pcId:'',pcName:'角色 '+ho+'-'+k,hoMode:ho<=5?'number':'custom',hoNumber:ho<=5?ho:0,hoCustom:ho===6?'HO6':''};
   runRecords.push(normalizeRunRecord({id:'audit-r'+n,moduleId:m.id,moduleName:m.name,tableName:'测试桌 '+n,kpName:'KP',plIds:[p.id],participantAssignments:[a],startDate:`2026-09-${String((n%27)+1).padStart(2,'0')}`,endDate:`2026-09-${String((n%27)+1).padStart(2,'0')}`,sessionSlots:[],updatedAt:100000+n}));
 }
 openHoOrganizer(p.id);toggleHoOrganizerExportComposer(true);hoOrganizerExportStyle='two';renderHoOrganizerExportComposer();
 return {defs:hoOrganizerComposerDefinitions().map(x=>x.id),counts:window.PLHoOrganizerLaneDistribution(),pages:hoOrganizerPageStates('two',hoOrganizerExportDetailMode,currentHoOrganizerComposerState()).length};
}'''
def drag(page,source_id,target_lane):
    handle=page.locator(f'[data-ho-row-drag="{source_id}"]')
    zone=page.locator(f'[data-ho-lane-drop="{target_lane}"]')
    handle.scroll_into_view_if_needed();zone.scroll_into_view_if_needed()
    hb=handle.bounding_box();zb=zone.bounding_box()
    if not hb or not zb: raise RuntimeError(f'missing drag geometry {source_id}->{target_lane}: {hb} {zb}')
    sx,sy=hb['x']+hb['width']/2,hb['y']+hb['height']/2
    tx,ty=zb['x']+zb['width']/2,zb['y']+zb['height']/2
    page.mouse.move(sx,sy);page.mouse.down();page.mouse.move((sx+tx)/2,(sy+ty)/2,steps=6);page.mouse.move(tx,ty,steps=8);page.mouse.up();page.wait_for_timeout(120)
with sync_playwright() as p:
 exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.set_default_timeout(15000);page.set_content(html,wait_until='domcontentloaded',timeout=70000)
    seed=page.evaluate(SEED)
    check(f'{width} six HO groups default to two editable columns',len(seed['defs'])==6 and seed['counts']==[3,3],seed)
    check(f'{width} tall synthetic organizer is paginated',seed['pages']>1,seed)
    pre=page.evaluate('''()=>{const h=document.querySelector('#hoExportComposerGroups [data-ho-row-drag]'),z=document.querySelector('#hoExportComposerGroups [data-ho-lane-drop]');return{handles:document.querySelectorAll('#hoExportComposerGroups [data-ho-row-drag]').length,zones:document.querySelectorAll('#hoExportComposerGroups [data-ho-lane-drop]').length,handleH:h?.getBoundingClientRect().height||0,zoneH:z?.getBoundingClientRect().height||0,previewHandles:document.querySelectorAll('#hoExportComposerPreview [data-ho-preview-drag-handle]').length,pages:document.querySelectorAll('#hoExportComposerPreview .export-live-preview-page').length,doc:document.documentElement.scrollWidth-innerWidth};}''')
    check(f'{width} list editor and paged preview both expose drag surfaces',pre['handles']==6 and pre['zones']==2 and pre['previewHandles']>=6 and pre['pages']>=2 and pre['doc']<=3 and (width>760 or (pre['handleH']>=43.5 and pre['zoneH']>=43.5)),pre)
    drag(page,'num-2',0);drag(page,'num-4',0)
    after=page.evaluate('''()=>{const s=currentHoOrganizerComposerState(),dist=window.PLHoOrganizerLaneDistribution(),g=hoOrganizerFreeGeometry('two',hoOrganizerExportDetailMode,s,'pl');return{dist,layout:Object.fromEntries(Object.entries(s.layout).map(([k,v])=>[k,{lane:v.lane,span:v.span}])),placement:[g.placements.filter(x=>x.lane===0).length,g.placements.filter(x=>x.lane===1).length],summary:document.getElementById('hoExportComposerSummary').textContent,previewHandles:document.querySelectorAll('#hoExportComposerPreview [data-ho-preview-drag-handle]').length,doc:document.documentElement.scrollWidth-innerWidth};}''')
    check(f'{width} actual pointer drag produces 5/1 lane membership',after['dist']==[5,1] and after['placement']==[5,1],after)
    check(f'{width} 5/1 assignment is visible and preview remains draggable',('第 1 列 5' in after['summary'] and '第 2 列 1' in after['summary'] and after['previewHandles']>=6 and after['doc']<=3),after)
    # Dropdown remains a non-drag fallback and must persist a deliberate 6/0 assignment.
    page.select_option('[data-ho-layout-lane="custom-ho6"]','0');page.wait_for_timeout(100)
    six=page.evaluate('''()=>({dist:window.PLHoOrganizerLaneDistribution(),placement:(()=>{const g=hoOrganizerFreeGeometry('two',hoOrganizerExportDetailMode,currentHoOrganizerComposerState(),'pl');return[g.placements.filter(x=>x.lane===0).length,g.placements.filter(x=>x.lane===1).length]})()})''')
    check(f'{width} non-drag lane selector also permits 6/0',six['dist']==[6,0] and six['placement']==[6,0],six)
    check(f'{width} no uncaught page error',not errors,errors[:5])
   except Exception:
    check(f'{width} runtime setup',False,traceback.format_exc()[-2200:])
   finally:page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'real app DOM + isolated synthetic HO records; no user data'}
(out/'round267-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND267',report['passed'],'/',report['checks'],'failures',len(report['failures']),flush=True)
if report['failures']:
 print(json.dumps(report['failures'][:6],ensure_ascii=False,indent=2),flush=True);raise SystemExit(1)
