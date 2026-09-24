'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`missing ${a}`);return html.slice(i,j)};
const logCode=cut('function normalizeLogRows(','\nfunction isoDatePart(');
const guardCode=cut('function assertRunLogInputPreserved()','function assertPcCollectionInputPreserved(');
function notesContext(){const c={MAX_LOG_URLS:12,MAX_LOG_LABEL_LENGTH:30,runPlans:[],runRecords:[],escapeHTML:s=>String(s),safeLogUrl:s=>s};vm.createContext(c);vm.runInContext(logCode+guardCode,c);return c;}
test('legacy note-only rows with NO logUrls are reconstructed and save guard accepts them',()=>{
 const c=notesContext();
 for(const entity of [{id:'older-plan',logLabels:['只存备注'],logUrl:''},{id:'older-record',logLabels:['甲','乙'],logUrls:[''],logUrl:''}]){
  c.runPlans=[entity];c.runRecords=[];assert.doesNotThrow(()=>c.assertRunLogInputPreserved());
  assert.deepEqual(Array.from(c.normalizeLogRows(entity,true),r=>({url:r.url,label:r.label})),entity.logLabels.map(label=>({url:'',label})));
 }
});
test('a deliberately conflicting Log or excessive entry still blocks saving without truncation',()=>{
 const c=notesContext();c.runPlans=[{id:'conflict',logUrls:['https://example.invalid/a','https://example.invalid/a'],logLabels:['甲','乙']}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/相同网址但名称不同/);
 c.runPlans=[{id:'too-many',logLabels:Array.from({length:13},(_,i)=>'第'+i+'条')}];
 assert.throws(()=>c.assertRunLogInputPreserved(),/超过 12 个/);
});
function saveContext({failKey='',failUI=false}={}){
 const c=notesContext(),db=new Map(),alerts=[],warnings=[];
 Object.assign(c,{
  console:{log(){},error(...args){warnings.push(args)},warn(...args){warnings.push(args)}},
  STORAGE_KEY:'archive',SAVE_META_KEY:'saveMeta',LAST_APP_VERSION_KEY:'appVersion',FIRST_MEANINGFUL_SAVE_KEY:'firstSave',APP_UI_VERSION:'8.1.12.75',DATA_SCHEMA_VERSION:23,
  PLDataMigrationTransaction:{assertWritable(){},isCommitting(){return true}},PLDataMigrationGuard:{inspectText(){return {allowed:true}}},
  migrationReadOnly:false,pendingExternalSync:null,suppressDirtyPrompt:false,emergencyRecoveryInFlight:false,
  i18nInvalidateProtectedUserText(){},unseenStoredSaveMeta(){return null},markExternalSyncConflict(){},
  acquireMultiTabSaveLock(){return 'synthetic-lock'},releaseMultiTabSaveLock(){},
  stateBaseSaveNonce:'',stateBaseSaveLineage:[],tabInstanceId:'synthetic-tab',settings:{},profiles:[{id:'self'}],modules:[],pcs:[],
  ensureSelfProfileAndLinks: x=>x, assertPcCollectionInputPreserved(){},
  buildCanonicalArchive(){return {format:'test-only',data:{runs:[...c.runPlans,...c.runRecords].map(r=>({...r,logUrls:c.normalizeLogRows(r,true).filter(x=>x.url||x.label).map(x=>x.url),logLabels:c.normalizeLogRows(r,true).filter(x=>x.url||x.label).map(x=>x.label)}))}}},
  assertCanonicalIntegrity(payload){assert(Array.isArray(payload.data.runs))},
  archiveCountsFromPayload:p=>({plans:c.runPlans.length,records:c.runRecords.length}),
  archiveByteSizeFromString:s=>Buffer.byteLength(s),archiveDataFingerprint:p=>JSON.stringify(p.data),
  storedArchiveSaveMeta:p=>p?._localSave,safeParseStoredJson:text=>text?JSON.parse(text):null,
  localStorage:{getItem(k){return db.get(k)||null},setItem(k,v){if(k===failKey){const e=Error('simulated auxiliary or primary failure');e.name='QuotaExceededError';throw e;}db.set(k,v)}},
  uid:()=> 'synthetic-nonce',clone:x=>JSON.parse(JSON.stringify(x)),
  rememberRecentLocalCommit(){},observeSaveMeta(){},setStateBaseSaveMeta(){},
  moduleFrameDirty:false,searchIndexVersion:0,profileSearchCache:new Map(),moduleSearchCache:new Map(),
  hasMeaningfulData:()=>true,currentView:'plans',updateDataSafetyUI(){if(failUI)throw Error('view unavailable')},updateArchiveSizeHealth(){},
  appNotice:(...args)=>alerts.push(args),showToast(){},createRecoverySnapshot:async()=>null,
  document:{getElementById:()=>null},setTimeout(){},queueMicrotask(){},
 });
 vm.runInContext(cut('function saveState(options = {}) {','\nfunction enforceTopLevelUse()'),c);
 return {c,db,alerts,warnings};
}
test('plan + record note-only save and reload succeed even when diagnostic storage is full',()=>{
 const {c,db,alerts}=saveContext({failKey:'appVersion'});
 c.runPlans=[{id:'plan',logUrls:[''],logLabels:['计划备注'],logUrl:''}];c.runRecords=[{id:'record',logLabels:['记录备注'],logUrl:''}];
 assert.equal(c.saveState(),true);
 const persisted=JSON.parse(db.get('archive'));
 assert.deepEqual(persisted.data.runs.map(r=>Array.from(r.logLabels)),[['计划备注'],['记录备注']]);
 assert.deepEqual(persisted.data.runs.map(r=>Array.from(r.logUrls)),[[''],['']]);
 assert.equal(alerts.length,0,'a verified primary commit must not trigger a false save-failure modal');
});
test('UI refresh failure after a verified save is not reported as a storage failure',()=>{
 const {c,db,alerts}=saveContext({failUI:true});c.runRecords=[{id:'record',logUrls:[''],logLabels:['笔记']}];
 assert.equal(c.saveState(),true);assert(JSON.parse(db.get('archive'))._localSave.saveNonce);assert.equal(alerts.length,0);
});
test('actual PRIMARY write failure must remain a failure and never claim success',()=>{
 const {c,db,alerts}=saveContext({failKey:'archive'});c.runPlans=[{id:'plan',logUrls:[''],logLabels:['笔记']}];
 assert.equal(c.saveState(),false);assert.equal(db.has('archive'),false);assert.equal(alerts.length,1);
});
