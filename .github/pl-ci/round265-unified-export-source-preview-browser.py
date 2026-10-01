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
with sync_playwright() as p:
 exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.set_default_timeout(12000)
    page.set_content(html,wait_until='domcontentloaded',timeout=60000)
    page.evaluate('''()=>{localStorage.setItem(ONBOARDING_KEY,'1');const a=document.getElementById('onboardingBackdrop');if(a){a.hidden=true;a.style.setProperty('display','none','important')}document.getElementById('appRoot')?.removeAttribute('inert');const view=document.getElementById('selfIntroView');view.hidden=false;view.style.display='block';const panel=document.getElementById('selfIntroExportPanel');panel.hidden=false;panel.style.display='block';window.PLSourceExportInspection.ensure();}''')
    static=page.evaluate('''()=>({capabilityCount:Object.keys(window.PLImageExportCapabilities||{}).length,self:document.querySelectorAll('#selfIntroExportPanel [data-export-inline-preview-size]').length,planner:document.querySelectorAll('#plannerYearShowcasePanel [data-export-inline-preview-size]').length,ho:document.querySelectorAll('#hoExportComposerPanel [data-export-inline-preview-size]').length,statsOriginal:document.querySelectorAll('#statsExportSizeBtn').length,statsGeneric:document.querySelectorAll('#statsExportPanel [data-export-inline-preview-size]').length})''')
    check(f'{width} capability registry covers seven exports',static['capabilityCount']==7,static)
    check(f'{width} static panels have one inspection control without stats duplicate',static['self']==1 and static['planner']==1 and static['ho']==1 and static['statsOriginal']==1 and static['statsGeneric']==0,static)
    before=page.evaluate('''()=>{const stage=document.getElementById('selfIntroExportPreviewStage');const c=document.createElement('canvas');c.width=1080;c.height=600;const pg=document.createElement('div');pg.className='export-live-preview-page';pg.appendChild(c);stage.replaceChildren(pg);window.PLExportLivePreview.mark(stage,1);window.PLSourceExportInspection.ensure();const b=document.querySelector('#selfIntroExportPanel [data-export-inline-preview-size]'),r=c.getBoundingClientRect();return{buttonHeight:b.getBoundingClientRect().height,pressed:b.getAttribute('aria-pressed'),text:b.textContent,canvasWidth:r.width,pixels:c.width,client:stage.clientWidth,scroll:stage.scrollWidth,doc:document.documentElement.scrollWidth-innerWidth};}''')
    check(f'{width} fit view is responsive and control is touch-sized',before['buttonHeight']>=43.5 and before['pressed']=='false' and before['text']=='原尺寸查看' and before['canvasWidth']<=before['client']+2 and before['doc']<=3,before)
    page.click('#selfIntroExportPanel [data-export-inline-preview-size]')
    native=page.evaluate('''()=>{const stage=document.getElementById('selfIntroExportPreviewStage'),c=stage.querySelector('canvas'),b=document.querySelector('#selfIntroExportPanel [data-export-inline-preview-size]'),r=c.getBoundingClientRect();return{mode:stage.dataset.previewSize,pressed:b.getAttribute('aria-pressed'),text:b.textContent,canvasWidth:r.width,pixels:c.width,client:stage.clientWidth,scroll:stage.scrollWidth,doc:document.documentElement.scrollWidth-innerWidth};}''')
    check(f'{width} native view preserves canvas pixels and scrolls inside preview',native['mode']=='native' and native['pressed']=='true' and native['text']=='适应宽度' and abs(native['canvasWidth']-native['pixels'])<2.5 and native['scroll']>native['client'] and native['doc']<=3,native)
    page.click('#selfIntroExportPanel [data-export-inline-preview-size]')
    restored=page.evaluate('''()=>{const s=document.getElementById('selfIntroExportPreviewStage'),c=s.querySelector('canvas'),b=document.querySelector('#selfIntroExportPanel [data-export-inline-preview-size]');return{mode:s.dataset.previewSize,text:b.textContent,w:c.getBoundingClientRect().width,client:s.clientWidth,doc:document.documentElement.scrollWidth-innerWidth};}''')
    check(f'{width} fit mode restores responsive preview',restored['mode']=='fit' and restored['text']=='原尺寸查看' and restored['w']<=restored['client']+2 and restored['doc']<=3,restored)
    dynamic=page.evaluate('''async()=>{for(const pair of [['recordShowcaseBackdrop','recordShowcasePreview'],['entityShowcaseBackdrop','entityShowcasePreview'],['recordsRecapBackdrop','recordsRecapPreview']]){const panel=document.createElement('div');panel.id=pair[0];panel.innerHTML='<div class="export-composer-controls"></div><aside class="export-preview-pane"><div class="export-preview-head"><div><strong>实时预览</strong></div></div><div class="export-preview-stage" id="'+pair[1]+'"></div></aside>';document.body.appendChild(panel);}await new Promise(r=>setTimeout(r,0));window.PLSourceExportInspection.ensure();return{record:document.querySelectorAll('#recordShowcaseBackdrop [data-export-inline-preview-size]').length,recap:document.querySelectorAll('#recordsRecapBackdrop [data-export-inline-preview-size]').length,entity:document.querySelectorAll('#entityShowcaseBackdrop [data-export-inline-preview-size]').length};}''')
    check(f'{width} asynchronously inserted export dialogs receive inspection controls',dynamic['record']==1 and dynamic['recap']==1 and dynamic['entity']==1,dynamic)
    check(f'{width} no uncaught page error',not errors,errors[:5])
   except Exception:
    check(f'{width} runtime setup',False,traceback.format_exc()[-1800:])
   finally:page.close()
 finally:browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'real app DOM + isolated synthetic canvas; no user data'}
(out/'round265-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND265',report['passed'],'/',report['checks'],'failures',len(report['failures']),flush=True)
if report['failures']:
 print(json.dumps(report['failures'][:5],ensure_ascii=False,indent=2),flush=True);raise SystemExit(1)
