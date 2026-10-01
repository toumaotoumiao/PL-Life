'use strict';
/* Round191 uses actual app verification and production migration engine with a
 * deterministic transactional IndexedDB adapter. This does NOT claim native
 * browser or device acceptance. All records and binary bytes are fictional. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'data-migration-transaction.js'),'utf8');
const shaBytes=async x=>Buffer.from(await webcrypto.subtle.digest('SHA-256',x)).toString('hex');
const source=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,'source missing: '+start);return html.slice(a,b);};
const verify=new Function('backupSha256Bytes',source('function backupAttachmentKey(','async function buildUnlinkedAttachmentEntries(')+source('async function pcVerifyStoredBlobRows(actual,expected,key,label){','/* Full ZIP replaces both live attachment stores.')+'\nreturn pcVerifyStoredBlobRows;')(shaBytes);
const byteArray=async blob=>new Uint8Array(await blob.arrayBuffer());
const image=(mime='image/png',thumbType='image/webp')=>({id:'fiction-image',pcId:'fiction-pc',name:'虚构.png',note:'合成',futureMeta:{flags:[false,0,'']},blob:new Blob([Uint8Array.from([1,0,2,3])],{type:mime}),thumbBlob:new Blob([Uint8Array.from([4,0,5])],{type:thumbType})});
const workbook=(mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')=>({pcId:'fiction-pc',fileName:'虚构.xlsx',futureWorkbook:{zero:0},blob:new Blob([Uint8Array.from([80,75,3,4,0])],{type:mime})});
const clone=structuredClone;
class MemoryStorage{constructor(entries){this.rows=new Map(Object.entries(entries||{}));}getItem(k){return this.rows.has(k)?this.rows.get(k):null;}setItem(k,v){this.rows.set(String(k),String(v));}removeItem(k){this.rows.delete(k);}}
class InMemoryIDB{
 constructor(){this.rows={media:new Map(),pcWorkbooks:new Map(),migrationJournal:new Map()};this.objectStoreNames={contains:name=>Object.hasOwn(this.rows,name)};}
 transaction(names,mode='readonly'){
  const db=this,own=Object.fromEntries(names.map(n=>[n,new Map([...db.rows[n]].map(([k,v])=>[k,clone(v)]))]));
  let pending=0,closing=false,closed=false,aborted=false;
  const tx={error:null,oncomplete:null,onerror:null,onabort:null,
   abort(){if(closed)return;aborted=true;closed=true;setImmediate(()=>tx.onabort?.());},
   objectStore(name){if(!own[name])throw Error('missing store');const store=own[name],key=name==='media'?'id':name==='pcWorkbooks'?'pcId':'id';
    const request=fn=>{if(closed||aborted)throw Error('inactive transaction');pending++;const r={result:undefined,error:null,onsuccess:null,onerror:null};setImmediate(()=>{if(aborted)return;try{r.result=fn();r.onsuccess?.();}catch(e){r.error=e;r.onerror?.();tx.error=e;tx.abort();}pending--;if(!pending)schedule();});return r;};
    return {get(k){return request(()=>clone(store.get(String(k))));},getAll(){return request(()=>[...store.values()].map(v=>clone(v)));},
      put(value){if(mode==='readonly')throw Error('readonly');if(typeof value?.[key]!=='string')throw Error('invalid key');return request(()=>store.set(value[key],clone(value)));},
      clear(){if(mode==='readonly')throw Error('readonly');return request(()=>store.clear());},delete(k){if(mode==='readonly')throw Error('readonly');return request(()=>store.delete(String(k)));}};
   }};
  function schedule(){if(pending||closing||closed||aborted)return;closing=true;setImmediate(()=>{closing=false;if(pending||closed||aborted)return;if(mode==='readwrite')for(const name of names)db.rows[name]=own[name];closed=true;tx.oncomplete?.();});}
  return tx;
 }
}
function engine(){const cx={crypto:webcrypto,TextEncoder,Blob,Date,console,structuredClone};cx.window=cx;vm.createContext(cx);vm.runInContext(migration,cx);return cx.PLDataMigrationTransaction;}
const key='trpg_pl_profile_archive_v1',old=JSON.stringify({schemaVersion:26,stage:'source'}),next=JSON.stringify({schemaVersion:26,stage:'target'});
function setup(){const db=new InMemoryIDB(),storage=new MemoryStorage({[key]:old});db.rows.media.set('fiction-image',image());db.rows.pcWorkbooks.set('fiction-pc',workbook());return{db,storage};}
const verifyOriginal=async(db,media,books)=>{await verify([...db.rows.media.values()],media,'id','图片');await verify([...db.rows.pcWorkbooks.values()],books,'pcId','Excel');};
const shaRaw=s=>shaBytes(new TextEncoder().encode(JSON.stringify({value:s})));
async function legacyV1Evidence(media,books){async function map(rows,key){const a=[];for(const row of rows){const meta=Object.fromEntries(Object.entries(row).filter(([k])=>!['blob','thumbBlob'].includes(k)));a.push({key:row[key],meta:await shaBytes(new TextEncoder().encode(JSON.stringify(meta))),blob:await shaBytes(await row.blob.arrayBuffer()),thumb:row.thumbBlob?await shaBytes(await row.thumbBlob.arrayBuffer()):null});}return a.sort((x,y)=>x.key.localeCompare(y.key));}return {version:1,media:await map(media,'id'),workbooks:await map(books,'pcId')};}
test('Round191 full-app attachment verifier detects same-byte original and thumbnail MIME changes',async()=>{
 await assert.rejects(()=>verify([image('image/jpeg')],[image()],'id','图片'),/MIME|类型/);
 await assert.rejects(()=>verify([image('image/png','image/png')],[image()],'id','图片'),/MIME|类型/);
 await assert.rejects(()=>verify([workbook('application/octet-stream')],[workbook()],'pcId','Excel'),/MIME|类型/);
 await verify([image()],[image()],'id','图片');await verify([workbook()],[workbook()],'pcId','Excel');
});
test('Round191 transaction refuses silent MIME drift even when original byte digest is unchanged',async()=>{
 const {db,storage}=setup(),api=engine(),media=[image()],books=[workbook()];
 await assert.rejects(api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:media,workbookRows:books,
  verifyTarget:async()=>{const row=db.rows.media.get('fiction-image');db.rows.media.set(row.id,{...row,blob:new Blob([await byteArray(row.blob)],{type:'image/jpeg'})});},
  verifyOriginal:async(a,b)=>verifyOriginal(db,a,b),commitArchive:async()=>storage.setItem(key,next),verifyArchive:async()=>{}}),/MIME|附件|证据|自动恢复未完成/);
 assert.equal(storage.getItem(key),old,'the unchanged source archive must not be committed');
 assert.ok(storage.getItem(api.KEY),'the unresolved third-version attachment must retain a durable read-only marker');
 assert.equal(db.rows.migrationJournal.size,1,'original bytes must remain in the same durable journal');
});
test('Round191 accepts legacy version-1 settled evidence after safe verification and cleanup',async()=>{
 const {db,storage}=setup(),api=engine(),beforeMedia=[image()],beforeBooks=[workbook()],afterMedia=[image()],afterBooks=[workbook()];
 // A legacy journal with no MIME evidence must remain recoverable, but cannot
 // be presented as newly generated strict v2 evidence.
 const id='abcdef01-2345-6789-abcd-abcdef012345',marker={version:1,id,phase:'settled',createdAt:1,beforeHash:await shaRaw(old),targetHash:await shaRaw(next),settlement:'target'};
 const legacy=await legacyV1Evidence(afterMedia,afterBooks);
 db.rows.migrationJournal.set('active',{id:'active',transactionId:id,createdAt:1,beforeRaw:old,originalMedia:beforeMedia,originalWorkbooks:beforeBooks,targetEvidence:legacy});
 db.rows.media.set('fiction-image',afterMedia[0]);db.rows.pcWorkbooks.set('fiction-pc',afterBooks[0]);storage.setItem(key,next);storage.setItem(api.KEY,JSON.stringify(marker));
 const outcome=await api.recover({storage,openDb:async()=>db,verifyOriginal:async(a,b)=>verifyOriginal(db,a,b)});
 assert.equal(outcome.status,'committed');assert.equal(storage.getItem(key),next);assert.equal(storage.getItem(api.KEY),null);assert.equal(db.rows.migrationJournal.size,0);
});
test('Round191 legacy version-1 preparing journal still rolls back without v2 shape mismatch',async()=>{
 const {db,storage}=setup(),api=engine(),beforeMedia=[image()],beforeBooks=[workbook()],afterMedia=[image()],afterBooks=[workbook()];
 const id='abcdef01-2345-6789-abcd-abcdef012345',marker={version:1,id,phase:'preparing',createdAt:1,beforeHash:await shaRaw(old)};
 db.rows.migrationJournal.set('active',{id:'active',transactionId:id,createdAt:1,beforeRaw:old,originalMedia:beforeMedia,originalWorkbooks:beforeBooks,targetEvidence:await legacyV1Evidence(afterMedia,afterBooks)});
 db.rows.media.set('fiction-image',afterMedia[0]);db.rows.pcWorkbooks.set('fiction-pc',afterBooks[0]);storage.setItem(api.KEY,JSON.stringify(marker));
 const outcome=await api.recover({storage,openDb:async()=>db,verifyOriginal:async(a,b)=>verifyOriginal(db,a,b)});
 assert.equal(outcome.status,'rolled-back');assert.equal(storage.getItem(key),old);assert.equal(storage.getItem(api.KEY),null);assert.equal(db.rows.migrationJournal.size,0);
});
async function strictV2Evidence(media,books){
 const v1=await legacyV1Evidence(media,books);
 const expand=(items,rows,key)=>items.map(item=>{const row=rows.find(x=>x[key]===item.key);return {...item,blobType:row.blob.type,thumbType:row.thumbBlob?row.thumbBlob.type:null};});
 return {version:2,media:expand(v1.media,media,'id'),workbooks:expand(v1.workbooks,books,'pcId')};
}
test('Round191 strict v2 settled journal clears only after MIME-correct native-store evidence',async()=>{
 const {db,storage}=setup(),api=engine(),id='abcdef01-2345-6789-abcd-abcdef012345';
 const originals=[image(),workbook()],targets=[image(),workbook()];
 const marker={version:1,id,phase:'settled',createdAt:1,beforeHash:await shaRaw(old),targetHash:await shaRaw(next),settlement:'target'};
 db.rows.migrationJournal.set('active',{id:'active',transactionId:id,createdAt:1,beforeRaw:old,
  originalMedia:[originals[0]],originalWorkbooks:[originals[1]],targetEvidence:await strictV2Evidence([targets[0]],[targets[1]])});
 db.rows.media.set('fiction-image',targets[0]);db.rows.pcWorkbooks.set('fiction-pc',targets[1]);storage.setItem(key,next);storage.setItem(api.KEY,JSON.stringify(marker));
 const result=await engine().recover({storage,openDb:async()=>db,verifyOriginal:async(a,b)=>verifyOriginal(db,a,b)});
 assert.equal(result.status,'committed');assert.equal(storage.getItem(api.KEY),null);assert.equal(db.rows.migrationJournal.size,0);
});
test('Round191 strict v2 settled journal keeps archive, marker and original bytes if MIME drifts after restart',async()=>{
 const {db,storage}=setup(),api=engine(),id='abcdef01-2345-6789-abcd-abcdef012345';
 const beforeMedia=[image()],beforeBooks=[workbook()],afterMedia=[image()],afterBooks=[workbook()];
 const marker={version:1,id,phase:'settled',createdAt:1,beforeHash:await shaRaw(old),targetHash:await shaRaw(next),settlement:'target'};
 db.rows.migrationJournal.set('active',{id:'active',transactionId:id,createdAt:1,beforeRaw:old,
  originalMedia:beforeMedia,originalWorkbooks:beforeBooks,targetEvidence:await strictV2Evidence(afterMedia,afterBooks)});
 db.rows.media.set('fiction-image',image('image/jpeg'));
 db.rows.pcWorkbooks.set('fiction-pc',afterBooks[0]);storage.setItem(key,next);storage.setItem(api.KEY,JSON.stringify(marker));
 await assert.rejects(engine().recover({storage,openDb:async()=>db,verifyOriginal:async(a,b)=>verifyOriginal(db,a,b)}),/证据不一致/);
 assert.equal(storage.getItem(key),next);assert.ok(storage.getItem(api.KEY));assert.equal(db.rows.migrationJournal.size,1);
 const journal=db.rows.migrationJournal.get('active');assert.equal(journal.originalMedia[0].blob.type,'image/png');
});
test('Round191 source, strict MIME evidence and separate native gate are mandatory CI contracts',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(migration,/blobType/);assert.match(migration,/thumbType/);
 assert.match(workflow,/round191-restore-mime-evidence\.test\.cjs/);
 assert.match(workflow,/round187-native-fullapp-restore-browser\.py/);
});
