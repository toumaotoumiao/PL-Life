"""Actual v228 page: inspect native-size statistics preview and final render trace.
Only isolated synthetic fixtures; no personal data or live site."""
from pathlib import Path
import re,json,os,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
report=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round161-stats-preview'
report.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
seed_source=(root/'.github/pl-ci/round158-toolbar-rule-runtime.py').read_text()
SEED=re.search(r"SEED='''(.*?)'''",seed_source,re.S).group(1)
results=[];issues=[]
def check(label,ok,detail=None):
 results.append({'check':label,'ok':bool(ok)})
 if not ok:issues.append({'check':label,'detail':detail})
def measure(page):
 return page.evaluate('''()=>{
 const stage=document.getElementById('statsExportPreviewStage'),button=document.getElementById('statsExportSizeBtn'),surface=[...stage.querySelectorAll('.export-preview-canvas-surface')],pages=[...stage.querySelectorAll('.export-live-preview-page')];
 return {mode:stage.dataset.exportLiveMode,size:stage.dataset.previewSize||'fit',pageCount:pages.length,canvasCount:stage.querySelectorAll('canvas').length,handles:stage.querySelectorAll('[data-stats-preview-drag-handle]').length,client:stage.clientWidth,scroll:stage.scrollWidth,scrollLeft:stage.scrollLeft,
  button:button.textContent,pressed:button.getAttribute('aria-pressed'),buttonHeight:button.getBoundingClientRect().height,docOverflow:document.documentElement.scrollWidth-innerWidth,
  surfaces:surface.map(e=>{let r=e.getBoundingClientRect(),canvas=e.querySelector('canvas'),cr=canvas.getBoundingClientRect();return {w:r.width,cw:cr.width,pixels:canvas.width,left:r.left,overlay:e.querySelector('.export-preview-drag-layer')?.getBoundingClientRect().width||0};})};
 }''')
