'use strict';
/* Round192: production restoration engine + deterministic transactional adapter.
 * The first write transaction simulates an old tab writing only IndexedDB after
 * confirmation. These synthetic assertions do NOT stand in for native Round187. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(process.env.PL_ROUND192_BASELINE_HTML||path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(process.env.PL_ROUND192_BASELINE_MIGRATION||path.join(root,'data-migration-transaction.js'),'utf8');
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
async function scenario(hook){
 const db=new Database(),storage=new Storage(KEY,old),api=engine();
 const approvedMedia=[media()],approvedBooks=[workbook()],targetMedia=[media()],targetBooks=[workbook()];
 db.beforeSwap=hook;
 const outcome=api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:targetMedia,workbookRows:targetBooks,
  verifySource:async(actualMedia,actualBooks)=>{await verify(actualMedia,approvedMedia,'id','恢复前图片');await verify(actualBooks,approvedBooks,'pcId','恢复前原始 Excel');},
  verifyTarget:async()=>verifyState(db,targetMedia,targetBooks),verifyOriginal:async(a,b)=>verifyState(db,a,b),
  commitArchive:async()=>storage.setItem(KEY,next),verifyArchive:async raw=>assert.equal(raw,next)});
 return {outcome,db,storage,api};
}
test('Round192 source-only late IDB insertion stops commit and preserves the newly written orphan',async()=>{
 const run=await scenario(rows=>rows.media.set('late-orphan',media('late-orphan')));
 await assert.rejects(run.outcome,/原件|数量|确认|源/);
 assert.equal(run.storage.getItem(KEY),old);
 assert.ok(run.db.rows.media.has('late-orphan'),'rollback must restore old-tab addition from journal');
 assert.equal(run.db.rows.migrationJournal.size,0);
 assert.equal(run.storage.getItem(run.api.KEY),null);
});
test('Round192 same-byte thumbnail MIME drift is detected before archive write',async()=>{
 const run=await scenario(rows=>rows.media.set('source-image',media('source-image','image/png','image/png')));
 await assert.rejects(run.outcome,/MIME|类型/);
 assert.equal(run.storage.getItem(KEY),old);
 assert.equal(run.db.rows.media.get('source-image').thumbBlob.type,'image/png');
 assert.equal(run.storage.getItem(run.api.KEY),null);
});
test('Round192 source-only workbook replacement is not overwritten',async()=>{
 const run=await scenario(rows=>rows.pcWorkbooks.set('fiction-pc',{...workbook(),future:{flag:true}}));
 await assert.rejects(run.outcome,/元数据|回读|Excel/);
 assert.equal(run.storage.getItem(KEY),old);
 assert.equal(run.db.rows.pcWorkbooks.get('fiction-pc').future.flag,true);
});
test('Round192 source-only deletion before swap is preserved on safe rollback',async()=>{
 const run=await scenario(rows=>rows.pcWorkbooks.delete('fiction-pc'));
 await assert.rejects(run.outcome,/数量|Excel/);
 assert.equal(run.storage.getItem(KEY),old);
 assert.equal(run.db.rows.pcWorkbooks.has('fiction-pc'),false);
});
test('Round192 stable approved source can commit, clear journal, and maintain full MIME',async()=>{
 const run=await scenario(null);
 assert.equal((await run.outcome).status,'committed');
 assert.equal(run.storage.getItem(KEY),next);
 assert.equal(run.storage.getItem(run.api.KEY),null);
 assert.equal(run.db.rows.migrationJournal.size,0);
 await verifyState(run.db,[media()],[workbook()]);
});
test('Round192 actual app reads media and Excel in one readonly transaction',async()=>{
 const db=new Database(),native=db.transaction.bind(db),calls=[];
 db.transaction=(names,mode)=>{calls.push({names,mode});return native(names,mode);};
 const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const txDone=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('aborted'));});
 const read=new Function('openPcMediaDb','pcMediaTxDone','idbRequest','PC_MEDIA_STORE','PC_WORKBOOK_STORE','pcWorkbookHydrateRow',
  section('async function pcReadAttachmentSourceSnapshot(){','async function pcVerifyStoredBlobRows(')+'\nreturn pcReadAttachmentSourceSnapshot;')(
  async()=>db,txDone,request,'media','pcWorkbooks',x=>x);
 const snapshot=await read();
 assert.deepEqual(calls,[{names:['media','pcWorkbooks'],mode:'readonly'}]);
 assert.equal(snapshot.media.length,1);assert.equal(snapshot.workbooks.length,1);
 assert.equal(snapshot.media[0].thumbBlob.type,'image/webp');
 assert.equal(snapshot.workbooks[0].blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
test('Round192 historical attachment collision also compares original and thumbnail MIME',async()=>{
 const metadata=new Function(section('function backupUnlinkedMeta(row){','/* Optional linked-attachment fidelity extension.')+'\nreturn backupUnlinkedMeta;')();
 const equal=new Function('snapshotAttachmentDigest','backupUnlinkedMeta',
  section('async function backupRowsExactlySame(left,right){','/* Import never silently drops local unlinked files')+'\nreturn backupRowsExactlySame;')(async b=>shaBytes(await b.arrayBuffer()),metadata);
 const left=media('orphan'),right=media('orphan','image/png','image/png');
 const book=workbook('retired-pc'),changedBook={...workbook('retired-pc'),blob:new Blob([Uint8Array.from([80,75,3,4])],{type:'application/octet-stream'})};
 const collision=new Function('pcMediaAllRows','pcWorkbookAllRows','pcReferencedMediaIds','pcs','backupRowsExactlySame','snapshotAttachmentDigest',
  section('async function assertVersionedRecoveryCollisions(','async function restoreVersionedRecoverySnapshot(')+'\nreturn assertVersionedRecoveryCollisions;')(
  async()=>[left],async()=>[book],()=>new Set(),[],equal,async b=>shaBytes(await b.arrayBuffer()));
 const snap={attachmentVersions:{media:[{id:'orphan'}],workbooks:[{pcId:'retired-pc'}]}};
 await assert.rejects(()=>collision(snap,{media:[right],workbooks:[book]},{media:[left],workbooks:[book]}),/冲突/);
 await assert.rejects(()=>collision(snap,{media:[left],workbooks:[changedBook]},{media:[left],workbooks:[book]}),/冲突/);
 await collision(snap,{media:[left],workbooks:[book]},{media:[left],workbooks:[book]});
});
test('Round192 production integration requires atomic source snapshot, approved preflight and CI gate',()=>{
 const flow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(html,/db\.transaction\(\[PC_MEDIA_STORE,PC_WORKBOOK_STORE\],'readonly'\)/);
 assert.match(html,/preserveLocalUnlinkedForZip\(prepared,approvedSource\)/);
 assert.match(html,/assertCompleteZipPreservesRecoveryAttachments\(prepared,approvedSource\)/);
 assert.match(html,/verifySource:\s*async\(media,workbooks\)/);
 assert.match(html,/restoreVersionedRecoverySnapshot\(latest,incoming,confirmedSourceRaw\)/);
 assert.match(html,/await assertVersionedRecoveryCollisions\(snapshot,versioned,approvedSource\)/);
 assert.match(migration,/await options\.verifySource\(journal\.originalMedia,journal\.originalWorkbooks\)/);
 assert.match(flow,/round192-source-attachment-race\.test\.cjs/);
 assert.match(flow,/round187-native-fullapp-restore-browser\.py/);
});
