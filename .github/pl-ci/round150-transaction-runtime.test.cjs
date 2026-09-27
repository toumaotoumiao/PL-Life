'use strict';
// Runs the production transaction engine against a deterministic transactional
// IndexedDB adapter; not a claim of physical-browser storage acceptance.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.resolve(__dirname,'../../data-migration-transaction.js'),'utf8');
const clone=x=>structuredClone(x);
const delay=()=>new Promise(resolve=>setImmediate(resolve));
class MemoryStorage{
 constructor(entries){this.rows=new Map(Object.entries(entries||{}));}
 getItem(k){return this.rows.has(k)?this.rows.get(k):null;}
 setItem(k,v){this.rows.set(String(k),String(v));}
 removeItem(k){this.rows.delete(k);}
}
class InMemoryIDB{
 constructor(){this.rows={media:new Map(),pcWorkbooks:new Map(),migrationJournal:new Map()};this.objectStoreNames={contains:name=>Object.prototype.hasOwnProperty.call(this.rows,name)};}
 transaction(names,mode='readonly'){
  const db=this,own=Object.fromEntries(names.map(name=>[name,new Map([...db.rows[name]].map(([k,v])=>[k,clone(v)]))]));
  let pending=0,closing=false,closed=false,aborted=false;
  const tx={error:null,oncomplete:null,onerror:null,onabort:null,
   abort(){if(closed)return;aborted=true;closed=true;setImmediate(()=>tx.onabort?.());},
   objectStore(name){if(!own[name])throw Error('missing store '+name);
    const store=own[name],key=name==='media'?'id':name==='pcWorkbooks'?'pcId':'id';
    const request=fn=>{if(closed||aborted)throw Error('inactive transaction');pending++;
     const result={result:undefined,error:null,onsuccess:null,onerror:null};setImmediate(()=>{
      if(aborted)return;
      try{result.result=fn();result.onsuccess?.();}catch(err){result.error=err;result.onerror?.();tx.error=err;tx.abort();}
      pending--;if(!pending)schedule();
     });return result;
    };
    return {
     get(id){return request(()=>clone(store.get(String(id))));},
     getAll(){return request(()=>[...store.values()].map(clone));},
     put(value){if(mode==='readonly')throw Error('readonly');if(!value||typeof value[key]!=='string')throw Error('invalid key');return request(()=>{store.set(value[key],clone(value));return value[key];});},
     delete(id){if(mode==='readonly')throw Error('readonly');return request(()=>store.delete(String(id)));},
     clear(){if(mode==='readonly')throw Error('readonly');return request(()=>store.clear());}
    };
   }
  };
  function schedule(){if(pending||closing||closed||aborted)return;closing=true;setImmediate(()=>{
    closing=false;if(pending||closed||aborted)return;
    if(mode==='readwrite')for(const name of names)db.rows[name]=own[name];
    closed=true;tx.oncomplete?.();
  });}
  return tx;
 }
}
function engine(){
 const context={crypto:webcrypto,TextEncoder,Blob,console,Date,structuredClone};context.window=context;
 vm.createContext(context);vm.runInContext(source,context);return context.PLDataMigrationTransaction;
}
async function rows(db,name){
 const tx=db.transaction([name],'readonly');const req=tx.objectStore(name).getAll();
 return await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
const bytes=blob=>blob.arrayBuffer().then(b=>Array.from(new Uint8Array(b)));
const mk=(key,value)=>({[key]:key==='id'?'image':'pc1',pcId:'pc1',name:value,blob:new Blob([value]),createdAt:1});
const key='trpg_pl_profile_archive_v1';
const old=JSON.stringify({schemaVersion:26,data:{pcs:[{id:'pc1',coc:{san:55}}]}});
const next=JSON.stringify({schemaVersion:26,data:{pcs:[{id:'pc1',ruleMeta:{systemId:'insane'},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}]}}}]}});
function setup(){const db=new InMemoryIDB(),storage=new MemoryStorage({[key]:old});db.rows.media.set('image',mk('id','OLD_IMAGE'));db.rows.pcWorkbooks.set('pc1',mk('pcId','OLD_WORKBOOK'));return{db,storage};}
const check=async(db,media,books)=>{
 assert.equal((await rows(db,'media'))[0].name,media);
 assert.equal((await rows(db,'pcWorkbooks'))[0].name,books);
};
test('Round150 production transaction commits new source+image+Excel, survives new engine context and reread',async()=>{
 const {db,storage}=setup(),api=engine(),media=[mk('id','NEW_IMAGE')],workbooks=[mk('pcId','NEW_WORKBOOK')];
 const response=await api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:media,workbookRows:workbooks,
  verifyTarget:async()=>check(db,'NEW_IMAGE','NEW_WORKBOOK'),verifyOriginal:async()=>check(db,'OLD_IMAGE','OLD_WORKBOOK'),
  commitArchive:async()=>storage.setItem(key,next),verifyArchive:async text=>assert.equal(text,next)});
 assert.equal(response.status,'committed');assert.equal(storage.getItem(key),next);assert.equal(storage.getItem(api.KEY),null);
 await check(db,'NEW_IMAGE','NEW_WORKBOOK');const afterReload=engine();assert.equal((await afterReload.recover({storage,openDb:async()=>db,verifyOriginal:async()=>{}})).status,'idle');
 assert.equal(JSON.parse(storage.getItem(key)).data.pcs[0].ruleSheets.insane.traits[0].value,'6');
 assert.deepEqual(await bytes((await rows(db,'pcWorkbooks'))[0].blob),await bytes(workbooks[0].blob));
});
test('Round150 failure before archive write rolls back original attachment stores and archive',async()=>{
 const {db,storage}=setup(),api=engine();
 await assert.rejects(api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:[mk('id','NEW_IMAGE')],workbookRows:[mk('pcId','NEW_WORKBOOK')],
  verifyTarget:async()=>{throw Error('injected attachment readback failure');},verifyOriginal:async()=>check(db,'OLD_IMAGE','OLD_WORKBOOK'),
  commitArchive:async()=>storage.setItem(key,next),verifyArchive:async()=>{} }),/injected attachment readback failure/);
 assert.equal(storage.getItem(key),old);await check(db,'OLD_IMAGE','OLD_WORKBOOK');assert.equal(storage.getItem(api.KEY),null);
});
test('Round150 unverified changed archive is never silently overwritten; journal retained for review',async()=>{
 const {db,storage}=setup(),api=engine();
 await assert.rejects(api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:[mk('id','NEW_IMAGE')],workbookRows:[mk('pcId','NEW_WORKBOOK')],
  verifyTarget:async()=>check(db,'NEW_IMAGE','NEW_WORKBOOK'),verifyOriginal:async()=>check(db,'OLD_IMAGE','OLD_WORKBOOK'),
  commitArchive:async()=>storage.setItem(key,next),verifyArchive:async()=>{throw Error('injected source evidence mismatch');}}),/自动恢复未完成/);
 assert.equal(storage.getItem(key),next);assert.ok(storage.getItem(api.KEY));assert.equal((await rows(db,'migrationJournal')).length,1);
 await check(db,'NEW_IMAGE','NEW_WORKBOOK');
 await assert.rejects(engine().recover({storage,openDb:async()=>db,verifyOriginal:async()=>{}}),/未确认的新版本/);
 assert.ok(storage.getItem(api.KEY));
});
test('Round150 refused source drift before transaction preserves both original stores and local archive',async()=>{
 const {db,storage}=setup(),api=engine();storage.setItem(key,'newer third party archive');
 await assert.rejects(api.run({storage,openDb:async()=>db,expectedOriginalRaw:old,mediaRows:[mk('id','NEW_IMAGE')],workbookRows:[mk('pcId','NEW_WORKBOOK')],commitArchive:async()=>{},verifyTarget:async()=>{},verifyOriginal:async()=>{},verifyArchive:async()=>{}}),/期间主档案已变化/);
 await check(db,'OLD_IMAGE','OLD_WORKBOOK');assert.equal(storage.getItem(api.KEY),null);
});