def trace(page,expression):
 return page.evaluate('''async expression=>{
   const original=drawStatsStoryBlock,items=[];
   drawStatsStoryBlock=function(ctx,id,x,y,w,h,theme,data,segment){items.push([id,Math.round(x),Math.round(y),Math.round(w),Math.round(h),JSON.stringify(segment||null)]);return original.apply(this,arguments)};
   try{await (new Function('return (async()=>{' + expression + '})()'))();return items;}finally{drawStatsStoryBlock=original;}
 }''',expression)
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']}
 if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
 elif Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**opts)
 for width in (375,1280):
  if os.environ.get('PL_ROUND161_WIDTH') and width!=int(os.environ['PL_ROUND161_WIDTH']):continue
  page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_default_timeout(12000)
   page.set_content(html,wait_until='domcontentloaded',timeout=60000)
   page.evaluate('''()=>{const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert')}''')
   page.evaluate(SEED)
   page.evaluate('''()=>{localStorage.setItem('trpg_planner_export_layout_v8188','pages');switchView('stats',{historyMode:'none',restoreScroll:false});toggleStatsExportCenter(true)}''')
   fit=measure(page);check(f'{width} fit view renders pages and handles',fit['pageCount']>=2 and fit['handles']>=4,fit)
   check(f'{width} fit viewport does not overflow',fit['docOverflow']<=3,fit)
   check(f'{width} touch-size preview control',fit['buttonHeight']>=43.5,fit)
   page.screenshot(path=str(report/f'fit-{width}.png'))
   page.evaluate("document.getElementById('statsExportSizeBtn').click()")
   native=measure(page)
   check(f'{width} native mode toggled',native['size']=='native' and native['pressed']=='true' and native['button']=='适应宽度',native)
   check(f'{width} every native canvas and drag overlay aligns',bool(native['surfaces']) and all(abs(v['w']-v['pixels'])<2.5 and abs(v['cw']-v['w'])<2.5 and abs(v['overlay']-v['w'])<2.5 for v in native['surfaces']),native)
   check(f'{width} native view scrolls internally not document',native['scroll']>native['client'] and native['docOverflow']<=3,native)
   page.screenshot(path=str(report/f'native-{width}.png'))
   page.evaluate("document.getElementById('statsExportPreviewStage').scrollIntoView({block:'center'})")
   page.screenshot(path=str(report/f'native-detail-{width}.png'))
   page.evaluate('''()=>{const s=document.getElementById('statsExportPreviewStage');s.scrollLeft=Math.min(120,s.scrollWidth-s.clientWidth)}''')
   before=measure(page)
   page.dispatch_event('[data-stats-export-move="1"][data-stats-export-id="calendar"]','click')
   after=measure(page)
   check(f'{width} reorder keeps native mode, pages, overlays',after['size']=='native' and after['pageCount']>=2 and after['handles']>=4 and all(abs(v['w']-v['pixels'])<2.5 for v in after['surfaces']),after)
   check(f'{width} reorder maintains horizontal position',abs(after['scrollLeft']-before['scrollLeft'])<=3,{'before':before['scrollLeft'],'after':after['scrollLeft']})
   # Directly compare the layout/draw commands from the source preview and final preview.
   print('round161 width',width,'before trace',flush=True)
   source=trace(page,'renderStatsExportCenter()')
   print('round161 width',width,'before final',flush=True)
   final=trace(page,'await exportStatsImage()')
   final_info=page.evaluate('''()=>({open:!document.getElementById('uxExportPreviewBackdrop').hidden,pages:document.querySelectorAll('#uxExportPreviewStage canvas').length})''')
   check(f'{width} page source/final draw geometry identical',len(source)>3 and source==final,{'source':source[:4],'final':final[:4],'counts':[len(source),len(final)]})
   check(f'{width} final preview opens for paged layout',final_info['open'] and final_info['pages']>=2,final_info)
   page.evaluate("document.getElementById('uxExportPreviewCancel')?.click()")
   page.evaluate('''()=>{localStorage.setItem('trpg_planner_export_layout_v8188','long');renderStatsExportCenter()}''')
   print('round161 width',width,'before long',flush=True)
   long=measure(page)
   check(f'{width} continuous preview keeps native inspection',long['mode']=='long' and long['pageCount']==1 and long['size']=='native' and long['handles']>0 and all(abs(v['w']-v['pixels'])<2.5 for v in long['surfaces']),long)
   page.screenshot(path=str(report/f'long-{width}.png'))
   long_source=trace(page,'renderStatsExportCenter()')
   long_final=trace(page,'await exportStatsImage()')
   check(f'{width} long source/final use same continuous blocks',len(long_source)>3 and long_final[-len(long_source):]==long_source,{'source':long_source[:3],'finalTail':long_final[-len(long_source):][:3]})
   page.evaluate("document.getElementById('uxExportPreviewCancel')?.click()")
   page.evaluate('''()=>{setPrivacyMaskExplicit(true);renderStatsExportCenter()}''')
   masked=page.evaluate('''()=>({active:privacyMaskEnabled,disabled:document.getElementById('statsExportNameMode').disabled,mode:document.getElementById('statsExportPreviewStage').dataset.exportLiveMode})''')
   check(f'{width} privacy is enforced during continuous preview',masked['active'] and masked['disabled'] and masked['mode']=='long',masked)
   masked_source=trace(page,'renderStatsExportCenter()')
   masked_final=trace(page,'await exportStatsImage()')
   check(f'{width} masked long source/final geometry remains aligned',len(masked_source)>3 and masked_final[-len(masked_source):]==masked_source,{'source':len(masked_source),'final':len(masked_final)})
   page.evaluate("document.getElementById('uxExportPreviewCancel')?.click()")
   page.evaluate("document.getElementById('statsExportSizeBtn').click()")
   restored=measure(page)
   check(f'{width} fit restores responsive width',restored['size']=='fit' and restored['pressed']=='false' and restored['scroll']<=restored['client']+3 and restored['docOverflow']<=3,restored)
   check(f'{width} no uncaught script error',not errors,errors[:4])
  except Exception:
   issues.append({'check':f'{width} setup/runtime exception','detail':traceback.format_exc()[-1600:]})
   try:page.screenshot(path=str(report/f'FAIL-{width}.png'))
   except Exception:pass
  finally:page.close()
 browser.close()
data={'version':re.search(r'const APP_UI_VERSION = "([\d.]+)";',html).group(1),'checks':len(results),'failures':issues,'kind':'real app source/final graphics commands, isolated synthetic data; no real user data'}
(report/'round161-stats-preview.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
print('ROUND161:',len(results),'checks,',len(issues),'failures',flush=True)
for issue in issues[:5]:print('FAIL',json.dumps(issue,ensure_ascii=False)[:500],flush=True)
if issues:raise SystemExit(1)
