const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'runtime-environment.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

function boot(pathname,initial={}){
  class Storage{
    constructor(seed={}){this.map=new Map(Object.entries(seed));}
    get length(){return this.map.size;}
    key(i){return Array.from(this.map.keys())[i]??null;}
    getItem(k){k=String(k);return this.map.has(k)?this.map.get(k):null;}
    setItem(k,v){this.map.set(String(k),String(v));}
    removeItem(k){this.map.delete(String(k));}
  }
  const localStorage=new Storage(initial),sessionStorage=new Storage();
  const window={location:{pathname},localStorage,sessionStorage,indexedDB:null};
  window.window=window;
  const context={window,globalThis:window,Storage,localStorage,sessionStorage,console};
  vm.runInNewContext(runtime,context,{filename:'runtime-environment.js'});
  return {env:window.PLRuntimeEnvironment,localStorage,sessionStorage};
}

test('test pathname copies legacy archive without overwriting it, then writes only the test namespace',()=>{
  const archive=JSON.stringify({format:'tomato-pl-archive',schemaVersion:26,app:{uiVersion:'8.1.12.160'},data:{profiles:[],modules:[],runs:[],pcs:[]}});
  const {env,localStorage}=boot('/PL-Life-Test/',{
    trpg_pl_profile_archive_v1:archive,
    tomato_pl_disclaimer_collapsed_v2:'1',
    tomato_pl_external_backup_enabled_v1:'1'
  });
  assert.equal(env.isTest,true);
  assert.equal(env.storagePrefix,'pl-life-test::');
  assert.equal(localStorage.getItem('trpg_pl_profile_archive_v1'),archive);
  assert.equal(env.rawLocalStorageGet('trpg_pl_profile_archive_v1'),archive,'legacy production archive must remain byte-for-byte');
  assert.equal(env.rawLocalStorageGet('pl-life-test::trpg_pl_profile_archive_v1'),archive,'test copy should be created');
  assert.equal(localStorage.getItem('tomato_pl_disclaimer_collapsed_v2'),'1');
  assert.equal(localStorage.getItem('tomato_pl_external_backup_enabled_v1'),null,'external backup permission/state must not be inherited');
  localStorage.setItem('trpg_pl_profile_archive_v1','TEST-ONLY');
  assert.equal(env.rawLocalStorageGet('pl-life-test::trpg_pl_profile_archive_v1'),'TEST-ONLY');
  assert.equal(env.rawLocalStorageGet('trpg_pl_profile_archive_v1'),archive,'test save must not change production archive');
  assert.equal(env.databaseName('tomato_pl_pc_media_v1'),'pl-life-test__tomato_pl_pc_media_v1');
  assert.equal(env.channelName('tomato_pl_sync_v1'),'pl-life-test::tomato_pl_sync_v1');
  assert.equal(env.runtimeDownloadCacheName(),'pl-life-test-runtime-downloads-v1');
});

test('production pathname keeps legacy storage and runtime names unchanged',()=>{
  const {env,localStorage}=boot('/PL-Life/',{trpg_pl_profile_archive_v1:'PROD'});
  assert.equal(env.isTest,false);
  assert.equal(localStorage.getItem('trpg_pl_profile_archive_v1'),'PROD');
  localStorage.setItem('trpg_pl_profile_archive_v1','PROD2');
  assert.equal(env.rawLocalStorageGet('trpg_pl_profile_archive_v1'),'PROD2');
  assert.equal(env.databaseName('tomato_pl_pc_media_v1'),'tomato_pl_pc_media_v1');
  assert.equal(env.channelName('tomato_pl_sync_v1'),'tomato_pl_sync_v1');
  assert.equal(env.runtimeDownloadCacheName(),'pl-life-prod-runtime-downloads-v1');
});

