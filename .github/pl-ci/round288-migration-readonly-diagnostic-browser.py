#!/usr/bin/env python3
from pathlib import Path
import json, os, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
checks=[]
def rec(label,ok,detail=''): checks.append({'test':label,'pass':bool(ok),'detail':detail})
class Quiet(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(root),**k)
    def log_message(self,*a): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Quiet);threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
try:
  with sync_playwright() as p:
    exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
    ctx=browser.new_context(service_workers='block',viewport={'width':390,'height':844})
    page=ctx.new_page();page.goto(base+'/module-tools.html',wait_until='domcontentloaded',timeout=120000)
    page.evaluate("""async()=>{
      const del=n=>new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()});
      for(const n of ['tomato_pl_pc_media_v1','tomato_trpg_recovery_v1','tomato_pl_primary_mirror_v1'])await del(n);
      const open=(n,v,up)=>new Promise((ok,bad)=>{const q=indexedDB.open(n,v);q.onupgradeneeded=()=>up(q.result);q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
      let db=await open('tomato_pl_pc_media_v1',2,db=>{const m=db.createObjectStore('media',{keyPath:'id'});m.createIndex('pcId','pcId');m.createIndex('createdAt','createdAt');db.createObjectStore('pcWorkbooks',{keyPath:'pcId'});});
      let tx=db.transaction('media','readwrite');tx.objectStore('media').put({id:'secret-media',pcId:'secret-pc',name:'SECRET_IMAGE_NAME'});await new Promise((ok,bad)=>{tx.oncomplete=ok;tx.onerror=tx.onabort=()=>bad(tx.error)});db.close();
      db=await open('tomato_trpg_recovery_v1',1,db=>{const s=db.createObjectStore('snapshots',{keyPath:'id'});s.createIndex('createdAt','createdAt');});
      tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({id:'secret-snapshot',createdAt:1,payload:{name:'SECRET_PL_NAME'}});await new Promise((ok,bad)=>{tx.oncomplete=ok;tx.onerror=tx.onabort=()=>bad(tx.error)});db.close();
    }""")
    page.goto(base+'/storage-diagnostic.html',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function("document.querySelector('#status')?.textContent.includes('检查完成')",timeout=120000)
    text=page.locator('#result').inner_text()
    page.screenshot(path=str(out/'round288-storage-diagnostic-390.png'),full_page=True)
    rec('standalone diagnostic reports old PC DB without upgrading', 'PC附件库：v2 → 目标 v3' in text,text)
    rec('standalone diagnostic reports old recovery DB without upgrading', '恢复点库：v1 → 目标 v2' in text,text)
    rec('diagnostic output contains no seeded private values', all(x not in text for x in ['SECRET_IMAGE_NAME','SECRET_PL_NAME','secret-media','secret-pc','secret-snapshot']),text)
    after=page.evaluate("""async()=>{
      const read=n=>new Promise((ok,bad)=>{const q=indexedDB.open(n);q.onsuccess=()=>{const db=q.result;const out={version:db.version,stores:Array.from(db.objectStoreNames)};db.close();ok(out)};q.onerror=()=>bad(q.error)});
      const media=await read('tomato_pl_pc_media_v1'),recovery=await read('tomato_trpg_recovery_v1');
      const row=await new Promise((ok,bad)=>{const q=indexedDB.open('tomato_pl_pc_media_v1');q.onsuccess=()=>{const db=q.result,r=db.transaction('media','readonly').objectStore('media').get('secret-media');r.onsuccess=()=>{const v=r.result;db.close();ok(v)};r.onerror=()=>bad(r.error)};q.onerror=()=>bad(q.error)});
      return {media,recovery,rowName:row?.name||''};
    }""")
    rec('diagnostic leaves PC DB version and stores unchanged',after['media']['version']==2 and after['media']['stores']==['media','pcWorkbooks'],str(after['media']))
    rec('diagnostic leaves recovery DB version and stores unchanged',after['recovery']['version']==1 and after['recovery']['stores']==['snapshots'],str(after['recovery']))
    rec('diagnostic preserves seeded record',after['rowName']=='SECRET_IMAGE_NAME')
    page.set_viewport_size({'width':1280,'height':900});page.reload(wait_until='domcontentloaded');page.wait_for_function("document.querySelector('#status')?.textContent.includes('检查完成')",timeout=120000);page.screenshot(path=str(out/'round288-storage-diagnostic-1280.png'),full_page=True)
    browser.close()
finally:
  server.shutdown();server.server_close()
report={'version':'8.1.12.295','checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'standalone readonly IndexedDB structure diagnostic; fictional rows only'}
(out/'round288-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND288',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
