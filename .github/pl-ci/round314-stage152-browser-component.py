from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[2]
src=(root/'index.html').read_text('utf8')
a=src.index('function globalSearchTargetExists(action) {');b=src.index('/* 设置搜索 */',a)
code=src[a:b]
bootstrap='''<style>
body { margin: 0; font: 15px system-ui; overflow-x: hidden; }
nav { display:flex; gap:8px; min-height:45px; align-items:center; padding:8px; }
nav input { flex:1; min-width:80px; min-height:36px; }
.global-search-spotlight { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:16px; border:1px solid #999; box-sizing:border-box; max-width:100%; }
.global-search-spotlight div{flex:1 1 160px; min-width:0; overflow-wrap:anywhere;}
.global-search-spotlight span{display:block;}
[data-global-search-spotlight-close]{min-height:42px; min-width:44px;}
</style>
<nav><label for="old-filter">旧筛选</label><input id="old-filter" value="my-pl"><label for="search-query">搜索</label><input id="search-query" value="long-tail"></nav>
<div id="globalSearchBackdrop" hidden></div><section id="profilesView"></section><section id="pcsView"></section><section id="modulesView"></section><section id="plansView"></section><section id="recordsView"></section><button id="result" type="button">打开搜索结果</button>
<script>
let globalSearchRows=[],shareModeEnabled=false,profiles=[{id:'p1',name:'可公开的PL',contact:'PRIVATE-CONTACT-77'}],pcs=[{id:'c1',name:'测试PC'}],modules=[{id:'m1',name:'测试模组'}],runPlans=[{id:'plan1',moduleName:'测试模组'}],runRecords=[{id:'r1',moduleName:'测试模组'}];
let calls=[],canOpenPc=true,els={profilesView:document.getElementById('profilesView'),pcsView:document.getElementById('pcsView'),modulesView:document.getElementById('modulesView'),plansView:document.getElementById('plansView'),recordsView:document.getElementById('recordsView')};
function syncModalPageScrollLock(){calls.push('scroll-lock')};function isBlacklistedProfile(){return false};function showToast(s){calls.push('toast:'+s)};function renderGlobalSearch(){calls.push('render')};function closeGlobalSearch(){calls.push('close')};
function switchView(v,o){calls.push('view:'+v+':'+String(o.restoreScroll))};function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
function openEditor(id){calls.push('pl:'+id);return true};function openPcEditor(id){calls.push('pc:'+id);return canOpenPc?undefined:false};function openNativeModuleEditor(id){calls.push('mod:'+id);return true};function openPlanEditor(id){calls.push('plan:'+id);return true};
function setRunRecordCollapsed(id){calls.push('uncollapse:'+id)};function recordDetailReveal(id){calls.push('reveal:'+id);return true};function scrollRecordCardIntoView(id){calls.push('record-scroll:'+id)};
</script>'''
with sync_playwright() as p:
 browser_kwargs={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
 if Path('/usr/bin/chromium').exists():browser_kwargs['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**browser_kwargs)
 results=[]
 for width in [320,375,390,430,768,1024,1280,1440]:
  page=b.new_page(viewport={'width':width,'height':800},device_scale_factor=1)
  page.set_content(bootstrap)
  page.add_script_tag(content=code)
  page.evaluate("document.querySelector('#result').addEventListener('click',()=>window.lastActivation=activateGlobalSearchResult(0))")
  # Normal five-way result access by ID, not list index or prior filter.
  for view,id in [('profiles','p1'),('pcs','c1'),('modules','m1'),('plans','plan1'),('records','r1')]:
   page.evaluate('(v) => {shareModeEnabled=false; globalSearchRows=[{type:"item",title:"Visible",action:{view:v.view,id:v.id}}]}',{'view':view,'id':id})
   page.locator('#result').click()
   assert page.evaluate('window.lastActivation') is True,(width,view)
  assert page.locator('#old-filter').input_value()=='my-pl'
  assert page.locator('#search-query').input_value()=='long-tail'
  # Editor refuses to open, action must return failure.
  page.evaluate('canOpenPc=false;globalSearchRows=[{action:{view:"pcs",id:"c1"}}]')
  page.locator('#result').click()
  assert page.evaluate('window.lastActivation') is False,width
  assert page.locator('#globalSearchBackdrop').evaluate('(el)=>el.hidden') is False,width
  # Share mode must not open editors or echo private values; real DOM close button.
  page.evaluate('''()=>{calls=[];shareModeEnabled=true; globalSearchRows=[{type:'PL',title:'公开玩家名称',action:{view:'profiles',id:'p1'}}]}''')
  page.locator('#result').click()
  assert page.evaluate('window.lastActivation') is True,width
  assert page.locator('[data-global-search-spotlight]').count()==1
  assert '公开玩家名称' in page.locator('[data-global-search-spotlight]').inner_text()
  assert 'PRIVATE-CONTACT-77' not in page.locator('[data-global-search-spotlight]').inner_text()
  assert page.evaluate("calls.every(c=>!c.startsWith('pl:'))"),width
  page.locator('[data-global-search-spotlight-close]').click()
  assert page.locator('[data-global-search-spotlight]').count()==0
  # Ensure test panel fits 320 width in real Chromium DOM and close target is reachable.
  page.evaluate("globalSearchRows=[{type:'PL',title:'公开玩家名称',action:{view:'profiles',id:'p1'}}];activateGlobalSearchResult(0)")
  spot=page.locator('[data-global-search-spotlight]')
  box=spot.bounding_box()
  assert box and box['x']>=0 and box['x']+box['width']<=width+1,(width,box)
  close=page.locator('[data-global-search-spotlight-close]').bounding_box()
  assert close and close['width']>=44 and close['height']>=40,(width,close)
  results.append({'viewport':width,'globalIdRoutes':'5/5','blockedEditor':'correctFailure','filters':'unchanged','shareReadOnly':'passed','closeButton':'operable','spotlightFitsViewport':'yes'})
  page.close()
 b.close()
print(json.dumps({'scope':'Real Chromium isolated component; NOT full application or real device','results':results},ensure_ascii=False))
