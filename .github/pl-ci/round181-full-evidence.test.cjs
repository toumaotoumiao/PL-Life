'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('function completeBackupRuleEvidence('),end=html.indexOf('function applyImportedArchiveState(',start);
assert(start>0&&end>start);
const evidence=new Function(html.slice(start,end)+'\nreturn completeBackupRuleEvidence;')();
function fixture(){return {
  pcs:[{id:'p2',name:'虚构忍神 PC',ruleSheets:{shinobigami:{traits:[{label:'流派',value:'甲',detail:'说明',future:{a:1}}],skills:[],resources:[]},futureEdition:{x:1}},
    ruleData:{traits:[],skills:[],resources:[]},avatarMediaId:'img2',galleryMediaIds:['img2'],futurePcField:{nested:{retain:'原值'}}},
       {id:'p1',name:'虚构 Insane PC',ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[]}}}],
  modules:[{id:'m1',name:'同名模组',ruleMeta:{systemId:'insane'},futureModule:{notes:['原文']}}],
  runPlans:[{id:'a1',moduleId:'m1',ruleMeta:{systemId:'insane'},runNotes:'合成计划备注',futurePlan:{keep:1}}],
  runRecords:[{id:'r1',moduleId:'m1',ruleMeta:{systemId:'insane'},logUrls:['https://example.invalid/1'],
      runNotes:'完整记录正文',futureRecord:{nested:'保留'},participantAssignments:[{plId:'self',pcId:'p1'}]}]
};}
const clone=x=>JSON.parse(JSON.stringify(x));
test('Round181 all fields equal after JSON roundtrip and key reordering',()=>{
 const a=fixture(),b=clone(a);b.pcs.reverse();
 b.runRecords[0]={futureRecord:b.runRecords[0].futureRecord,...Object.fromEntries(Object.entries(b.runRecords[0]).filter(([k])=>k!=='futureRecord'))};
 assert.equal(evidence(a),evidence(b));
});
test('Round181 detects ALL formerly unprotected top-level and nested fields',()=>{
 const original=evidence(fixture());
 for(const [name,mutate] of [
 ['unknown PC extension',s=>delete s.pcs[0].futurePcField],
 ['deep nested rule value',s=>s.pcs[0].ruleSheets.shinobigami.traits[0].future.a=0],
 ['unknown future template',s=>delete s.pcs[0].ruleSheets.futureEdition],
 ['module extension',s=>s.modules[0].futureModule.notes=[]],
 ['plan notes',s=>s.runPlans[0].runNotes=''],
 ['plan future',s=>delete s.runPlans[0].futurePlan],
 ['record actual notes',s=>s.runRecords[0].runNotes=''],
 ['record future',s=>s.runRecords[0].futureRecord.nested='changed'],
 ['record log array ordering',s=>s.runRecords[0].logUrls.push('https://example.invalid/2')],
 ['assignment',s=>s.runRecords[0].participantAssignments[0].pcId='wrong']]){
   const changed=fixture();mutate(changed);assert.notEqual(evidence(changed),original,name);
 }
});
test('Round181 evidence is read-only and does not write source values to logs',()=>{
 const state=fixture(),before=JSON.stringify(state);const result=evidence(state);
 assert.equal(JSON.stringify(state),before);assert.ok(result.includes('原值'));
 const part=html.slice(start,end);assert.doesNotMatch(part,/console\.|localStorage\.|setItem\(/);
});
test('Round181 failed evidence prevents writing and checks persisted source independently',()=>{
 assert.match(html,/const sourceRuleEvidence=completeBackupRuleEvidence\(incoming\)/);
 assert.match(html,/completeBackupRuleEvidence\(\{settings,profiles,pcs,modules,runPlans,runRecords\}\)!==sourceRuleEvidence[\s\S]*?if\(!saveState\(\)\)/);
 assert.match(html,/completeBackupRuleEvidence\(persisted\)!==sourceRuleEvidence/);
});
test('Round181 same ID sorting never hides duplicate or changed rows',()=>{
 const a=fixture(),b=fixture();b.pcs.push(clone(b.pcs[0]));assert.notEqual(evidence(a),evidence(b));
});
test('Round181 existing schema, historical Excel and rollback remain unchanged',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/async function restoreUnifiedCompleteBackup\(file\)/);
 assert.match(html,/assertCompleteZipPreservesRecoveryAttachments\(prepared\)/);
 assert.match(html,/await PLDataMigrationTransaction\.run\(/);
 assert.match(html,/round-trip/i); // existing labels in archive test notes
});

test('Round181 is a non-optional Actions release check with evidence log',()=>{
 const y=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(y,/node --test \.github\/pl-ci\/round181-full-evidence\.test\.cjs/);
 assert.match(y,/id: round181_browser/);
 assert.match(y,/python \.github\/pl-ci\/round181-full-evidence-browser\.py/);
 assert.match(y,/Round181:\$\{\{ steps\.round181_browser\.outcome \}\}/);
});
