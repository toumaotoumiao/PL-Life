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
    page=context.new_page()
    page.goto(base+'/module-tools.html',wait_until='domcontentloaded',timeout=120000)
    page.evaluate("""async()=>{
      const del=n=>new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()});
      for(const n of ['tomato_pl_pc_media_v1','tomato_trpg_recovery_v1','tomato_pl_primary_mirror_v1'])await del(n);
      const open=(n,v,upgrade)=>new Promise((ok,bad)=>{const q=indexedDB.open(n,v);q.onupgradeneeded=()=>upgrade(q.result);q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)});
      let db=await open('tomato_pl_pc_media_v1',2,db=>{const m=db.createObjectStore('media',{keyPath:'id'});m.createIndex('pcId','pcId');m.createIndex('createdAt','createdAt');db.createObjectStore('pcWorkbooks',{keyPath:'pcId'});});
      let tx=db.transaction(['media','pcWorkbooks'],'readwrite');
      tx.objectStore('media').put({id:'private-media-id',pcId:'private-pc-id',blob:new Blob([new Uint8Array([1,2,3])],{type:'image/png'}),name:'SECRET_IMAGE_NAME'});
      tx.objectStore('pcWorkbooks').put({pcId:'private-pc-id',blob:new Blob([new Uint8Array([4,5,6])]),fileName:'SECRET_WORKBOOK_NAME.xlsx'});
      await new Promise((ok,bad)=>{tx.oncomplete=ok;tx.onerror=tx.onabort=()=>bad(tx.error)});db.close();
      db=await open('tomato_trpg_recovery_v1',1,db=>{const s=db.createObjectStore('snapshots',{keyPath:'id'});s.createIndex('createdAt','createdAt');});
      tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({id:'legacy',createdAt:1,payload:{profiles:[{name:'SECRET_PL_NAME'}]}});
      await new Promise((ok,bad)=>{tx.oncomplete=ok;tx.onerror=tx.onabort=()=>bad(tx.error)});db.close();
      localStorage.setItem('tomato_pl_onboarding_done_v1','1');
    }""")
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/index.html',wait_until='domcontentloaded',timeout=120000)
    page.wait_for_timeout(1200)
    result=page.evaluate("""async()=>{
      const media=await openPcMediaDb();
      const mediaShape={version:media.version,stores:Array.from(media.objectStoreNames)};
      const tx=media.transaction('media','readonly'),req=tx.objectStore('media').get('private-media-id');
      const row=await new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
      const recovery=await openRecoveryDb();const recoveryShape={version:recovery.version,stores:Array.from(recovery.objectStoreNames)};recovery.close();
      const diag=await anonymousBackupStorageDiagnostics();
      return {mediaShape,recoveryShape,kept:row?.name==='SECRET_IMAGE_NAME',diag};
    }""")
    rec('full page has no runtime errors during legacy DB upgrade',len(errors)==0,' | '.join(errors[:4]))
    rec('legacy PC attachment DB upgrades v2→v3',result['mediaShape']['version']==3 and 'migrationJournal' in result['mediaShape']['stores'],str(result['mediaShape']))
    rec('legacy recovery DB upgrades v1→v2',result['recoveryShape']['version']==2 and 'attachmentVersions' in result['recoveryShape']['stores'],str(result['recoveryShape']))
    rec('upgrade preserves existing private rows',result['kept'])
    forbidden=['SECRET_IMAGE_NAME','SECRET_WORKBOOK_NAME','SECRET_PL_NAME','private-pc-id','private-media-id']
    rec('anonymous diagnostic does not expose seeded private values',not any(x in result['diag'] for x in forbidden),result['diag'])
    rec('anonymous diagnostic names only database versions/stores',('PC附件库：v3' in result['diag'] and '恢复点库：v2' in result['diag']),result['diag'])
    browser.close()
finally:
  server.shutdown();server.server_close()

report={'version':'8.1.12.294','checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'legacy IndexedDB upgrade + anonymous diagnostic; synthetic private rows only'}
(out/'round287-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND287',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
