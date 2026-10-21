'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const first=html.indexOf('/* Stage143: deliberately scoped');
const last=html.indexOf('/* End Stage143 device reset. */',first);
assert(first>0&&last>first,'reset implementation must be present');
const impl=html.slice(first,last);
function store(data){const map=new Map(Object.entries(data));return {
 get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.has(k)?map.get(k):null,
 removeItem:k=>{map.delete(k)},setItem:(k,v)=>map.set(k,v),entries:()=>[...map.entries()]
};}
function setup(storageData){
 const local=store(storageData),session=store({'tomato_pl_share_mode_v1':'1','other-app-session':'keep'});
 const context={window:{PLRuntimeEnvironment:{storageKeys:s=>s.entries().map(([k])=>k)}},
 localStorage:local,sessionStorage:session,console,STORAGE_KEY:'trpg_pl_profile_archive_v1',
 PC_MEDIA_DB_NAME:'tomato_pl_pc_media_v1',RECOVERY_DB_NAME:'tomato_trpg_recovery_v1',
 PRIMARY_MIRROR_DB_NAME:'tomato_pl_primary_mirror_v1',EXTERNAL_BACKUP_DB_NAME:'tomato_pl_external_backup_v1',
 CROSS_REFRESH_PROBE_DB:'pl_life_qa_cross_refresh_v1'};
 vm.createContext(context);new vm.Script(impl).runInContext(context);
 return {local,session,reset:params=>context.plDeviceResetStorageCore({...params,status:()=>{}}),context};
}
test('scoped reset deletes PL keys and owned DBs, not unrelated same-origin data',async()=>{
 const t=setup({'trpg_pl_profile_archive_v1':'DATA','tomato_pl_trash_v1':'HISTORY','third-party-state':'PRESERVE'}),called=[];
 const result=await t.reset({storage:t.local,session:t.session,dbNames:['db-pc','db-history'],removeDb:async n=>called.push(n),checkDb:async()=>[]});
 assert.deepEqual(called,['db-pc','db-history']);assert.equal(result.databases,2);
 assert.equal(t.local.getItem('trpg_pl_profile_archive_v1'),null);
 assert.equal(t.local.getItem('tomato_pl_trash_v1'),null);
 assert.equal(t.local.getItem('third-party-state'),'PRESERVE');
 assert.equal(t.session.getItem('other-app-session'),'keep');
 assert.equal(t.session.getItem('tomato_pl_share_mode_v1'),null);
});
test('failed IndexedDB deletion preserves authoritative archive and does not claim completion',async()=>{
 const t=setup({'trpg_pl_profile_archive_v1':'DATA','tomato_pl_trash_v1':'HISTORY'});
 await assert.rejects(t.reset({storage:t.local,session:t.session,dbNames:['db-pc'],removeDb:async()=>{throw Error('NotReadableError')},checkDb:async()=>[]}),/NotReadableError/);
 assert.equal(t.local.getItem('trpg_pl_profile_archive_v1'),'DATA');
 assert.equal(t.local.getItem('tomato_pl_trash_v1'),'HISTORY');
});
test('database readback disagreement stops before local archive deletion',async()=>{
 const t=setup({'trpg_pl_profile_archive_v1':'DATA'});
 await assert.rejects(t.reset({storage:t.local,session:t.session,dbNames:['db-pc'],removeDb:async()=>{},checkDb:async()=>[{name:'db-pc'}]}),/数据库删除未能全部确认/);
 assert.equal(t.local.getItem('trpg_pl_profile_archive_v1'),'DATA');
});
test('cross-tab source changes interrupt reset before main archive is removed',async()=>{
 const t=setup({'trpg_pl_profile_archive_v1':'ORIGINAL'}),before='ORIGINAL';
 await assert.rejects(t.reset({storage:t.local,session:t.session,dbNames:['db-pc','db-recovery'],removeDb:async n=>{if(n==='db-pc')t.local.setItem('trpg_pl_profile_archive_v1','OTHER-TAB')},checkCurrent:()=>{if(t.local.getItem('trpg_pl_profile_archive_v1')!==before)throw Error('other tab mutation')},checkDb:async()=>[]}),/other tab mutation/);
 assert.equal(t.local.getItem('trpg_pl_profile_archive_v1'),'OTHER-TAB');
});
test('danger action requires verified ZIP and explicit phrase; never uses origin-wide clear',()=>{
 assert.match(html,/id="plDeviceResetBackupFile"[^>]+accept="\.zip,application\/zip"/);
 assert.match(html,/id="plDeviceResetButton"[^>]+disabled/);
 assert.match(impl,/verifyCompleteBackupZipFile\(file\)/);
 assert.match(impl,/appPhraseConfirm\([^;]+PL_DEVICE_RESET_CONFIRM_TEXT/);
 assert.doesNotMatch(impl,/localStorage\.clear\s*\(/);
 assert.doesNotMatch(impl,/indexedDB\.deleteDatabase\s*\([^)]*database[s]?\(\)/);
});
