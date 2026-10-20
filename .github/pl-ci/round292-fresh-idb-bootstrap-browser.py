#!/usr/bin/env python3
from pathlib import Path
import json, os, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
checks=[]
def rec(label,ok,detail=''): checks.append({'test':label,'pass':bool(ok),'detail':detail})
class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{server.server_port}'
try:
  with sync_playwright() as p:
    exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
    context=browser.new_context(service_workers='block')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/index.html',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_function("typeof openPcMediaDb==='function' && typeof openRecoveryDb==='function'",timeout=120000)
    result=page.evaluate("""async()=>{
      const listed=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
      const before=(listed||[]).filter(x=>x?.name&&['tomato_pl_pc_media_v1','tomato_trpg_recovery_v1'].includes(x.name)).map(x=>({name:x.name,version:x.version}));
      // A fresh origin is the production case reported by the user. If startup has already
      // opened a target DB, close the product connection before recreating the exact v0 case.
      try{if(pcMediaDbPromise){const existing=await pcMediaDbPromise;existing?.close?.();pcMediaDbPromise=null;}}catch(_){pcMediaDbPromise=null;}
      const del=n=>new Promise((ok,bad)=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=()=>ok();q.onerror=()=>bad(q.error);q.onblocked=()=>bad(new Error('delete blocked '+n));});
      await del('tomato_pl_pc_media_v1');
      await del('tomato_trpg_recovery_v1');
      const zero=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
      const absent=(zero||[]).filter(x=>x?.name&&['tomato_pl_pc_media_v1','tomato_trpg_recovery_v1'].includes(x.name)).length===0;
      const media=await openPcMediaDb();
      const mediaShape={version:media.version,stores:Array.from(media.objectStoreNames)};
      const mtx=media.transaction(['media','pcWorkbooks','migrationJournal'],'readwrite');
      mtx.objectStore('media').put({id:'round292-media',pcId:'round292-pc',createdAt:1,blob:new Blob([new Uint8Array([1,2,3])],{type:'image/png'})});
      mtx.objectStore('pcWorkbooks').put({pcId:'round292-pc',blob:new Blob([new Uint8Array([4,5,6])],{type:'application/octet-stream'})});
      await new Promise((ok,bad)=>{mtx.oncomplete=ok;mtx.onerror=mtx.onabort=()=>bad(mtx.error||new Error('media tx aborted'))});
      const mediaRead=await new Promise((ok,bad)=>{const tx=media.transaction('media','readonly'),q=tx.objectStore('media').get('round292-media');q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
      const mediaIndexes=Array.from(media.transaction('media','readonly').objectStore('media').indexNames);
      media.close();pcMediaDbPromise=null;
      const recovery=await openRecoveryDb();
      const recoveryShape={version:recovery.version,stores:Array.from(recovery.objectStoreNames)};
      const recoveryIndexes=Array.from(recovery.transaction('snapshots','readonly').objectStore('snapshots').indexNames);
      const rtx=recovery.transaction(['snapshots','attachmentVersions'],'readwrite');
      rtx.objectStore('snapshots').put({id:'round292-snapshot',createdAt:1,payload:{fictional:true}});
      rtx.objectStore('attachmentVersions').put({key:'round292-version',kind:'media',metadata:{id:'fictional'}});
      await new Promise((ok,bad)=>{rtx.oncomplete=ok;rtx.onerror=rtx.onabort=()=>bad(rtx.error||new Error('recovery tx aborted'))});
      recovery.close();
      const after=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
      return {before,absent,mediaShape,mediaIndexes,mediaRead:!!mediaRead,recoveryShape,recoveryIndexes,after:(after||[]).filter(x=>x?.name&&['tomato_pl_pc_media_v1','tomato_trpg_recovery_v1'].includes(x.name)).map(x=>({name:x.name,version:x.version}))};
    }""")
    rec('fresh-device fixture starts with both target DBs absent',result['absent'],str(result['before']))
    rec('fresh PC attachment DB reaches v3 with all required stores',result['mediaShape']['version']==3 and all(x in result['mediaShape']['stores'] for x in ['media','pcWorkbooks','migrationJournal']),str(result['mediaShape']))
    rec('fresh PC media store has both required indexes',all(x in result['mediaIndexes'] for x in ['pcId','createdAt']),str(result['mediaIndexes']))
    rec('fresh PC attachment DB accepts and reads a fictional row',result['mediaRead'])
    rec('fresh recovery DB reaches v2 with all required stores',result['recoveryShape']['version']==2 and all(x in result['recoveryShape']['stores'] for x in ['snapshots','attachmentVersions']),str(result['recoveryShape']))
    rec('fresh recovery snapshot store keeps createdAt index', 'createdAt' in result['recoveryIndexes'],str(result['recoveryIndexes']))
    rec('fresh bootstrap leaves expected database versions',sorted((x['name'],x['version']) for x in result['after'])==[('tomato_pl_pc_media_v1',3),('tomato_trpg_recovery_v1',2)],str(result['after']))
    rec('fresh bootstrap has no page runtime errors',len(errors)==0,' | '.join(errors[:5]))
    browser.close()
finally:
  server.shutdown();server.server_close()
report={'version':'8.1.12.300','checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'fresh-origin IndexedDB v0 bootstrap; fictional rows only'}
(out/'round292-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND292',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
