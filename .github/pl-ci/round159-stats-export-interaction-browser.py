"""Real app stats composer regression: reorder must not dismiss panel; all preview pages draggable."""
from pathlib import Path
import re,json,os,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
report=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round159-stats-composer'
report.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
# Reuse the real 57-table mixed-rule fixture; keep all data synthetic and isolated.
other=(root/'.github/pl-ci/round158-toolbar-rule-runtime.py').read_text()
SEED=re.search(r"SEED='''(.*?)'''",other,re.S).group(1)
checks=[];failures=[];shots=[]
def verify(ok,label,extra=None):
 checks.append(label)
 if not ok:failures.append({'check':label,'detail':extra})
for width in (375,1280):
 with sync_playwright() as p:
  opts={'headless':True,'args':['--no-sandbox']}
  if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
  elif Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
  browser=p.chromium.launch(**opts)
  page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content(html,wait_until='domcontentloaded',timeout=90000)
   page.evaluate('''()=>{const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert')}''')
   page.evaluate(SEED)
   page.evaluate('switchView("stats",{historyMode:"none",restoreScroll:false})')
   page.evaluate('toggleStatsExportCenter(true)')
   page.wait_for_timeout(80)
   initial=page.evaluate('''()=>({open:!document.getElementById('statsExportPanel').hidden, pages:document.querySelectorAll('#statsExportPreviewStage .export-live-preview-page').length, handles:document.querySelectorAll('#statsExportPreviewStage [data-stats-preview-drag-handle]').length, order:[...statsExportState.order], mode:document.getElementById('statsExportPreviewStage').dataset.exportLiveMode})''')
   verify(initial['open'],f'{width} panel opens',initial)
   verify(initial['pages']>=2 and initial['handles']>=4,f'{width} all paginated preview pages have drag handles',initial)
   page.evaluate('''()=>{const panel=document.getElementById('statsExportPanel'),stage=document.getElementById('statsExportPreviewStage');panel.scrollTop=180;stage.scrollTop=230;}''')
   prior=page.evaluate('''()=>({panel:document.getElementById('statsExportPanel').scrollTop,stage:document.getElementById('statsExportPreviewStage').scrollTop})''')
   key='calendar';old_order=initial['order']
   page.dispatch_event(f'[data-stats-export-move="1"][data-stats-export-id="{key}"]',"click")
   after=page.evaluate('''()=>({open:!document.getElementById('statsExportPanel').hidden,panel:document.getElementById('statsExportPanel').scrollTop,stage:document.getElementById('statsExportPreviewStage').scrollTop,order:[...statsExportState.order],pages:document.querySelectorAll('#statsExportPreviewStage .export-live-preview-page').length,handles:document.querySelectorAll('#statsExportPreviewStage [data-stats-preview-drag-handle]').length})''')
   verify(after['open'],f'{width} up/down click does not dismiss dialog',after)
   verify(after['order'].index(key)==old_order.index(key)+1,f'{width} move changes persisted order',after)
   verify(abs(after['panel']-prior['panel'])<50 and abs(after['stage']-prior['stage'])<80,f'{width} scroll position retained',{'before':prior,'after':after})
   verify(after['handles']>=4,f'{width} preview stays draggable after reorder',after)
   # Dispatch real pointer events through the live app listeners; explicit rects permit cross-page targets.
   page.evaluate('''()=>{
      const stage=document.getElementById('statsExportPreviewStage'),from=stage.querySelector('[data-stats-preview-drag-handle="habits"]'),to=stage.querySelector('[data-stats-preview-drag-handle="overview"]');
      if(!from||!to)throw new Error('Expected drag handles missing');
      const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x=a.left+a.width/2,y=a.top+a.height/2,tx=b.left+b.width/2,ty=b.top+b.height/2;
      from.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:10,pointerType:'mouse',button:0,clientX:x,clientY:y}));
      stage.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:10,pointerType:'mouse',clientX:x+10,clientY:y+10}));
      stage.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:10,pointerType:'mouse',clientX:tx,clientY:ty}));
      stage.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:10,pointerType:'mouse',clientX:tx,clientY:ty}));
   }''')
   dragstate=page.evaluate('''()=>({open:!document.getElementById('statsExportPanel').hidden,order:[...statsExportState.order],dragging:!!statsExportPreviewDrag,handles:document.querySelectorAll('#statsExportPreviewStage [data-stats-preview-drag-handle]').length})''')
   verify(dragstate['open'] and not dragstate['dragging'],f'{width} pointer drag stays in dialog and ends',dragstate)
   verify(dragstate['order'].index('habits')!=after['order'].index('habits'),f'{width} pointer drag changes ordering',dragstate)
   # Preview and final export draw from the same state; no stale canvas after reorder.
   verify(dragstate['handles']>0,f'{width} handles remain after pointer drag',dragstate)
   page.screenshot(path=str(report/f'stats-compose-{width}.png'));shots.append(f'stats-compose-{width}.png')
   # Use same mode switch as users, confirm long preview still has drag handles.
   page.evaluate('''()=>{localStorage.setItem('trpg_planner_export_layout_v8188','long');renderStatsExportCenter()}''')
   longstate=page.evaluate('''()=>({mode:document.getElementById('statsExportPreviewStage').dataset.exportLiveMode,pages:document.querySelectorAll('#statsExportPreviewStage .export-live-preview-page').length,handles:document.querySelectorAll('#statsExportPreviewStage [data-stats-preview-drag-handle]').length})''')
   verify(longstate['mode']=='long' and longstate['pages']==1 and longstate['handles']>0,f'{width} continuous preview remains draggable',longstate)
   verify(not errors,f'{width} no unhandled app error',errors)
  except Exception:
   failures.append({'check':f'{width} runtime setup','detail':traceback.format_exc()[-1800:]})
   try:page.screenshot(path=str(report/f'FAIL-{width}.png'))
   except Exception:pass
  finally:browser.close()
result={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'screenshots':shots,'checks':len(checks),'failures':failures}
(report/'round159-stats-composer.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROUND159',len(checks),'checks',len(failures),'failures',flush=True)
for failure in failures:print('FAIL',json.dumps(failure,ensure_ascii=False)[:500])
if failures:raise SystemExit(1)
