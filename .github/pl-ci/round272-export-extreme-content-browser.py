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
# expose recap draw/measure only inside this browser test harness
html=html.replace('window.PLRecordsRecapOpen=open;','window.PLRecordsRecapOpen=open;window.__recap272={measureRow,drawRow};',1)
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
                  const t=hoExportTheme();
                  function probe(draw,h,y=20){const c=document.createElement('canvas');c.width=900;c.height=Math.ceil(h+y+40);const ctx=c.getContext('2d'),seen=[];const native=ctx.fillText.bind(ctx);ctx.fillText=(text,x,yy,...rest)=>{seen.push({text:String(text),y:Number(yy)});return native(text,x,yy,...rest)};draw(ctx);return{joined:seen.map(x=>x.text).join(''),maxY:Math.max(0,...seen.map(x=>x.y)),canvas:c};}
                  const meta='META极长角色信息ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(7);
                  const castData={state:{nameMode:'public'},cast:[{name:'PL 超长测试',meta,kind:'pl'}],schedule:[],logs:[],reflection:[]};
                  const castH=recordShowcaseBlockHeight('cast',430,castData);
                  const cast=probe(ctx=>drawRecordShowcaseCast(ctx,20,20,430,castH,t,castData),castH);
                  const label='LOG标题极长ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(8),url='https://example.invalid/'+('very-long-segment-0123456789/'.repeat(18));
                  const logData={logs:[{label,url}],schedule:[],cast:[],reflection:[]};
                  const logH=recordShowcaseBlockHeight('logs',430,logData);
                  const logs=probe(ctx=>drawRecordShowcaseLogs(ctx,20,20,430,logH,t,logData),logH);
                  const recapRow={module:'极端模组',date:'2026-10-02',table:'测试桌',status:'已结团',role:'我做 PL',cast:'',logs:[{label,url}],notes:''};
                  const rc=document.createElement('canvas'),rctx=rc.getContext('2d');
                  const recapH=window.__recap272.measureRow(rctx,recapRow,1080),seen=[];const native=rctx.fillText.bind(rctx);rctx.fillText=(text,x,yy,...rest)=>{seen.push({text:String(text),y:Number(yy)});return native(text,x,yy,...rest)};
                  window.__recap272.drawRow(rctx,recapRow,34,20,1012,recapH,t,0);
                  return {castH,castJoined:cast.joined,castMaxY:cast.maxY,logH,logJoined:logs.joined,logMaxY:logs.maxY,recapH,recapJoined:seen.map(x=>x.text).join(''),recapMaxY:Math.max(0,...seen.map(x=>x.y)),meta,label,url,version:APP_UI_VERSION,overflow:document.documentElement.scrollWidth-innerWidth,errors:[]};
                }''')
                check(f'{width} long PC/HO metadata is fully preserved',result['meta'] in result['castJoined'],{'h':result['castH'],'tail':result['castJoined'][-180:]})
                check(f'{width} long PC/HO metadata stays inside measured block',result['castMaxY']<=20+result['castH']-8,{'h':result['castH'],'maxY':result['castMaxY']})
                check(f'{width} long Log title and URL are fully preserved',result['label'] in result['logJoined'] and result['url'] in result['logJoined'],{'h':result['logH'],'joinedTail':result['logJoined'][-220:]})
                check(f'{width} long Log content stays inside measured block',result['logMaxY']<=20+result['logH']-8,{'h':result['logH'],'maxY':result['logMaxY']})
                check(f'{width} integrated recap keeps long Log title/URL within measured row',result['label'] in result['recapJoined'] and result['url'] in result['recapJoined'] and result['recapMaxY']<=20+result['recapH'],{'h':result['recapH'],'maxY':result['recapMaxY']})
                check(f'{width} runtime version/page width/no uncaught error',result['version']==version and result['overflow']<=3 and not errors,{'version':result['version'],'overflow':result['overflow'],'errors':errors[:4]})
                page.screenshot(path=str(out/f'round272-extreme-{width}.png'),full_page=False)
            except Exception:
                check(f'{width} runtime setup',False,traceback.format_exc()[-1800:])
            finally: page.close()
    finally: browser.close()
report={'version':version,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
(out/'round272-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND272',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
    print(json.dumps(report['failures'][:6],ensure_ascii=False,indent=2));raise SystemExit(1)
