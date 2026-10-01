'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(process.env.PL_RULE_SOURCE||path.join(root,'index.html'),'utf8');
const part=(begin,end)=>{const i=html.indexOf(begin),j=html.indexOf(end,i);assert.ok(i>=0&&j>i,begin);return html.slice(i,j)};
const api=new Function('clone','normalizedEntityNameKey','PC_CARD_TIME_REFS','PC_COC_KEYS',`${part('function normalizePcRuleData(', 'function normalizePcArchive(')}\n${part('function pcValidateArchiveInput(', 'function assertRunLogInputPreserved(')}\nreturn {pcValidateArchiveInput,normalizePcRuleSheets,normalizePcRuleData,pcRuleCurrentData,pcRuleFilledCount,pcRuleDisplayLabel}`)(structuredClone,s=>String(s||'').trim().toLowerCase(),{},[]);
function synthetic(){return {id:'PC-R176-SYNTH',name:'虚构人物',notes:'原始备注',ruleMeta:{systemId:'insane'},ruleData:{traits:[{label:'',value:'旧数值',detail:'旧说明',extension:{kind:'legacy'}}],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'',value:'6',detail:'',extension:{keep:1}},{label:'',value:'',detail:'仅公开说明\n尾部'},{label:'生命力',value:'5',detail:''}],skills:[],resources:[],future:{keep:'new-version-value'}},shinobigami:{traits:[{label:'流派',value:'甲'}],skills:[],resources:[]},'future-system':{extension:{untouched:77}}},skills:[],weapons:[],snapshots:[],excelEdits:[{sheet:'旧卡',ref:'B2',value:'原件保留'}],coc:{san:40}};}
test('legacy unnamed and template unnamed data do not block otherwise valid PC save',()=>{
 const pc=synthetic(); assert.equal(api.pcValidateArchiveInput(pc),''); pc.notes='只改了 PC 备注';
 assert.equal(api.pcValidateArchiveInput(pc),''); const raw=JSON.stringify(pc),reloaded=JSON.parse(raw);
 reloaded.ruleData=api.normalizePcRuleData(reloaded.ruleData);reloaded.ruleSheets=api.normalizePcRuleSheets(reloaded.ruleSheets);
 assert.deepEqual(reloaded.ruleSheets,pc.ruleSheets);assert.deepEqual(reloaded.ruleData,pc.ruleData);
 assert.equal(reloaded.ruleSheets.insane.traits[1].detail,'仅公开说明\n尾部');assert.equal(reloaded.ruleData.traits[0].label,'');
 assert.equal(reloaded.ruleSheets['future-system'].extension.untouched,77);assert.equal(reloaded.excelEdits[0].value,'原件保留');
 assert.equal(api.pcRuleFilledCount(reloaded,'traits'),3);assert.equal(api.pcRuleDisplayLabel(reloaded.ruleSheets.insane.traits[0],0),'未命名字段 1');
 reloaded.ruleMeta.systemId='shinobigami';assert.equal(api.pcRuleCurrentData(reloaded).traits[0].value,'甲');
 reloaded.ruleMeta.systemId='insane';assert.equal(api.pcRuleCurrentData(reloaded).traits[1].detail,'仅公开说明\n尾部');
});
test('field length, count and malformed sheets still fail closed',()=>{
 let pc=synthetic();pc.ruleSheets.insane.traits[1].detail='x'.repeat(3001);assert.match(api.pcValidateArchiveInput(pc),/过长/);
 pc=synthetic();pc.ruleSheets.insane.skills=Array.from({length:101},(_,i)=>({label:`技能${i}`,value:''}));assert.match(api.pcValidateArchiveInput(pc),/超过 100 项/);
 pc=synthetic();pc.ruleSheets.insane.skills={not:'array'};assert.match(api.pcValidateArchiveInput(pc),/字段无效/);
 pc=synthetic();pc.ruleData.traits[0].value='x'.repeat(301);assert.match(api.pcValidateArchiveInput(pc),/过长/);
 pc=synthetic();pc.skills=[{name:'',value:60}];assert.match(api.pcValidateArchiveInput(pc),/请先补充技能名称/);
});
test('actual save/import/export guards use same validation and never persist display-only label',()=>{
 assert.match(html,/async function savePcEditor\([\s\S]*?pcValidateArchiveInput\(pcDraft\)/);
 assert.match(html,/const issue=pcValidateArchiveInput\(pc\);if\(issue\)throw new Error\(`PC/);
 assert.match(html,/const issue=pcValidateArchiveInput\(complete\)/);
 assert.match(html,/function pcRuleDisplayLabel\(row,index\)/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=/);
});
