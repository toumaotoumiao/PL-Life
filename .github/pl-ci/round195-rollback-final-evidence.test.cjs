'use strict';
/* Round195: post-rollback attachment drift + deterministic transactional adapter.
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
async function scenario({afterCommit=null,afterSettled=null,failCommit=false,afterOriginalVerify=null}={}){
 const db=new Database(),storage=new Storage(KEY,old),api=engine();
 const targetMedia=[media(),media('orphan-image')],targetBooks=[workbook(),workbook('retired-pc')];
 // All four attachments also exist before restoring. No user archive is involved.
 db.rows.media.set('orphan-image',media('orphan-image'));
 db.rows.pcWorkbooks.set('retired-pc',workbook('retired-pc'));
 let originalVerifyCalls=0;
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
  verifyOriginal:async(a,b)=>{await verifyState(db,a,b);originalVerifyCalls++;if(afterOriginalVerify){const fn=afterOriginalVerify;if(fn(db.rows,originalVerifyCalls))afterOriginalVerify=null;}},
  commitArchive:async()=>{if(failCommit)throw Error('synthetic commit failure');storage.setItem(KEY,next);if(afterCommit)afterCommit(db.rows);},
  verifyArchive:async raw=>assert.equal(raw,next)});
 return {outcome,db,storage,api};
}
function assertProtectedOriginal(run){
 assert.equal(run.storage.getItem(KEY),old,'original archive must be retained');
 assert.notEqual(run.storage.getItem(run.api.KEY),null,'retain protective marker');
 assert.equal(run.db.rows.migrationJournal.has('active'),true,'retain original binary journal');
 assert.throws(()=>run.api.assertWritable(run.storage),/恢复|禁止|尚未/);
}
test('Round195 stable failed archive commit restores original archive and attachments, clears journal',async()=>{
 const r=await scenario({failCommit:true});
 await assert.rejects(r.outcome,/synthetic commit failure/);
 assert.equal(r.storage.getItem(KEY),old);
 assert.equal(r.storage.getItem(r.api.KEY),null);
 assert.equal(r.db.rows.migrationJournal.size,0);
});
test('Round195 late same-byte media MIME edit after rollback settlement cannot be called rolled back',async()=>{
 const r=await scenario({failCommit:true,afterSettled:rows=>rows.media.set('source-image',media('source-image','application/octet-stream'))});
 await assert.rejects(r.outcome,/恢复|事务|附件|日志/);
 assertProtectedOriginal(r);
 assert.equal(r.db.rows.media.get('source-image').blob.type,'application/octet-stream');
});
test('Round195 late orphan workbook metadata edit after rollback settlement stays protected',async()=>{
 const r=await scenario({failCommit:true,afterSettled:rows=>rows.pcWorkbooks.set('retired-pc',{...workbook('retired-pc'),future:{flag:true}})});
 await assert.rejects(r.outcome,/恢复|事务|附件|日志/);
 assertProtectedOriginal(r);
 assert.equal(r.db.rows.pcWorkbooks.get('retired-pc').future.flag,true);
});
test('Round195 crash restart refuses to clear settled rollback journal with changed attachment',async()=>{
 const r=await scenario({failCommit:true,afterSettled:rows=>rows.media.set('orphan-image',media('orphan-image','image/jpeg'))});
 await assert.rejects(r.outcome,/恢复|事务|附件|日志/);
 assertProtectedOriginal(r);
 await assert.rejects(()=>r.api.recover({storage:r.storage,openDb:async()=>r.db,verifyOriginal:async(a,b)=>verifyState(r.db,a,b)}),/附件|证据|不一致/);
 assertProtectedOriginal(r);
});
test('Round195 after original readback, older tab changes thumbnail; late check keeps journal',async()=>{
 const r=await scenario({failCommit:true,afterOriginalVerify:rows=>rows.media.set('source-image',media('source-image','image/png','application/octet-stream'))});
 await assert.rejects(r.outcome,/恢复|事务|附件|日志/);
 assertProtectedOriginal(r);
});
test('Round195 restarted settled rollback rechecks originals after asynchronous product readback',async()=>{
 const r=await scenario({failCommit:true,
  afterSettled:()=>{throw Error('synthetic interruption after settled marker');}});
 await assert.rejects(r.outcome,/恢复|事务|附件|日志/);
 assertProtectedOriginal(r);
 await assert.rejects(()=>r.api.recover({storage:r.storage,openDb:async()=>r.db,
  verifyOriginal:async(a,b)=>{await verifyState(r.db,a,b);
   r.db.rows.media.set('orphan-image',media('orphan-image','image/jpeg'));}}),/附件|证据|不一致/);
 assertProtectedOriginal(r);
 assert.equal(r.db.rows.media.get('orphan-image').blob.type,'image/jpeg');
});
test('Round195 finalization and settled rollback both validate latest original attachments in production',()=>{
 const flow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(migration,/await finalize\(storage,db,marker,journal\.beforeRaw,'original',[^)]/);
 assert.match(migration,/await verifyTargetEvidence\(db,expectedEvidence\)/);
 assert.match(flow,/round195-rollback-final-evidence\.test\.cjs/);
});
