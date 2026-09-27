"""Actual HTML + isolated synthetic canvases. No user archives, no live origin, no saved files."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json,os,traceback
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round164-final-inspection'
out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def inline(match):
    return '<script>\n'+re.sub(r'</script','<\\/script',(root/match.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',inline,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
results=[];failures=[]
def check(label,cond,data=None):
    results.append({'name':label,'ok':bool(cond)})
    if not cond:failures.append({'name':label,'data':data})
def measure(page):
    return page.evaluate('''()=>{const s=document.getElementById('uxExportPreviewStage'),b=document.getElementById('uxExportPreviewSizeBtn'),canvases=[...s.querySelectorAll('canvas')];return{mode:s.dataset.previewSize,button:b.textContent,pressed:b.getAttribute('aria-pressed'),height:b.getBoundingClientRect().height,stageWidth:s.getBoundingClientRect().width,stageScroll:s.scrollWidth,scrollLeft:s.scrollLeft,docOverflow:document.documentElement.scrollWidth-innerWidth,pages:canvases.length,canvases:canvases.map(c=>({native:c.width,display:c.getBoundingClientRect().width,hash:c.toDataURL()})),layout:document.querySelector('[data-ux-export-layout][aria-pressed="true"]')?.dataset.uxExportLayout};}''')
with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
    elif Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
    browser=p.chromium.launch(**opts)
    try:
        for width in (375,1280):
            page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            try:
                page.set_content(html,wait_until='domcontentloaded',timeout=60000)
                page.evaluate('''()=>{const b=document.getElementById('onboardingBackdrop');if(b){b.hidden=true;b.style.setProperty('display','none','important')}document.getElementById('appRoot')?.removeAttribute('inert');localStorage.setItem('trpg_planner_export_layout_v8188','pages');const make=(w,h,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.fillStyle='#222';ctx.font='28px sans-serif';ctx.fillText('合成测试文字',15,40);return c};const a=make(900,1100,'#faf0dc'),b2=make(900,1500,'#e0f5ef');window.__testSources=[a,b2];window.PLUnifiedExportPreview([a,b2],'合成最终图片','测试.png','仅用于视觉验收','', {longCanvasBuilder:()=>{const c=make(900,2650,'#faf0dc');return c;}})}''')
                fit=measure(page)
                check(f'{width} initial fit pages',fit['mode']=='fit' and fit['pages']==2 and fit['layout']=='pages',fit)
                check(f'{width} fit keeps document width',fit['docOverflow']<=3 and all(x['display']<=fit['stageWidth']+3 for x in fit['canvases']),fit)
                check(f'{width} 44px target',fit['height']>=43.5,fit)
                page.locator('#uxExportPreviewSizeBtn').click()
                native=measure(page)
                check(f'{width} native 1:1 pixels',native['mode']=='native' and native['pressed']=='true' and native['button']=='适应宽度' and all(abs(x['native']-x['display'])<=2 for x in native['canvases']),native)
                check(f'{width} native internal scroll only',(native['stageScroll']>native['stageWidth'] if any(x['native']>native['stageWidth']-12 for x in native['canvases']) else native['stageScroll']<=native['stageWidth']+3) and native['docOverflow']<=3,native)
                check(f'{width} pixels unchanged',fit['canvases']==[{**item,'display':other['display']} for item,other in zip(native['canvases'],fit['canvases'])],{'fit':fit,'native':native})
                page.screenshot(path=str(out/f'native-{width}.png'))
                page.evaluate('''()=>{const s=document.getElementById('uxExportPreviewStage');s.scrollLeft=125;}''')
                page.locator('[data-ux-export-layout="long"]').click()
                long=measure(page)
                check(f'{width} mode preserved after long switch',long['mode']=='native' and long['layout']=='long' and long['pages']==1 and abs(long['canvases'][0]['native']-long['canvases'][0]['display'])<=2,long)
                check(f'{width} long remains inside modal',long['docOverflow']<=3 and (long['stageScroll']>long['stageWidth'] if long['canvases'][0]['native']>long['stageWidth']-12 else long['stageScroll']<=long['stageWidth']+3),long)
                page.screenshot(path=str(out/f'long-{width}.png'))
                page.locator('[data-ux-export-layout="pages"]').click()
                back=measure(page)
                check(f'{width} pages retain native mode and canvases',back['mode']=='native' and back['pages']==2 and all(a['hash']==b['hash'] for a,b in zip(fit['canvases'],back['canvases'])),back)
                page.locator('#uxExportPreviewSizeBtn').click()
                restored=measure(page)
                check(f'{width} fit mode restored',restored['mode']=='fit' and restored['pressed']=='false' and restored['docOverflow']<=3 and restored['stageScroll']<=restored['stageWidth']+3,restored)
                check(f'{width} no runtime errors',not errors,errors)
            except Exception as e:
                failures.append({'name':f'exception-{width}','data':traceback.format_exc()})
                page.screenshot(path=str(out/f'FAIL-{width}.png'))
            finally:page.close()
    finally:browser.close()
(out/'round164-final-inspection.json').write_text(json.dumps({'checks':len(results),'passed':sum(x['ok'] for x in results),'failures':failures},ensure_ascii=False,indent=2))
print('Round164 final export pixel-inspection:',sum(x['ok'] for x in results),'/',len(results),'passed, failures',len(failures))
if failures:print(json.dumps(failures[:2],ensure_ascii=False)[:2000]);raise SystemExit(1)
