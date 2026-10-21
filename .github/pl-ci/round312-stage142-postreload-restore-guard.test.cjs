 'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('/* Stage144: compare the actual Excel');
const end=html.indexOf('\n/* Read media and Excel from ONE',start);
assert.ok(start>0&&end>start,'Stage142 restore receipt available');
const helper=html.slice(start,end);
function setup({counts={profiles:74,pcs:20,modules:62,plans:16,records:65},attachments={media:0,workbooks:19},
       actualCounts=null,actualAttachments=null,fp='fingerprint',nonce='save1'}={}){
 const expected={...counts},actual={...(actualCounts||counts)};
 const data={
  profiles:Array.from({length:counts.profiles},(_,i)=>({id:`pl${i}`})),
  pcs:Array.from({length:counts.pcs},(_,i)=>({id:`pc${i}`})),
  modules:Array.from({length:counts.modules},(_,i)=>({id:`mod${i}`})),
  runs:[...Array.from({length:counts.plans},()=>({status:'planned'})),
        ...Array.from({length:counts.records},()=>({status:'completed'}))]
 };
 const actualData={
  profiles:Array.from({length:actual.profiles},()=>({})),
  pcs:Array.from({length:actual.pcs},()=>({})),
  modules:Array.from({length:actual.modules},()=>({})),
  runs:[...Array.from({length:actual.plans},()=>({status:'planned'})),
        ...Array.from({length:actual.records},()=>({status:'completed'}))]
 };
 let saved={data,_localSave:{saveNonce:nonce}};
 const makeRows=(kind,count)=>Array.from({length:count},(_,i)=>({
  [kind==='media'?'id':'pcId']:`${kind}-${i}`,
  blob:new Blob([`original-${kind}-${i}`],{type:kind==='media'?'image/png':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
 }));
 const expectedMedia=makeRows('media',attachments.media),expectedBooks=makeRows('workbook',attachments.workbooks);
 const actualMedia=makeRows('media',(actualAttachments||attachments).media),actualBooks=makeRows('workbook',(actualAttachments||attachments).workbooks);
 const backing=new Map(),sent=[],notices=[];
 const selects={};
 for(const id of ['pcSearch','pcOwnerFilter','pcStatusFilter','pcRelationFilter','pcRuleFamilyFilter','pcRuleSystemFilter','pcRuleEditionFilter','pcModuleFilter','pcTagFilter'])selects[id]={value:'stale'};
 const sandbox={
  window:{addEventListener:()=>{}},
  document:{getElementById:id=>selects[id]||null},
  els:{pcSearch:selects.pcSearch,pcOwnerFilter:selects.pcOwnerFilter,pcStatusFilter:selects.pcStatusFilter,pcRelationFilter:selects.pcRelationFilter},
  sessionStorage:{getItem:k=>backing.get(k)||null,setItem:(k,v)=>backing.set(k,v),removeItem:k=>backing.delete(k)},
  localStorage:{getItem:()=>JSON.stringify(saved)},
  safeParseStoredJson:text=>JSON.parse(text),
  isCanonicalArchive:item=>Boolean(item?.data?.pcs&&item?.data?.runs),
  archiveDataFingerprint:()=>fp,
  pcReadAttachmentSourceSnapshot:async()=>({media:actualMedia,workbooks:actualBooks}),
  backupSha256Bytes:async bytes=>Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join(''),
  profiles:actualData.profiles,pcs:actualData.pcs,modules:actualData.modules,
  runPlans:actualData.runs.filter(x=>x.status==='planned'),runRecords:actualData.runs.filter(x=>x.status==='completed'),
  migrationReadOnly:null,showMigrationProtectionOverlay:()=>notices.push('blocked'),
  plBuildDiagnosticIncident:payload=>({classification:'BACKUP_POSTRELOAD_INTEGRITY_MISMATCH',...payload}),
  showContextIssue:e=>notices.push(e),
  pcQueryArchive:()=>({total:actual.pcs,rawRows:Array.from({length:actual.pcs},()=>({}))}),
  renderPcArchive:()=>sent.push('pc-refresh'),showToast:t=>sent.push(t),
  console:{warn:()=>{},error:()=>{}},APP_UI_VERSION:'8.1.12.322',
  STORAGE_KEY:'main',pcQueryRuntime:{},setTimeout:()=>{}
 };
 vm.createContext(sandbox);
 new vm.Script(helper).runInContext(sandbox);
 const input={profiles:data.profiles,pcs:data.pcs,modules:data.modules,runPlans:data.runs.filter(x=>x.status==='planned'),runRecords:data.runs.filter(x=>x.status==='completed')};
 const prepared={rows:expectedMedia,workbookRows:expectedBooks};
 return {sandbox,saved,input,prepared,backing,sent,notices,selects,expected};
}
test('recovery receipt verifies 20 PCs and 19 Excel files across page load, clears stale PC filters',async()=>{
 const a=setup();await a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared);
 assert.ok(a.backing.size);
 await a.sandbox.verifyCompleteRestoreAfterReload();
 assert.equal(a.backing.size,0);
 assert.equal(a.sandbox.migrationReadOnly,null);
 assert.equal(a.selects.pcOwnerFilter.value,'');
 assert.equal(a.selects.pcSearch.value,'');
 assert.ok(a.sent.some(x=>String(x).includes('PC 20')));
});
test('missing PCs after reload must not be reported as a successful restore',async()=>{
 const a=setup({actualCounts:{profiles:74,pcs:0,modules:62,plans:16,records:65}});
 await a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared);
 await a.sandbox.verifyCompleteRestoreAfterReload();
 assert.equal(a.sandbox.migrationReadOnly?.kind,'complete-restore-reload-mismatch');
 assert.ok(a.backing.size,'failure evidence retained');
 assert.ok(a.notices.length);
 const report=a.notices.find(x=>x&&typeof x==='object'&&x.diagnostics);
 assert.ok(report,'structured failure report emitted');
 assert.match(report.diagnostics,/inMemoryCounts/);
 assert.equal(report.incident.module,'BACKUP_POSTRELOAD');
});
test('missing Excel rows after reload blocks further saves',async()=>{
 const a=setup({actualAttachments:{media:0,workbooks:0}});
 await a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared);
 await a.sandbox.verifyCompleteRestoreAfterReload();
 assert.equal(a.sandbox.migrationReadOnly?.kind,'complete-restore-reload-mismatch');
});
test('immediate post-commit count mismatch cannot create a success receipt',async()=>{
 const a=setup();a.saved.data.pcs=a.saved.data.pcs.slice(1);
 await assert.rejects(a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared),/数量.*不一致/);
 assert.equal(a.backing.size,0);
});

test('same attachment count but different Excel bytes must fail after reload',async()=>{
 const a=setup();
 await a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared);
 a.sandbox.pcReadAttachmentSourceSnapshot=async()=>({media:[],workbooks:Array.from({length:19},(_,i)=>({pcId:`workbook-${i}`,blob:new Blob([i===0?'CORRUPTED':`original-workbook-${i}`],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}))});
 await a.sandbox.verifyCompleteRestoreAfterReload();
 assert.equal(a.sandbox.migrationReadOnly?.kind,'complete-restore-reload-mismatch');
 assert.ok(a.backing.size,'receipt kept for diagnosing mismatched Excel');
});
test('same attachment count but different IDs must fail after reload',async()=>{
 const a=setup();
 await a.sandbox.writeCompleteRestoreReadbackReceipt(a.input,a.prepared);
 a.sandbox.pcReadAttachmentSourceSnapshot=async()=>({media:[],workbooks:Array.from({length:19},(_,i)=>({pcId:`shifted-${i}`,blob:new Blob([`original-workbook-${i}`],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}))});
 await a.sandbox.verifyCompleteRestoreAfterReload();
 assert.equal(a.sandbox.migrationReadOnly?.kind,'complete-restore-reload-mismatch');
});