test('service worker cache namespace derives from registration scope and cannot purge the other site',()=>{
  assert.match(sw,/IS_TEST_SCOPE=.*PL-Life-Test/);
  assert.match(sw,/CACHE_PREFIX=IS_TEST_SCOPE\?"pl-life-test-":"pl-life-prod-"/);
  assert.match(sw,/RUNTIME_DOWNLOAD_CACHE=IS_TEST_SCOPE\?"pl-life-test-runtime-downloads-v1":"pl-life-prod-runtime-downloads-v1"/);
  assert.match(sw,/keys\.filter\(key=>key\.startsWith\(CACHE_PREFIX\)/,'activate cleanup must be limited to current environment prefix');
  assert.match(sw,/\.\/runtime-environment\.js/,'runtime isolation must be part of the atomic app shell');
  assert.match(sw,/程序文件需要修复/,'missing program shell must show a user-facing repair page');
  assert.match(sw,/navigator\.serviceWorker\.getRegistrations/);
  assert.match(sw,/keys\.filter\(k=>k\.startsWith\(\$\{prefix\}\)\)/,'repair page must delete only this environment cache prefix');
  assert.doesNotMatch(sw,/localStorage\.(?:clear|removeItem)/,'service-worker repair must not clear user archive storage');
});

test('recovery, mirror and PC media use isolated DB names and eagerly freeze legacy DBs, while external backup authorization is not copied',()=>{
  assert.match(html,/RECOVERY_DB_BASE_NAME = "tomato_trpg_recovery_v1"/);
  assert.match(html,/ensureDatabaseMigrated\(RECOVERY_DB_BASE_NAME\)/);
  assert.match(html,/PRIMARY_MIRROR_DB_BASE_NAME = "tomato_pl_primary_mirror_v1"/);
  assert.match(html,/ensureDatabaseMigrated\(PRIMARY_MIRROR_DB_BASE_NAME\)/);
  assert.match(html,/PC_MEDIA_DB_BASE_NAME="tomato_pl_pc_media_v1"/);
  assert.match(html,/ensureDatabaseMigrated\(PC_MEDIA_DB_BASE_NAME\)/);
  assert.match(runtime,/async function databaseExists\(name\)/,'IndexedDB migration must have a cross-browser existence probe');
  assert.doesNotMatch(runtime,/database-list-unavailable/,'missing indexedDB.databases() must not disable legacy DB isolation copy');
  assert.match(runtime,/criticalDatabaseBases=Object\.freeze\(\[/,'critical test DBs must be snapshotted on first isolated load');
  assert.match(runtime,/tomato_trpg_recovery_v1/);
  assert.match(runtime,/tomato_pl_primary_mirror_v1/);
  assert.match(runtime,/tomato_pl_pc_media_v1/);
  assert.match(runtime,/Promise\.allSettled\(criticalDatabaseBases\.map\(base=>ensureDatabaseMigrated\(base\)\)\)/);
  assert.match(runtime,/environmentIsolationReady=criticalDatabaseMigration\.then/,'isolation completion must wait for all critical database checks');
  assert.match(runtime,/ENVIRONMENT_MARKER/,'a durable environment-complete marker is required');
  const criticalList=runtime.match(/criticalDatabaseBases=Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(criticalList,'critical database list must be readable by the release contract');
  assert.doesNotMatch(criticalList[1],/external_backup/,'external backup authorization DB must not be eagerly copied');
  assert.match(html,/EXTERNAL_BACKUP_DB_BASE_NAME = "tomato_pl_external_backup_v1"/);
  assert.doesNotMatch(html,/ensureDatabaseMigrated\(EXTERNAL_BACKUP_DB_BASE_NAME\)/,'filesystem authorization must not be inherited into test');
});

test('isolation completion is only reported after critical database migration finishes',()=>{
  assert.match(html,/environmentIsolationReady\?\.then/);
  assert.match(html,/测试站数据已完成独立隔离/);
  assert.match(html,/在出现‘测试站数据已完成独立隔离’前，不要恢复或改写正式站/);
});

test('cross-tab sync and storage events are environment-aware',()=>{
  assert.match(html,/MULTITAB_CHANNEL_NAME = window\.PLRuntimeEnvironment\?\.channelName/);
  assert.match(html,/logicalStorageKey\?\.\(e\.key\)/);
  assert.match(html,/storageKeys\?\.\(localStorage\)/,'localStorage scans must not wander into production keys from test');
});
