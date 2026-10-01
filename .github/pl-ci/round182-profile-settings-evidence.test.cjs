'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const begin=html.indexOf('function completeBackupRuleEvidence('),end=html.indexOf('function applyImportedArchiveState(',begin);
assert(begin>0&&end>begin,'full evidence boundary');
const evidence=new Function(html.slice(begin,end)+'\nreturn completeBackupRuleEvidence;')();
const fixture=()=>({settings:{theme:'night',fields:[{key:'play',weight:1}],futureSetting:{preserve:['private-preference']}},profiles:[
 {id:'self',name:'我',notes:{future:'preserve'},selfIntro:{future:'intro'}},
 {id:'pl2',name:'合成 PL',contact:'example.invalid',future:{nested:{a:1}}}
],pcs:[{id:'p',name:'虚构 PC',ruleSheets:{insane:{traits:[{label:'生命力',value:'6',future:'yes'}],skills:[],resources:[]}}}],modules:[],runPlans:[],runRecords:[]});
const clone=x=>JSON.parse(JSON.stringify(x));
test('Round182 profile, self intro and settings fields are part of frozen restore evidence',()=>{
 const a=fixture(),reference=evidence(a);
 for(const [name,change] of [
  ['theme',x=>x.settings.theme='plain'],['custom setting',x=>delete x.settings.futureSetting],
  ['rating weights',x=>x.settings.fields[0].weight=0],['PL note',x=>delete x.profiles[1].future],
  ['self introduction',x=>x.profiles[0].selfIntro.future=''],['PL contact',x=>x.profiles[1].contact='']]){
  const x=clone(a);change(x);assert.notEqual(evidence(x),reference,name);
 }
});
test('Round182 entity order and object-key order do not produce false corruption',()=>{
 const a=fixture(),b=clone(a);b.profiles.reverse();b.settings={futureSetting:b.settings.futureSetting,fields:b.settings.fields,theme:b.settings.theme};
 assert.equal(evidence(a),evidence(b));
 assert.equal(JSON.stringify(a),JSON.stringify(fixture()),'evidence must be read-only');
});
test('Round182 pre-write and persisted read-back check use same six-domain evidence',()=>{
 assert.match(html,/const sourceRuleEvidence=completeBackupRuleEvidence\(incoming\)/);
 assert.match(html,/commitArchive:\s*async\(\)=>\{[\s\S]*?completeBackupRuleEvidence\(\{settings,profiles,pcs,modules,runPlans,runRecords\}\)!==sourceRuleEvidence[\s\S]*?if\(!saveState\(\)\)/);
 assert.match(html,/verifyArchive:\s*async text=>\{[\s\S]*?completeBackupRuleEvidence\(persisted\)!==sourceRuleEvidence/);
 const bridge=fs.readFileSync(path.join(root,'.github/pl-ci/stage2-real-site-bridge.js'),'utf8');
 assert.equal((bridge.match(/completeBackupRuleEvidence\(\{settings,profiles,pcs,modules,runPlans,runRecords\}\)/g)||[]).length,2);
});
test('Round182 retains existing storage schema, ZIP, workbook and rollback boundaries',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/await PLDataMigrationTransaction\.run\(/);
 assert.match(html,/await pcVerifyStoredBlobRows\(await pcMediaAllRows\(\)/);
 assert.match(html,/await pcVerifyStoredBlobRows\(await pcWorkbookAllRows\(\)/);
});
test('Round182 browser evidence is mandatory in Actions and failure summary',()=>{
 const y=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(y,/node --test \.github\/pl-ci\/round182-profile-settings-evidence\.test\.cjs/);
 assert.match(y,/id: round182_browser/);
 assert.match(y,/Round182:\$\{\{ steps\.round182_browser\.outcome \}\}/);
});
