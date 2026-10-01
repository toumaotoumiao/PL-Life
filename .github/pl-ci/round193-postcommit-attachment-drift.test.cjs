'use strict';
/* Round193: post-commit attachment drift + deterministic transactional adapter.
 * An old tab writes only IndexedDB after archive commit or settled-marker write. These synthetic assertions do NOT stand in for native Round187. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(process.env.PL_ROUND193_BASELINE_HTML||path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(process.env.PL_ROUND193_BASELINE_MIGRATION||path.join(root,'data-migration-transaction.js'),'utf8');
const section=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'missing production function: '+start);return html.slice(a,b);};
const shaBytes=async b=>Buffer.from(await webcrypto.subtle.digest('SHA-256',b)).toString('hex');
const verify=new Function('backupSha256Bytes',section('function backupAttachmentKey(','async function buildUnlinkedAttachmentEntries(')+section('async function pcVerifyStoredBlobRows(actual,expected,key,label){','/* Full ZIP replaces both live attachment stores.')+'\nreturn pcVerifyStoredBlobRows;')(shaBytes);
const media=(id='source-image',original='image/png',thumbnail='image/webp')=>({id,pcId:'fiction-pc',name:'仅供测试.png',future:{zero:0,flag:false},blob:new Blob([Uint8Array.from([1,0,2])],{type:original}),thumbBlob:new Blob([Uint8Array.from([4,0,5])],{type:thumbnail})});
const workbook=(id='fiction-pc')=>({pcId:id,fileName:'仅供测试.xlsx',future:{flag:false},blob:new Blob([Uint8Array.from([80,75,3,4])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})});
const clone=structuredClone;
class Storage{constructor(key,old){this.data=new Map([[key,old]]);}getItem(k){return this.data.has(k)?this.data.get(k):null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
class Database{
 constructor(){this.rows={media:new Map([['source-image',media()]]),pcWorkbooks:new Map([['fiction-pc',workbook()]]),migrationJournal:new Map()};this.objectStoreNames={contains:k=>Object.hasOwn(this.rows,k)};this.beforeSwap=null;}
 transaction(names,mode='readonly'){
  if(mode==='readwrite'&&names.includes('migrationJournal')&&this.beforeSwap){const hook=this.beforeSwap;this.beforeSwap=null;hook(this.rows);}
  const db=this,own=Object.fromEntries(names.map(name=>[name,new Map([...db.rows[name]].map(([key,value])=>[key,clone(value)]))]));
  let pending=0,closing=false,closed=false,aborted=false;
  const tx={error:null,oncomplete:null,onerror:null,onabort:null,abort(){if(closed)return;aborted=true;closed=true;setImmediate(()=>tx.onabort?.());},
   objectStore(name){if(!own[name])throw Error('missing store');const rows=own[name],key=name==='media'?'id':name==='pcWorkbooks'?'pcId':'id';
    const request=action=>{if(closed||aborted)throw Error('inactive transaction');pending++;const r={result:undefined,error:null,onsuccess:null,onerror:null};setImmediate(()=>{if(aborted)return;try{r.result=action();r.onsuccess?.();}catch(error){r.error=error;r.onerror?.();tx.error=error;tx.abort();}pending--;if(!pending)schedule();});return r;};
    return {get(id){return request(()=>clone(rows.get(String(id))));},getAll(){return request(()=>[...rows.values()].map(value=>clone(value)));},put(value){if(mode==='readonly')throw Error('readonly');return request(()=>{if(typeof value?.[key]!=='string')throw Error('invalid key');rows.set(value[key],clone(value));});},clear(){if(mode==='readonly')throw Error('readonly');return request(()=>rows.clear());},delete(id){if(mode==='readonly')throw Error('readonly');return request(()=>rows.delete(String(id)));}};
   }};
  function schedule(){if(pending||closing||closed||aborted)return;closing=true;setImmediate(()=>{closing=false;if(pending||closed||aborted)return;if(mode==='readwrite')for(const name of names)db.rows[name]=own[name];closed=true;tx.oncomplete?.();});}
  return tx;
 }
}
function engine(){const cx={crypto:webcrypto,TextEncoder,Blob,Date,console,structuredClone};cx.window=cx;vm.createContext(cx);vm.runInContext(migration,cx);return cx.PLDataMigrationTransaction;}
const KEY='trpg_pl_profile_archive_v1',old=JSON.stringify({stage:'approved',schemaVersion:26}),next=JSON.stringify({stage:'restored',schemaVersion:26});
const verifyState=async(db,mediaRows,bookRows)=>{await verify([...db.rows.media.values()],mediaRows,'id','图片');await verify([...db.rows.pcWorkbooks.values()],bookRows,'pcId','Excel');};
async function scenario({afterCommit=null,afterSettled=null}={}){
 const db=new Database(),storage=new Storage(KEY,old),api=engine();
 const targetMedia=[media(),media('orphan-image')],targetBooks=[workbook(),workbook('retired-pc')];
 // All four attachments also exist before restoring. No user archive is involved.
 db.rows.media.set('orphan-image',media('orphan-image'));
 db.rows.pcWorkbooks.set('retired-pc',workbook('retired-pc'));
 const sourceSet=storage.setItem.bind(storage);
 storage.setItem=(k,v)=>{
   sourceSet(k,v);
   if(k===api.KEY&&afterSettled){
     let record;try{record=JSON.parse(v)}catch(_){}
     if(record?.phase==='settled'){const fn=afterSettled;afterSettled=null;fn(db.rows);}
   }
 };
 const outcome=api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:targetMedia,workbookRows:targetBooks,
  verifySource:async()=>{},
  verifyTarget:async()=>verifyState(db,targetMedia,targetBooks),
  verifyOriginal:async(a,b)=>verifyState(db,a,b),
  commitArchive:async()=>{storage.setItem(KEY,next);if(afterCommit)afterCommit(db.rows);},
  verifyArchive:async raw=>assert.equal(raw,next)});
 return {outcome,db,storage,api};
}
function assertProtected(run){
 assert.equal(run.storage.getItem(KEY),next,'candidate archive must not be silently described as rolled back');
 assert.equal(run.storage.getItem(run.api.KEY)!==null,true,'retain durable restoration marker');
 assert.equal(run.db.rows.migrationJournal.has('active'),true,'retain original binary rows');
 assert.throws(()=>run.api.assertWritable(run.storage),/恢复|禁止|尚未/);
}
test('Round193 stable target finishes and leaves no marker or binary journal',async()=>{
 const r=await scenario();assert.equal((await r.outcome).status,'committed');
 assert.equal(r.storage.getItem(KEY),next);assert.equal(r.storage.getItem(r.api.KEY),null);
 assert.equal(r.db.rows.migrationJournal.size,0);
});
test('Round193 same-byte image MIME changed after archive commit: no false success',async()=>{
 const r=await scenario({afterCommit:rows=>rows.media.set('source-image',media('source-image','application/octet-stream'))});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.media.get('source-image').blob.type,'application/octet-stream');
});
test('Round193 same-byte thumbnail MIME changed after archive commit: no false success',async()=>{
 const r=await scenario({afterCommit:rows=>rows.media.set('source-image',media('source-image','image/png','image/png'))});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.media.get('source-image').thumbBlob.type,'image/png');
});
test('Round193 original Excel future metadata changed after commit: no false success',async()=>{
 const r=await scenario({afterCommit:rows=>rows.pcWorkbooks.set('fiction-pc',{...workbook(),future:{flag:true}})});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.pcWorkbooks.get('fiction-pc').future.flag,true);
});
test('Round193 late unlinked image added after commit: no false success',async()=>{
 const r=await scenario({afterCommit:rows=>rows.media.set('late-orphan',media('late-orphan'))});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.media.has('late-orphan'),true);
});
test('Round193 IDB changes after settled marker while journal remains: no false cleanup',async()=>{
 const r=await scenario({afterSettled:rows=>rows.pcWorkbooks.set('fiction-pc',{...workbook(),blob:new Blob([Uint8Array.from([80,75,3,4])],{type:'application/octet-stream'})})});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.pcWorkbooks.get('fiction-pc').blob.type,'application/octet-stream');
});
test('Round193 settled marker receives a late unlinked workbook: do not erase journal',async()=>{
 const r=await scenario({afterSettled:rows=>rows.pcWorkbooks.set('late-pc',workbook('late-pc'))});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);assertProtected(r);
 assert.equal(r.db.rows.pcWorkbooks.has('late-pc'),true);
});
test('Round193 reload recovery refuses to clear a settled journal after external workbook change',async()=>{
 const r=await scenario({afterSettled:rows=>rows.pcWorkbooks.set('retired-pc',{...workbook('retired-pc'),future:{flag:true}})});
 await assert.rejects(r.outcome,/附件|事务|恢复|日志/);
 assertProtected(r);
 await assert.rejects(()=>r.api.recover({storage:r.storage,openDb:async()=>r.db,verifyOriginal:async(a,b)=>verifyState(r.db,a,b)}),/附件|证据|不一致/);
 assertProtected(r);
 assert.equal(r.db.rows.pcWorkbooks.get('retired-pc').future.flag,true);
});
test('Round193 CI gate and final verification are part of production source',()=>{
 const flow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 // Stage49 shares the final evidence gate with rollback; the earlier target-
 // only branch is intentionally gone, but must not weaken target verification.
 assert.match(migration,/if\(!expectedEvidence\)fail\(/);
 assert.match(migration,/await verifyTargetEvidence\(db,expectedEvidence\)/);
 assert.match(migration,/await finalize\(storage,db,marker,current,'target',targetEvidence\)/);
 assert.match(flow,/round193-postcommit-attachment-drift\.test\.cjs/);
});
