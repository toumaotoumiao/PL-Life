/* PL收集梦想生活 · runtime environment isolation.
 * GitHub Pages repositories share one origin, so pathname-specific namespaces
 * are required for storage, IndexedDB, caches and cross-tab channels. */
(function(root){
'use strict';
const TEST_PATH=/\/PL-Life-Test(?:\/|$)/i;
const isTest=Boolean(root.location&&TEST_PATH.test(String(root.location.pathname||'')));
const STORAGE_PREFIX='pl-life-test::';
const DB_PREFIX='pl-life-test__';
const CHANNEL_PREFIX='pl-life-test::';
const LOCAL_MARKER=STORAGE_PREFIX+'__isolation_local_migrated_v1';
const IDB_MARKER_PREFIX=STORAGE_PREFIX+'__isolation_idb_migrated_v1::';
const ENVIRONMENT_MARKER=STORAGE_PREFIX+'__isolation_environment_complete_v1';
const rawStorageGet=Storage.prototype.getItem;
const rawStorageSet=Storage.prototype.setItem;
const rawStorageRemove=Storage.prototype.removeItem;
const rawStorageKey=Storage.prototype.key;
const local=root.localStorage,session=root.sessionStorage;
const copiedLocal={copied:0,skipped:0,sourceSchema:null,sourceVersion:'',justMigrated:false};
function textKey(key){return String(key==null?'':key);}
function physicalStorageKey(key){return isTest?STORAGE_PREFIX+textKey(key):textKey(key);}
function logicalStorageKey(key){const s=textKey(key);return isTest&&s.startsWith(STORAGE_PREFIX)?s.slice(STORAGE_PREFIX.length):s;}
function isOwnedLegacyKey(key){const s=textKey(key);return /^(?:tomato_|trpg_|pl_|__pl_life_)/.test(s);}
function skipLegacyCopy(key){const s=textKey(key);return /external_backup|save_lock|download_pending|last_export_meta|update_applied|last_startup_check|trpg_last_version_check/.test(s);}
function rawKeys(storage){const out=[];for(let i=0;i<storage.length;i++){const k=rawStorageKey.call(storage,i);if(k!=null)out.push(String(k));}return out;}
function migrateLegacyLocalStorage(){
  if(!isTest||!local)return;
  if(rawStorageGet.call(local,LOCAL_MARKER)!==null)return;
  for(const key of rawKeys(local)){
    if(key.startsWith(STORAGE_PREFIX)||!isOwnedLegacyKey(key)||skipLegacyCopy(key))continue;
    const dest=STORAGE_PREFIX+key;
    if(rawStorageGet.call(local,dest)!==null){copiedLocal.skipped++;continue;}
    const value=rawStorageGet.call(local,key);
    if(value===null)continue;
    try{rawStorageSet.call(local,dest,value);copiedLocal.copied++;}catch(_){copiedLocal.skipped++;}
  }
  try{
    const raw=rawStorageGet.call(local,STORAGE_PREFIX+'trpg_pl_profile_archive_v1');
    if(raw){const parsed=JSON.parse(raw);copiedLocal.sourceSchema=Number(parsed?.schemaVersion)||null;copiedLocal.sourceVersion=String(parsed?.app?.uiVersion||'');}
  }catch(_){}
  copiedLocal.justMigrated=true;
  rawStorageSet.call(local,LOCAL_MARKER,JSON.stringify({version:1,copiedAt:Date.now(),copied:copiedLocal.copied,skipped:copiedLocal.skipped,sourceSchema:copiedLocal.sourceSchema,sourceVersion:copiedLocal.sourceVersion}));
}
migrateLegacyLocalStorage();
if(isTest){
  Storage.prototype.getItem=function(key){return rawStorageGet.call(this,physicalStorageKey(key));};
  Storage.prototype.setItem=function(key,value){return rawStorageSet.call(this,physicalStorageKey(key),String(value));};
  Storage.prototype.removeItem=function(key){return rawStorageRemove.call(this,physicalStorageKey(key));};
}
function storageKeys(storage){
  const keys=rawKeys(storage||local);
  if(!isTest)return keys;
  return keys.filter(k=>k.startsWith(STORAGE_PREFIX)).map(k=>k.slice(STORAGE_PREFIX.length));
}
function databaseName(base){return isTest?DB_PREFIX+String(base):String(base);}
function channelName(base){return isTest?CHANNEL_PREFIX+String(base):String(base);}
function runtimeDownloadCacheName(){return isTest?'pl-life-test-runtime-downloads-v1':'pl-life-prod-runtime-downloads-v1';}
function programCachePrefix(){return isTest?'pl-life-test-':'pl-life-prod-';}
async function databaseList(){
  if(!root.indexedDB||typeof root.indexedDB.databases!=='function')return null;
  try{return await root.indexedDB.databases();}catch(_){return null;}
}
function requestResult(req,label){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error(label||'IndexedDB request failed'));});}
function txDone(tx,label){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error(label||'IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error||new Error(label||'IndexedDB transaction aborted'));});}
async function openExistingDb(name){
  const req=root.indexedDB.open(name);
  return new Promise((resolve,reject)=>{
    let created=false;
    req.onupgradeneeded=()=>{created=true;try{req.transaction.abort();}catch(_){}};
    req.onsuccess=()=>{if(created){try{req.result.close();}catch(_){}resolve(null);}else resolve(req.result);};
    req.onerror=()=>{if(created&&req.error?.name==='AbortError')resolve(null);else reject(req.error||new Error('无法打开旧数据库'));};
  });
}
async function readStoreRows(db,name){
  const tx=db.transaction(name,'readonly'),store=tx.objectStore(name),rows=[];
  await new Promise((resolve,reject)=>{
    const req=store.openCursor();
    req.onsuccess=()=>{const c=req.result;if(!c){resolve();return;}rows.push({key:c.primaryKey,value:c.value});c.continue();};
    req.onerror=()=>reject(req.error||new Error('读取旧数据库失败'));
  });
  await txDone(tx,'读取旧数据库失败');
  return rows;
}
async function cloneDatabase(sourceName,destName){
  const source=await openExistingDb(sourceName);if(!source)return {copied:false,reason:'source-missing'};
  try{
    const schema=[],data=new Map();
    for(const name of Array.from(source.objectStoreNames)){
      const tx=source.transaction(name,'readonly'),store=tx.objectStore(name),indexes=[];
      for(const idxName of Array.from(store.indexNames)){const idx=store.index(idxName);indexes.push({name:idx.name,keyPath:idx.keyPath,unique:idx.unique,multiEntry:idx.multiEntry});}
      schema.push({name,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes});
      data.set(name,await readStoreRows(source,name));
    }
    const version=Math.max(1,Number(source.version)||1);
    const createReq=root.indexedDB.open(destName,version);
    const dest=await new Promise((resolve,reject)=>{
      createReq.onupgradeneeded=()=>{const db=createReq.result;for(const def of schema){if(db.objectStoreNames.contains(def.name))continue;const options={autoIncrement:def.autoIncrement};if(def.keyPath!=null)options.keyPath=def.keyPath;const st=db.createObjectStore(def.name,options);for(const idx of def.indexes)st.createIndex(idx.name,idx.keyPath,{unique:idx.unique,multiEntry:idx.multiEntry});}};
      createReq.onsuccess=()=>resolve(createReq.result);createReq.onerror=()=>reject(createReq.error||new Error('创建测试站独立数据库失败'));
    });
    try{
      if(schema.length){const tx=dest.transaction(schema.map(x=>x.name),'readwrite');for(const def of schema){const st=tx.objectStore(def.name);for(const row of data.get(def.name)||[]){if(st.keyPath==null)st.put(row.value,row.key);else st.put(row.value);}}await txDone(tx,'复制测试站数据库失败');}
    }finally{dest.close();}
    return {copied:true,stores:schema.length,version};
  }catch(err){try{root.indexedDB.deleteDatabase(destName);}catch(_){}throw err;}finally{source.close();}
}
async function databaseExists(name){
  const list=await databaseList();
  if(list)return list.some(x=>String(x?.name||'')===String(name));
  // Safari / embedded mobile browsers may not expose indexedDB.databases().
  // Probe without creating: openExistingDb aborts onupgradeneeded for a missing DB.
  const db=await openExistingDb(String(name));
  if(!db)return false;
  try{return true;}finally{try{db.close();}catch(_){}}
}
const idbPromises=new Map();
async function ensureDatabaseMigrated(base,{copyLegacy=true}={}){
  if(!isTest||!copyLegacy||!root.indexedDB)return {copied:false,reason:'not-required'};
  const logical=String(base),dest=databaseName(logical),marker=IDB_MARKER_PREFIX+logical;
  let prior=null;try{prior=JSON.parse(rawStorageGet.call(local,marker)||'null');}catch(_){}
  if(prior?.state==='complete')return {copied:Boolean(prior.copied),reason:'already-checked'};
  if(idbPromises.has(logical))return idbPromises.get(logical);
  const p=(async()=>{
    const sourceExists=await databaseExists(logical);
    const destExists=await databaseExists(dest);
    if(!sourceExists){
      rawStorageSet.call(local,marker,JSON.stringify({version:1,state:'complete',checkedAt:Date.now(),copied:false,reason:destExists?'destination-only':'source-missing'}));
      return {copied:false,reason:destExists?'destination-only':'source-missing'};
    }
    // No completed marker means this database has never been handed to the app as an
    // isolated source. If a prior migration was interrupted, remove only the TEST copy
    // and repeat from the untouched legacy database; never delete the source database.
    if(destExists)await new Promise((resolve,reject)=>{const q=root.indexedDB.deleteDatabase(dest);q.onsuccess=()=>resolve();q.onerror=()=>reject(q.error||new Error('无法清理未完成的测试站数据库副本'));q.onblocked=()=>reject(new Error('测试站数据库副本仍被其他标签页占用，请关闭旧测试站标签页后重试'));});
    rawStorageSet.call(local,marker,JSON.stringify({version:1,state:'copying',startedAt:Date.now(),source:logical,destination:dest}));
    const result=await cloneDatabase(logical,dest);
    rawStorageSet.call(local,marker,JSON.stringify({version:1,state:'complete',checkedAt:Date.now(),copied:Boolean(result.copied),stores:Number(result.stores||0),source:logical,destination:dest}));
    return result;
  })().finally(()=>idbPromises.delete(logical));
  idbPromises.set(logical,p);return p;
}
const criticalDatabaseBases=Object.freeze([
  'tomato_trpg_recovery_v1',
  'tomato_pl_primary_mirror_v1',
  'tomato_pl_pc_media_v1'
]);
// Freeze the test site's critical browser databases immediately on first v161 load.
// Later app opens share the same in-flight promise through idbPromises. Filesystem
// authorization (tomato_pl_external_backup_v1) is intentionally excluded.
const environmentWasComplete=isTest&&rawStorageGet.call(local,ENVIRONMENT_MARKER)!==null;
const criticalDatabaseMigration=isTest
  ? Promise.allSettled(criticalDatabaseBases.map(base=>ensureDatabaseMigrated(base)))
  : Promise.resolve([]);
const environmentIsolationReady=criticalDatabaseMigration.then(results=>{
  const failed=results.filter(x=>x.status==='rejected');
  const complete=!isTest||failed.length===0;
  const info={complete,justCompleted:Boolean(isTest&&complete&&!environmentWasComplete),failed:failed.length,results};
  if(isTest&&complete){
    rawStorageSet.call(local,ENVIRONMENT_MARKER,JSON.stringify({version:1,completedAt:Date.now(),storagePrefix:STORAGE_PREFIX,dbPrefix:DB_PREFIX,criticalDatabases:Array.from(criticalDatabaseBases)}));
  }
  return info;
});
root.PLRuntimeEnvironment=Object.freeze({
  version:1,isTest,mode:isTest?'test':'production',storagePrefix:isTest?STORAGE_PREFIX:'',dbPrefix:isTest?DB_PREFIX:'',
  physicalStorageKey,logicalStorageKey,storageKeys,databaseName,channelName,runtimeDownloadCacheName,programCachePrefix,
  ensureDatabaseMigrated,criticalDatabaseBases,criticalDatabaseMigration,environmentIsolationReady,environmentWasComplete,localMigration:Object.freeze({...copiedLocal}),
  rawLocalStorageGet:key=>rawStorageGet.call(local,String(key)),rawLocalStorageSet:(key,value)=>rawStorageSet.call(local,String(key),String(value))
});
})(typeof window!=='undefined'?window:globalThis);
