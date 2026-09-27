'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=s=>{const pos=html.indexOf(s);assert(pos>=0,'missing '+s);return pos;};
const clone=x=>structuredClone(x),plain=x=>JSON.parse(JSON.stringify(x));
function pcApi(){
 const a=start('function normalizePcRuleData('),b=start('function pcValidateArchiveInput(',a);
 const snippet=html.slice(a,b);
 const defs=`const PC_STATUS_VALUES=['active','dead','archived'];const PC_BACKGROUND_KEYS=[];
 function uid(){return 'generated-id';}function normalizeModuleRuleMeta(x){return {...x};}
 function defaultModuleRuleMeta(){return {familyId:'brp',systemId:'coc',editionId:'7e',confirmed:false,source:'legacy-pc-default'};}
 function pcPromoteLegacyCardTime(raw){return {cardTime:raw.cardTime||{},excelEdits:raw.excelEdits||[]};}
 function normalizePcCoc(x){return x||{};}function normalizePcSkills(x){return x||[];}function normalizePcWeapons(x){return x||[];}
 function normalizePcBackground(x){return x||{};}function normalizePcStoredSnapshots(x){return x||[];}`;
 return new Function('clone',defs+'\n'+snippet+'\nreturn {normalizePcRuleData,normalizePcRuleSheets,normalizePcArchive,pcRuleEditableData,pcRuleCurrentData};')(clone);
}
function duplicateApi(){
 const a=start('function pcDuplicateSubstantivePayload('),b=start('let pcAutoDuplicateRepairRunning=',a);
 const context={clone,PC_COC_KEYS:['str','hp','san'],PC_BACKGROUND_KEYS:['description'],pcRunLinks:()=>[],preferredPcCandidate:rows=>rows[0],profilePickerNameCollator:{compare:(a,b)=>String(a).localeCompare(String(b))},pcOwnerName:pc=>pc.ownerPlId||'',normalizedEntityNameKey:x=>String(x||'').toLowerCase(),pcDuplicateGroups:()=>[]};
 vm.createContext(context);vm.runInContext(html.slice(a,b),context);return context;
}
function legacyPc(){return {id:'legacy-pc',ownerPlId:'self',name:'旧调查员',ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e',confirmed:false,source:'legacy-pc-default'},ruleData:{traits:[],skills:[],resources:[]},coc:{str:60,hp:11,san:56},skills:[{name:'侦查',value:65}],weapons:[],excelEdits:[{sheet:'角色卡',ref:'B6',value:'旧卡备注'}],excelSource:{kind:'fixed',fileName:'old.xlsx',templateId:'coc7',storedAt:1710000000000},avatarMediaId:'cover-1',galleryMediaIds:['img-2'],background:{description:'历史角色'},snapshots:[{id:'growth-1',runRecordId:'r1',san:55}],createdAt:1710000000000,updatedAt:1710000000000};}
test('v213 legacy PC imports as inferred CoC7, leaves all Excel and image references intact',()=>{
 const api=pcApi(),old=legacyPc();delete old.ruleMeta;delete old.ruleData;delete old.ruleSheets;
 const restored=api.normalizePcArchive(plain(old),new Set(['self']));
 assert.equal(restored.ruleMeta.systemId,'coc');assert.equal(restored.ruleMeta.confirmed,false);
 assert.equal(restored.coc.san,56);assert.deepEqual(restored.excelEdits,old.excelEdits);
 assert.equal(restored.excelSource.fileName,'old.xlsx');assert.equal(restored.avatarMediaId,'cover-1');assert.deepEqual(restored.galleryMediaIds,['img-2']);
 assert.equal(restored.snapshots[0].runRecordId,'r1');assert.deepEqual(restored.ruleSheets,{});
});
test('v214 template → normalized canonical → JSON → normalized runtime retains every sheet and untouched CoC workbook',()=>{
 const api=pcApi(),pc=legacyPc();pc.ruleMeta={familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true,source:'user-selected'};
 pc.ruleSheets={insane:{traits:[{label:'生命力',value:'6',futureRow:'retained'}],skills:[],resources:[],extra:{secretMetadata:'must not vanish'}},'future-ruleset':{items:[{key:'new',value:12}],future:1}};
 pc.ruleData={traits:[{label:'旧通用字段',value:'保留',legacyMeta:'yes'}],skills:[],resources:[],futureData:{newVersion:true}};
 const round1=api.normalizePcArchive(plain(pc),new Set(['self'])),serialized=JSON.stringify(round1),round2=api.normalizePcArchive(JSON.parse(serialized),new Set(['self']));
 assert.deepEqual(round2.ruleSheets,pc.ruleSheets);assert.deepEqual(round2.ruleData,pc.ruleData);
 assert.deepEqual(round2.coc,pc.coc);assert.deepEqual(round2.excelEdits,pc.excelEdits);
 assert.deepEqual(round2.excelSource,pc.excelSource);assert.deepEqual(round2.galleryMediaIds,pc.galleryMediaIds);
 assert.equal(round2.ruleMeta.systemId,'insane');assert.equal(api.pcRuleCurrentData(round2).traits[0].value,'6');
 round2.ruleMeta.systemId='coc';assert.equal(round2.coc.san,56);round2.ruleMeta.systemId='insane';assert.equal(api.pcRuleCurrentData(round2).traits[0].value,'6');
});
test('actual canonical hydration projects rule sheets without false loss after recovery normalization',()=>{
 const x={clone,PC_STATUS_VALUES:['active','dead','archived'],PC_BACKGROUND_KEYS:[],
  uid:()=> 'generated-id',normalizeModuleRuleMeta:r=>({...r}),defaultModuleRuleMeta:()=>({familyId:'brp',systemId:'coc',editionId:'7e',confirmed:false}),
  pcPromoteLegacyCardTime:r=>({cardTime:r?.cardTime||{},excelEdits:r?.excelEdits||[]}),normalizePcCoc:r=>r||{},normalizePcSkills:r=>r||[],normalizePcWeapons:r=>r||[],normalizePcBackground:r=>r||{},normalizePcStoredSnapshots:r=>r||[],
  PLDataMigrationGuard:{requireReadable:()=>{}},isCanonicalArchive:()=>true,assertCanonicalIntegrity:()=>{},normalizeSettings:r=>r,
  runtimeProfileFromCanonical:r=>r,canonicalProfileFromRuntime:r=>r,normalizeCanonicalModule:r=>r,normalizeRunPlan:r=>r,normalizeRunRecord:r=>r,
  BACKUP_FORMAT:'synthetic',PLDataHeritage:{capture:(raw,projection)=>{x.projection=projection;return {entries:[]};}}
 };vm.createContext(x);
 vm.runInContext(html.slice(start('function normalizePcRuleData('),start('function pcValidateArchiveInput(')),x);
 vm.runInContext(html.slice(start('function hydrateCanonicalArchive('),start('function isSelfProfile(')),x);
 const p=legacyPc();p.ruleMeta={familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'};
 p.ruleSheets={insane:{traits:[{label:'生命力',value:'6',future:'flag'}],skills:[],resources:[],future:{v:2}},'unrecognized-future':{store:{critical:1}}};
 const raw={format:'synthetic',schemaVersion:26,settings:{},app:{uiVersion:'8.1.12.214'},data:{profiles:[{id:'self'}],pcs:[p],modules:[],runs:[]}};
 const incoming=x.hydrateCanonicalArchive(plain(raw));
 assert.equal(incoming.pcs.length,1);
 assert.deepEqual(plain(incoming.pcs[0].ruleSheets),p.ruleSheets);
 assert.deepEqual(plain(x.projection.data.pcs[0].ruleSheets),p.ruleSheets);
 assert.deepEqual(plain(x.projection.data.pcs[0].excelEdits),p.excelEdits);
 assert.deepEqual(plain(x.projection.data.pcs[0].excelSource),p.excelSource);
 assert.deepEqual(plain(x.projection.data.pcs[0].galleryMediaIds),p.galleryMediaIds);
 assert.equal(x.projection.schemaVersion,26);
});
test('auto duplicate repair never discards PC carrying only an Insane sheet',()=>{
 const x=duplicateApi();const kept={id:'one',name:'同名',ownerPlId:'self',status:'active',ruleMeta:{systemId:'insane',source:'user-selected'},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[]}}};
 const empty={id:'two',name:'同名',ownerPlId:'self',status:'active'};
 assert.equal(x.pcDuplicatePayloadIsEmpty(x.pcDuplicateSubstantivePayload(kept)),false);
 assert.equal(x.pcDuplicatePayloadIsEmpty(x.pcDuplicateSubstantivePayload(empty)),true);
 const group=x.pcDuplicateGroupAutoMergePlan([kept,empty]);assert.deepEqual(plain(group.sources.map(p=>p.id)),['two']);assert.equal(group.target.id,'one');
});
test('Excel edits without excelSource, unknown future rule sheet and user-chosen rules remain substantive',()=>{
 const x=duplicateApi();
 for(const patch of [{excelEdits:[{sheet:'角色卡',ref:'A1',value:'旧值'}]},{ruleSheets:{'future-system':{rows:[{label:'new',value:1}]}}},{ruleData:{traits:[{label:'保留',value:''}],skills:[],resources:[]}},{ruleMeta:{systemId:'coc',confirmed:true,source:'user-selected'}},{importReports:[{fileName:'source.xlsx'}]},{cardTime:{year:'1920'}}]){
  assert.equal(x.pcDuplicatePayloadIsEmpty(x.pcDuplicateSubstantivePayload({id:'candidate',status:'active',...patch})),false,JSON.stringify(patch));
 }
});
test('only actual unlinked empty stubs can be merged; linked empty PC cannot be deleted',()=>{
 const x=duplicateApi();x.pcRunLinks=id=>id==='used'?[{runId:'r1'}]:[];
 const group=x.pcDuplicateGroupAutoMergePlan([{id:'used',name:'same',status:'active'},{id:'empty',name:'same',status:'active'}]);
 assert.deepEqual(plain(group.sources.map(p=>p.id)),['empty']);assert.equal(group.target.id,'used');
});
function backupPreflight(){
 const source=fs.readFileSync(path.join(root,'backup-restore-preflight.js'),'utf8'),x={};vm.createContext(x);vm.runInContext(source,x);return x.PLBackupRestorePreflight.audit;
}
function mockComplete(legacy=false){
 const pc={id:'old-pc',name:'旧 PC',ownerPlId:'self',avatarMediaId:'pic',galleryMediaIds:[],excelSource:{kind:'fixed',fileName:'old.xlsx'},...(legacy?{}:{ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:''},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[]}}})};
 const files={'archive.json':Buffer.from(JSON.stringify({data:{pcs:[pc]}})),'manifest.json':Buffer.from('fixture'),'media/pic.png':Buffer.from([137,80,78,71]),'workbooks/old-pc.xlsx':Buffer.from([80,75,3,4,1])};
 const manifest={archivePath:'archive.json',backupMode:'complete',mediaCount:1,media:[{id:'pic',pcId:'old-pc',path:'media/pic.png',name:'cover',type:'image/png',size:4}],workbooks:[{pcId:'old-pc',path:'workbooks/old-pc.xlsx',kind:'fixed',size:5}]};
 return {pc,files,manifest,archive:{data:{pcs:[pc]}}};
}
test('real preflight accepts old complete ZIP shape and new PC sheet in the same manifest contract',()=>{
 const audit=backupPreflight();for(const legacy of [true,false]){
  const f=mockComplete(legacy),got=audit(f.manifest,f.archive,f.files);
  assert.equal(got.pcCount,1);assert.equal(got.workbookCount,1);assert.equal(got.mediaCount,1);
  assert.ok(f.files['workbooks/old-pc.xlsx'].equals(Buffer.from([80,75,3,4,1])));
 }
});
test('real preflight refuses missing or misowned Excel, missing media, and unlisted attachment BEFORE a write',()=>{
 const audit=backupPreflight();
 for(const mutate of [f=>{delete f.files['workbooks/old-pc.xlsx'];},f=>{f.manifest.workbooks[0].pcId='wrong';},f=>{delete f.files['media/pic.png'];},f=>{f.files['workbooks/unlisted.xlsx']=Buffer.from([80,75]);},f=>{f.manifest.workbooks=[];}]){
  const f=mockComplete();mutate(f);assert.throws(()=>audit(f.manifest,f.archive,f.files),/未通过|缺少|不一致|异常/);
 }
});
test('no preference-maintenance fields, schema unchanged, updated SW and previous export regression preserved',()=>{
 const version=html.match(/const APP_UI_VERSION = "([^"]+)";/)?.[1],sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(version,/^8\.1\.12\.\d+$/);assert.ok(sw.includes('v'+version));assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.ok(html.includes('function moduleRecruitBlocks('));assert.ok(html.includes("if(kind==='module'&&id==='recruit')"));
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
});
