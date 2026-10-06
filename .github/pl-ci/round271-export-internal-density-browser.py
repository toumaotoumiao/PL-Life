#!/usr/bin/env python3
from pathlib import Path
import json,os,re,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
version=re.search(r'const APP_UI_VERSION\s*=\s*"([^"]+)"',html).group(1)
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m): return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def check(name,ok,detail=None): checks.append({'check':name,'pass':bool(ok),'detail':None if ok else detail})
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
                  const t=hoExportTheme(),c=document.createElement('canvas');c.width=900;c.height=520;const ctx=c.getContext('2d');ctx.fillStyle=t.bg;ctx.fillRect(0,0,c.width,c.height);
                  const groupH=drawRunExportGroupHead(ctx,20,20,860,{title:'HO1',subtitle:'',summary:'5 条',meta:'已结团 4 · 计划 1',accent:t.accent,soft:t.surface2},t);
                  const hoH=drawHoEntryCard(ctx,20,92,420,{status:{label:'已结团'},role:'PC',moduleName:'测试模组',pcName:'测试角色',tableName:'测试桌',dateText:'2026-10-02'},t);
                  const kpH=drawKpExportEntry(ctx,460,92,420,{status:{label:'已结团'},dateText:'2026-10-02',plCount:4,tableName:'测试桌',kind:'record'},t);
                  const panelBody=drawRecordShowcasePanelBase(ctx,20,180,860,190,t,'本桌概览','');
                  const dummy={schedule:['2026-10-02'],cast:[{name:'PL01'}],logs:[],reflection:[]};
                  document.body.appendChild(c);c.style.width='min(100%,900px)';c.style.height='auto';c.style.display='block';c.style.margin='16px auto';
                  return {groupH,hoH,kpH,panelHead:panelBody-180,summaryFull:recordShowcaseBlockHeight('summary',1000,dummy),summaryHalf:recordShowcaseBlockHeight('summary',500,dummy),version:APP_UI_VERSION,overflow:document.documentElement.scrollWidth-innerWidth};
                }''')
                check(f'{width} compact group/card geometry matches layout', result['groupH']==58 and result['hoH']==66 and result['kpH']==62, result)
                check(f'{width} record panel compact geometry matches measurement', result['panelHead']==58 and result['summaryFull']==198 and result['summaryHalf']==264, result)
                check(f'{width} current version and page width remain valid',result['version']==version and result['overflow']<=3,result)
                check(f'{width} no uncaught page errors',not errors,errors[:5])
                page.screenshot(path=str(out/f'round271-density-{width}.png'),full_page=False)
            except Exception:
                check(f'{width} runtime setup',False,traceback.format_exc()[-1800:])
            finally: page.close()
    finally: browser.close()
report={'version':version,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
(out/'round271-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND271',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
    print(json.dumps(report['failures'][:6],ensure_ascii=False,indent=2));raise SystemExit(1)
