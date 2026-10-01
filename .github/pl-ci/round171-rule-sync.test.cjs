'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const part=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,`Missing code range: ${a}`);return html.slice(i,j)};
const api=new Function('clone',part('function normalizePcRuleData(', 'function normalizePcArchive(')+'\nreturn {normalizePcRuleSheets,pcRuleCurrentData,pcRuleEditableData,pcRuleFilled,pcRuleGroupUi};')(structuredClone);
const pc=()=>({id:'synthetic-insane',ruleMeta:{systemId:'insane'},ruleData:{traits:[{label:'old',value:'x'}],skills:[],resources:[]},ruleSheets:{insane:{traits:[],skills:[{label:'特技',value:'1',detail:'说明',extension:{a:1}}],resources:[],extraSection:{future:true}},shinobigami:{traits:[{label:'流派',value:'甲'}],skills:[],resources:[]}},coc:{san:65},excelEdits:[{sheet:'角色卡',ref:'B6',value:'1'}]});
test('visible filled count is refreshed directly from current active rule sheet',()=>{
 assert.match(html,/data-pc-rule-count/);assert.match(html,/function pcRuleRefreshGroupCount\(group,key\)/);
 assert.match(html,/pcRuleRefreshGroupCount\(e\.target\.closest\('\[data-pc-rule-group\]'\),key\)/);
});
test('filtering is delayed until change so focused rule input is not hidden during typing',()=>{
 assert.match(html,/if\(e\.target\.dataset\.pcGenericField\)\{if\(document\.activeElement!==e\.target\)pcApplyRuleFieldFilters\(\);return;\}/);
 assert.match(html,/addEventListener\('focusout',e=>/);
 assert.match(html,/pcRuleRefreshGroupCount\(group,key\)/);
});
test('active rules stay independent through normalization and simulated JSON save and reload',()=>{
 let p=pc(),before=structuredClone({ruleData:p.ruleData,coc:p.coc,excelEdits:p.excelEdits,shinobigami:p.ruleSheets.shinobigami});
 p.ruleSheets.insane.skills[0].value='7';
 p=structuredClone(p);p.ruleSheets=api.normalizePcRuleSheets(p.ruleSheets);
 assert.equal(api.pcRuleCurrentData(p).skills[0].value,'7');assert.deepEqual(p.ruleSheets.insane.extraSection,{future:true});assert.deepEqual(p.ruleSheets.insane.skills[0].extension,{a:1});
 p.ruleMeta.systemId='shinobigami';assert.equal(api.pcRuleCurrentData(p).traits[0].value,'甲');
 p.ruleMeta.systemId='insane';assert.equal(api.pcRuleCurrentData(p).skills[0].value,'7');
 assert.deepEqual({ruleData:p.ruleData,coc:p.coc,excelEdits:p.excelEdits,shinobigami:p.ruleSheets.shinobigami},before);
});
