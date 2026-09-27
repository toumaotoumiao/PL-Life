'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const begin=html.indexOf('function completeBackupRuleEvidence('),end=html.indexOf('function applyImportedArchiveState(',begin);
assert(begin>=0&&end>begin,'source-evidence function must exist');
const evidence=new Function(html.slice(begin,end)+'\nreturn completeBackupRuleEvidence;')();
const json=v=>JSON.parse(JSON.stringify(v));
const fixture=()=>({
 pcs:[{id:'p1',name:'合成角色',ownerPlId:'self',ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',source:'user-selected'},
  ruleSheets:{insane:{traits:[{label:'生命力',value:'6',future:'stay'}],skills:[],resources:[]},'future-sheet':{nested:{important:true}}},
  ruleData:{traits:[{label:'旧规则能力',value:'42'}],skills:[],resources:[],future:'kept'},
  coc:{str:60,san:40,hp:10},skills:[{name:'侦查',value:65}],weapons:[],background:{description:'旧背景'},inventory:'原装备',assets:'原资产',notes:'旧备注',tags:['历史'],
  avatarMediaId:'m1',galleryMediaIds:['m1','m2'],excelSource:{kind:'fixed',fileName:'source.xlsx',templateId:'coc7'},excelEdits:[{sheet:'角色卡',ref:'B6',value:'不应丢失'}],importReports:[{id:'report'}],cardTime:{year:'1920'},snapshots:[{id:'grow-1',san:36}]}],
 modules:[{id:'mod1',name:'规则样本',ruleMeta:{familyId:'brp',systemId:'brp-generic',editionId:''},rules:'自定义 BRP 武侠补充规则原文',recommendedSkills:'追踪',recommendedOccupations:'',cardRequirements:'人物设定',lostRate:'',background:'原模组简介',recruitmentNotes:'原招募内容',hoSystem:'none'}],
 runPlans:[{id:'plan1',moduleId:'mod1',ruleMeta:{familyId:'brp',systemId:'brp-generic',source:'user-selected'},participantAssignments:[{plId:'self',pcId:'p1'}],kpc:{enabled:false},plIds:['self'],logUrl:'',logUrls:[],logLabels:[]}],
 runRecords:[{id:'record1',moduleId:'mod1',ruleMeta:null,participantAssignments:[],kpc:{enabled:false},plIds:['self'],logUrl:'https://example.invalid/log',logUrls:['https://example.invalid/log'],logLabels:['Log']}]
});
test('Round150 source evidence survives independent JSON save / reload and row sorting',()=>{
 const input=fixture();assert.equal(evidence(input),evidence(json(input)));
 const reordered=json(input);reordered.runPlans.reverse();reordered.pcs.reverse();assert.equal(evidence(input),evidence(reordered));
});
test('Round150 source evidence detects loss of every protected PC field',()=>{
 for(const [field,change] of [
  ['ruleSheets',p=>delete p.ruleSheets.insane],['unknown sheet',p=>delete p.ruleSheets['future-sheet']],
  ['ruleData',p=>delete p.ruleData.future],['ruleMeta',p=>p.ruleMeta.systemId='coc'],
  ['CoC values',p=>p.coc.san=0],['Excel marker',p=>p.excelSource=null],['Excel diff',p=>p.excelEdits=[]],
  ['image reference',p=>p.galleryMediaIds=[]],['snapshot',p=>p.snapshots=[]],['import report',p=>p.importReports=[]]]){
  const changed=fixture();change(changed.pcs[0]);assert.notEqual(evidence(changed),evidence(fixture()),field);
 }
});
test('Round150 source evidence detects original module rules and independent historic table snapshots',()=>{
 const original=evidence(fixture());
 for(const mutate of [s=>s.modules[0].ruleMeta.systemId='coc',s=>s.modules[0].rules='CoC7',
  s=>s.runPlans[0].ruleMeta.systemId='coc',s=>s.runRecords[0].ruleMeta={familyId:'brp',systemId:'coc',editionId:'7e'},
  s=>s.runPlans[0].participantAssignments[0].pcId='missing']){
  const f=fixture();mutate(f);assert.notEqual(evidence(f),original);
 }
});
test('Round150 restore validates frozen source BEFORE write and against persisted re-hydration AFTER save',()=>{
 assert.match(html,/const sourceRuleEvidence=completeBackupRuleEvidence\(incoming\)/);
 assert.match(html,/commitArchive:\s*async\(\)=>\{[\s\S]*?completeBackupRuleEvidence\(\{pcs,modules,runPlans,runRecords\}\)!==sourceRuleEvidence[\s\S]*?if\(!saveState\(\)\)/);
 assert.match(html,/verifyArchive:\s*async text=>\{[\s\S]*?const persisted=ensureSelfProfileAndLinks\(hydrateCanonicalArchive\(rawSaved\)\);[\s\S]*?completeBackupRuleEvidence\(persisted\)!==sourceRuleEvidence/);
 assert.match(html,/await PLDataMigrationTransaction\.run\(/);
});
test('Round150 versions, previous export fix and no redundant personal preferences',()=>{
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.ok(version,'current version missing');assert.ok(sw.includes(`v${version}`),'Service Worker version differs from UI');
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/function moduleRecruitBlocks\(/);
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
});
