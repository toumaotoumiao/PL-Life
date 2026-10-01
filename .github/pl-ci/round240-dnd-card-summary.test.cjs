'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const first=source.indexOf('function pcDndCardStats(pc){'),end=source.indexOf('function pcCardHTML(pc)',first);
assert.ok(first>0&&end>first,'D&D quick facts must be shared by both card layouts');
const {facts,stats}=new Function('pcRuleTemplateKey','pcRuleCurrentData','pcRuleIsCoc','pcCoreStats','pcStatProvided','pcRuleDisplayLabel',source.slice(first,end)+'\nreturn {facts:pcDndCardStats,stats:pcCardStats}')(pc=>pc?.ruleMeta?.systemId==='dnd'&&['5e-2014','5e-2024'].includes(pc.ruleMeta.editionId)?'dnd:'+pc.ruleMeta.editionId:'',pc=>pc.sheet,pc=>pc?.ruleMeta?.systemId==='coc',()=>[['STR',60]],()=>true,r=>r.label);
const build=(edition,resources,traits=[])=>({ruleMeta:{systemId:'dnd',editionId:edition},sheet:{resources,traits}});
test('Round240 only filled D&D public manual identity/combat rows enter core card facts',()=>{
 const p=build('5e-2024',[{label:'等级',value:'4'},{label:'生命值',value:''},{label:'种族／物种',value:'虚构物种'},{label:'私密备注',value:'不要展示'}],[{label:'力量',value:'15'}]);
 assert.deepEqual(facts(p),[['等级','4'],['种族／物种','虚构物种']]);
 assert.deepEqual(stats(p,3),[['等级','4'],['种族／物种','虚构物种'],['力量','15']]);
});
test('Round240 card facts stay edition-scoped, never infer blank or unconfirmed edition',()=>{
 assert.deepEqual(facts(build('5e-2014',[{label:'生命值',value:0}])),[['生命值','0']]);
 assert.deepEqual(facts({ruleMeta:{systemId:'dnd',editionId:''},sheet:{resources:[{label:'等级',value:'4'}],traits:[]}}),[]);
 assert.deepEqual(facts({ruleMeta:{systemId:'insane'},sheet:{resources:[{label:'等级',value:'4'}],traits:[]}}),[]);
});
test('Round240 both PC layouts use one source of facts without cloning data into archives',()=>{
 assert.match(source,/function pcCardHTML\(pc\)[\s\S]*?const stats=pcCardStats\(pc,5\)/);
 assert.match(source,/pc-dnd-card-stats/);assert.match(source,/pc-dnd-species-stat/);
 assert.match(source,/function pcCompactRowHTML\(pc\)[\s\S]*?const stats=pcCardStats\(pc,3\)/);
 assert.doesNotMatch(source.slice(first,end),/ruleSheets\s*\[|ruleData\s*=/);
});
