'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const env={selfId:'self',now:'2026-09-26T20:00',settings:{}};
const meta=(familyId,systemId,editionId='')=>({familyId,systemId,editionId,confirmed:true,source:'user-selected'});
const data=()=>({
 profiles:[{id:'self',name:'我'}],pcs:[],
 modules:[{id:'mc',name:'现在 CoC7',ruleMeta:meta('brp','coc','7e')},{id:'mi',name:'现在 Insane',ruleMeta:meta('saikoro-fiction','insane')}],
 plans:[
  {id:'pc',moduleId:'mi',moduleName:'现在 Insane',ruleMeta:meta('brp','coc','7e'),kpProfileId:'self',timeSlots:[{date:'2026-09-26',daypart:'evening'}]},
  {id:'po',moduleId:'mc',moduleName:'现在 CoC7',ruleMeta:null,kpProfileId:'self',timeSlots:[]}
 ],
 records:[
  {id:'rc',moduleId:'mi',moduleName:'现在 Insane',ruleMeta:meta('brp','coc','7e'),kpProfileId:'self',startDate:'2026-09-20',sessionSlots:[]},
  {id:'ri',moduleId:'mc',moduleName:'现在 CoC7',ruleMeta:meta('saikoro-fiction','insane'),kpProfileId:'self',startDate:'2026-09-21',sessionSlots:[]},
  {id:'ro',moduleId:'mc',moduleName:'现在 CoC7',ruleMeta:null,kpProfileId:'self',startDate:'2026-09-22',sessionSlots:[]}
 ]
});
const sorted=r=>[...r.ids].sort();
test('plans and records select saved table snapshots, never the current linked module rule',()=>{
 const d=data(),plan=require('../../plan-query-bridge.js').create(),record=require('../../record-query-bridge.js').create();
 const p=legacy=>sorted(plan.query({...env,data:d,legacy})),r=legacy=>sorted(record.query({...env,data:d,legacy}));
 assert.deepEqual(p({ruleFamily:'brp'}),['pc']);
 assert.deepEqual(p({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'7e'}),['pc']);
 assert.deepEqual(p({ruleFamily:'unrecorded'}),['po']);
 assert.deepEqual(r({ruleFamily:'brp'}),['rc']);
 assert.deepEqual(r({ruleFamily:'saikoro-fiction',ruleSystem:'insane'}),['ri']);
 assert.deepEqual(r({ruleFamily:'unrecorded'}),['ro']);
 assert.deepEqual(r({}),['rc','ri','ro']);
 assert.deepEqual(p({}),['pc','po']);
});
test('statistical query uses the same rule snapshot and invalidates cache when only rule changes',()=>{
 const d=data(),stats=require('../../stats-query-bridge.js').create();
 const q=(x)=>sorted(stats.query({...env,data:d,range:'all',role:'kp',...x}));
 assert.deepEqual(q({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'7e'}),['rc']);
 assert.deepEqual(q({ruleFamily:'saikoro-fiction',ruleSystem:'insane'}),['ri']);
 assert.deepEqual(q({ruleFamily:'unrecorded'}),['ro']);
 assert.deepEqual(q({}),['rc','ri','ro']);
 const before=stats.buildCount();d.records[0].ruleMeta=meta('saikoro-fiction','insane');
 assert.deepEqual(q({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'7e'}),[]);
 assert.deepEqual(q({ruleFamily:'saikoro-fiction'}),['rc','ri']);
 assert.ok(stats.buildCount()>before,'snapshot-only edit needs to invalidate cached statistical membership');
});
test('year-calendar event layer keeps the historical source rule, not current module metadata',()=>{
 const events=require('../../run-event.js').createEvents({plans:data().plans,records:data().records,selfId:'self',roleResolver:(run,id)=>({kp:run.kpProfileId===id,pl:false})});
 assert.equal(events.find(x=>x.runId==='rc').ruleMeta.systemId,'coc');
 assert.equal(events.find(x=>x.runId==='ri').ruleMeta.systemId,'insane');
 assert.equal(events.find(x=>x.runId==='ro').ruleMeta,null);
 assert.equal(events.find(x=>x.runId==='pc').ruleMeta.systemId,'coc');
});
test('all three pages use shared taxonomy; user preference UI is unchanged',()=>{
 for(const prefix of ['plan','records','stats'])for(const kind of ['Family','System','Edition'])assert.match(html,new RegExp('id="'+prefix+'Rule'+kind+'Filter"'));
 assert.match(html,/function statsRuleMatches\(meta\)/);
 assert.match(html,/\.filter\(event=>statsRuleMatches\(event\.ruleMeta\)\)/);
 assert.match(html,/ruleFamily:statsUiState\.ruleFamily/);
 assert.match(html,/function populateRuleFilterGroup\(prefix/);
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
 assert.doesNotMatch(html,/id:'(?:wuxia|gufeng)'|label:'(?:古风武侠|古風武俠)'/);
});
test('global search uses saved rule aliases, and does not infer the rule of an old table from its linked module',()=>{
 const start=html.indexOf('const TRPG_RULE_FAMILIES=Object.freeze('),end=html.indexOf('let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();',start);
 assert.ok(start>0&&end>start,'taxonomy source must be available');
 const terms=new Function(html.slice(start,end)+'return ruleSearchTerms;')();
 assert.deepEqual(terms(null),[]);
 assert.ok(terms(meta('brp','coc','7e')).includes('CoC7'));
 assert.ok(terms(meta('saikoro-fiction','insane')).includes('インセイン'));
 assert.ok(terms(meta('saikoro-fiction','shinobigami')).includes('忍神'));
 for(const expr of ['...ruleSearchTerms(pc.ruleMeta)','...ruleSearchTerms(plan.ruleMeta)','...ruleSearchTerms(r.ruleMeta)','...ruleSearchTerms(m?.ruleMeta)'])assert.ok(html.includes(expr),'all cross-site search paths must index only saved rule identity: '+expr);
 assert.match(html,/if\(!meta\|\|typeof meta!==['"]object['"]\)return \[\];/);
});
