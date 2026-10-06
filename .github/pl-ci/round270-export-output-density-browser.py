#!/usr/bin/env python3
from pathlib import Path
import json,os,re,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
current_version=re.search(r'const APP_UI_VERSION\s*=\s*"([^"]+)"',html).group(1)
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def check(name,ok,detail=None):checks.append({'check':name,'pass':bool(ok),'detail':None if ok else detail})
with sync_playwright() as p:
 exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.set_content(html,wait_until='domcontentloaded',timeout=60000)
    result=page.evaluate('''()=>{
      const make=()=>{const c=document.createElement('canvas');c.width=1080;c.height=260;return c.getContext('2d')};
      const t=hoExportTheme();
      const a=make(),b=make(),d=make();
      const compact=drawUnifiedExportHeader(a,1080,t,{eyebrow:'',title:'番茄（我）',subtitle:'',stats:['45 条','已结团 34','计划中 11','HO 10']});
      const eyebrow=drawUnifiedExportHeader(b,1080,t,{eyebrow:'PL',title:'番茄（我）',subtitle:'',stats:['45 条','已结团 34']});
      const subtitle=drawUnifiedExportHeader(d,1080,t,{eyebrow:'跑团记录',title:'测试模组',subtitle:'2026.10.01 · 已结团',stats:['1 场','4 位 PL']});
      return {compact,eyebrow,subtitle,version:APP_UI_VERSION,bodyOverflow:document.documentElement.scrollWidth-innerWidth};
    }''')
    check(f'{width} compact header is materially shorter',result['compact']<=140 and result['eyebrow']-result['compact']>=20,result)
    check(f'{width} normal subtitle header preserves old safe height',result['subtitle']>=175 and result['subtitle']<=185,result)
    check(f'{width} version and document width stay valid',result['version']==current_version and result['bodyOverflow']<=3,result)
    check(f'{width} no uncaught page errors',not errors,errors[:5])
    page.screenshot(path=str(out/f'round270-header-{width}.png'))
   except Exception:
    check(f'{width} runtime setup',False,traceback.format_exc()[-1800:])
   finally:page.close()
 finally:browser.close()
report={'version':current_version,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
(out/'round270-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND270',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'][:5],ensure_ascii=False,indent=2));raise SystemExit(1)
