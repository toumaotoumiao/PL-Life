const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require(path.join(__dirname,'node_modules/playwright'));
const repo=path.resolve(__dirname,'../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pl-env-isolation-'));
function copyApp(){
 const testDir=path.join(tmp,'PL-Life-Test');fs.mkdirSync(testDir,{recursive:true});
 for(const name of fs.readdirSync(repo)){const p=path.join(repo,name);if(fs.statSync(p).isFile())fs.copyFileSync(p,path.join(testDir,name));}
 fs.writeFileSync(path.join(testDir,'harness.html'),'<!doctype html><meta charset="utf-8"><script src="./runtime-environment.js"></script><body>TEST READY</body>');
 const prodDir=path.join(tmp,'PL-Life');fs.mkdirSync(prodDir,{recursive:true});
 fs.writeFileSync(path.join(prodDir,'index.html'),`<!doctype html><meta charset="utf-8"><body>SEEDING<script>
 (async()=>{localStorage.setItem('trpg_pl_profile_archive_v1',JSON.stringify({format:'tomato-pl-archive',schemaVersion:26,app:{uiVersion:'8.1.12.160'},data:{profiles:[],modules:[],runs:[],pcs:[]}}));
 const db=await new Promise((res,rej)=>{const r=indexedDB.open('tomato_pl_pc_media_v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('media',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
 await new Promise((res,rej)=>{const tx=db.transaction('media','readwrite');tx.objectStore('media').put({id:'prod-image',value:'PROD'});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
 const c=await caches.open('pl-life-prod-v8.1.12.142');await c.put(new URL('/PL-Life/__round102_prod_cache_marker__',location.origin).href,new Response('PROD-CACHE'));document.body.textContent='SEEDED';})();
 </script></body>`);
}
function serve(){return new Promise(resolve=>{const server=http.createServer((req,res)=>{let pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);if(pathname.endsWith('/'))pathname+='index.html';const file=path.normalize(path.join(tmp,pathname));if(!file.startsWith(tmp)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end('not found');return;}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.html'?'text/html':ext==='.webmanifest'?'application/manifest+json':ext==='.png'?'image/png':'application/octet-stream';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));});server.listen(0,'127.0.0.1',()=>resolve(server));});}
(async()=>{
 copyApp();const server=await serve();const port=server.address().port;const base=`http://127.0.0.1:${port}`;let browser;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();
  await page.goto(base+'/PL-Life/');await page.waitForFunction(()=>document.body.textContent==='SEEDED');
  await page.goto(base+'/PL-Life-Test/harness.html');await page.waitForFunction(()=>window.PLRuntimeEnvironment?.isTest===true);
  const r=await page.evaluate(async()=>{
   const env=PLRuntimeEnvironment,rawBefore=env.rawLocalStorageGet('trpg_pl_profile_archive_v1'),copied=localStorage.getItem('trpg_pl_profile_archive_v1');
   localStorage.setItem('trpg_pl_profile_archive_v1','TEST-ONLY');
   const isolation=await env.environmentIsolationReady;if(!isolation.complete)throw new Error('test environment isolation did not complete');
   const read=name=>new Promise((resolve,reject)=>{const q=indexedDB.open(name);q.onsuccess=()=>{const db=q.result,tx=db.transaction('media','readonly'),g=tx.objectStore('media').get('prod-image');g.onsuccess=()=>{db.close();resolve(g.result)};g.onerror=()=>reject(g.error)};q.onerror=()=>reject(q.error)});
   const prodBefore=await read('tomato_pl_pc_media_v1'),testBefore=await read('pl-life-test__tomato_pl_pc_media_v1');
   await new Promise((resolve,reject)=>{const q=indexedDB.open('pl-life-test__tomato_pl_pc_media_v1');q.onsuccess=()=>{const db=q.result,tx=db.transaction('media','readwrite');tx.objectStore('media').put({id:'prod-image',value:'TEST'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};q.onerror=()=>reject(q.error)});
   const prodAfter=await read('tomato_pl_pc_media_v1'),testAfter=await read('pl-life-test__tomato_pl_pc_media_v1');
   await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;await new Promise(r=>setTimeout(r,250));
   const keys=await caches.keys(),prodCache=await caches.open('pl-life-prod-v8.1.12.142'),marker=await prodCache.match(new URL('/PL-Life/__round102_prod_cache_marker__',location.origin).href);
   return {rawBefore,copied,rawAfter:env.rawLocalStorageGet('trpg_pl_profile_archive_v1'),testRaw:env.rawLocalStorageGet('pl-life-test::trpg_pl_profile_archive_v1'),prodBefore,testBefore,prodAfter,testAfter,keys,prodMarker:marker?await marker.text():null,channel:env.channelName('tomato_pl_sync_v1')};
  });
  assert.equal(r.rawBefore,r.copied);assert.equal(r.rawAfter,r.rawBefore);assert.equal(r.testRaw,'TEST-ONLY');
  assert.deepEqual(r.prodBefore,{id:'prod-image',value:'PROD'});assert.deepEqual(r.testBefore,{id:'prod-image',value:'PROD'});assert.deepEqual(r.prodAfter,{id:'prod-image',value:'PROD'});assert.deepEqual(r.testAfter,{id:'prod-image',value:'TEST'});
  assert.equal(r.prodMarker,'PROD-CACHE');assert(r.keys.includes('pl-life-prod-v8.1.12.142'));assert(r.keys.some(k=>k.startsWith('pl-life-test-v8.1.12.')));assert.equal(r.channel,'pl-life-test::tomato_pl_sync_v1');
  console.log('ROUND102_BROWSER_PASS',JSON.stringify(r));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exit(1)});
