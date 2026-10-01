'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j);}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function api(){return new Function('clone','escapeHTML','moduleRuleDisplay','normalizedEntityNameKey','PC_CARD_TIME_REFS','PC_COC_KEYS',part('function normalizePcRuleData(','function normalizePcArchive(')+'\n'+part('function pcValidateArchiveInput(','function assertRunLogInputPreserved(')+'\n'+part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')+'\nreturn {pcRuleCurrentData,pcRuleEditableData,pcRuleFreezeBeforeSwitch,pcRuleRetargetCustomScope,pcRuleGenericKey,pcRuleScope,normalizePcRuleData,normalizePcRuleSheets,pcValidateArchiveInput,pcGenericRuleEditorHTML,PC_GENERIC_RULE_SCOPE_MARK};')(structuredClone,escapeHTML,m=>m?.customName||m?.systemId||'通用规则',x=>String(x||'').trim().toLowerCase(),{},[]);}
const plain=x=>JSON.parse(JSON.stringify(x));
function pc(systemId='custom',name='规则甲'){return {id:'synthetic-31',name:'虚构 PC',ruleMeta:{familyId:'other',systemId,customName:name,editionId:'',customEdition:'',confirmed:true,source:'user-selected'},ruleData:{traits:[{label:'',value:'历史属性',detail:'尾部说明',future:{id:99}}],skills:[],resources:[],future:{keep:true}},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[],extension:'untouched'},'future-system':{extension:42}},coc:{san:51},excelEdits:[{sheet:'角色卡',ref:'B7',value:'旧 Excel'}],skills:[],weapons:[],snapshots:[]};}
test('initial legacy generic sheet remains readable, first edit creates an isolated copy without overwriting original',()=>{
 const x=api(),p=pc(),legacy=plain(p.ruleData);assert.equal(x.pcRuleCurrentData(p).traits[0].value,'历史属性');
 x.pcRuleEditableData(p).traits[0].value='甲的内容';assert.deepEqual(plain(p.ruleData),legacy);assert.equal(p.ruleSheets[x.PC_GENERIC_RULE_SCOPE_MARK],true);
 assert.equal(x.pcRuleCurrentData(p).traits[0].value,'甲的内容');assert.equal(x.pcRuleCurrentData(p).traits[0].future.id,99);
});
test('different unknown rules and editions never share editable data; switching and reloading preserve all three',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).traits[0].value='规则甲专属';const oldKey=x.pcRuleGenericKey(p);x.pcRuleFreezeBeforeSwitch(p);
 p.ruleMeta={...p.ruleMeta,customName:'规则乙'};assert.deepEqual(plain(x.pcRuleCurrentData(p)),{traits:[],skills:[],resources:[]});
 x.pcRuleEditableData(p).skills.push({label:'乙专属技能',value:'80',future:{abc:true}});const secondKey=x.pcRuleGenericKey(p);assert.notEqual(oldKey,secondKey);
 x.pcRuleFreezeBeforeSwitch(p);p.ruleMeta={...p.ruleMeta,customEdition:'第二版'};assert.equal(x.pcRuleCurrentData(p).skills.length,0);
 x.pcRuleEditableData(p).resources.push({label:'第二版资源',value:'3'});
 let restored=plain(p);restored.ruleSheets=x.normalizePcRuleSheets(restored.ruleSheets);restored.ruleData=x.normalizePcRuleData(restored.ruleData);
 assert.equal(restored.ruleSheets['future-system'].extension,42);assert.equal(restored.ruleSheets.insane.extension,'untouched');
 assert.equal(restored.ruleData.traits[0].value,'历史属性');assert.equal(restored.excelEdits[0].value,'旧 Excel');assert.equal(restored.coc.san,51);
 assert.equal(x.pcRuleCurrentData(restored).resources[0].value,'3');restored.ruleMeta.customEdition='';assert.equal(x.pcRuleCurrentData(restored).skills[0].future.abc,true);
 restored.ruleMeta.customName='规则甲';assert.equal(x.pcRuleCurrentData(restored).traits[0].value,'规则甲专属');assert.equal(x.pcValidateArchiveInput(restored),'');
});
test('changing a custom rule name moves its active sheet without silently overwriting an existing target sheet',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).traits[0].value='原名值';x.pcRuleRetargetCustomScope(p,'customName','规则乙');assert.equal(x.pcRuleCurrentData(p).traits[0].value,'原名值');assert(!p.ruleSheets[x.pcRuleGenericKey({...p,ruleMeta:{...p.ruleMeta,customName:'规则甲'}})]);
 x.pcRuleFreezeBeforeSwitch(p);p.ruleMeta.customName='规则甲';x.pcRuleEditableData(p).traits.push({label:'旧甲',value:'独立'});
 x.pcRuleFreezeBeforeSwitch(p);p.ruleMeta.customName='规则乙';
 assert.equal(x.pcRuleRetargetCustomScope(p,'customName','规则甲'),false);
 assert.equal(p.ruleMeta.customName,'规则乙');assert.equal(x.pcRuleCurrentData(p).traits[0].value,'原名值');
 p.ruleMeta.customName='规则甲';assert.equal(x.pcRuleCurrentData(p).traits.at(-1).value,'独立');
});
test('switching out of a template keeps CoC/legacy values and gives new generic mode a blank sheet with visible legacy-copy source',()=>{
 const x=api(),p=pc('insane','');p.ruleSheets.insane.traits=[{label:'生命力',value:'6'}];
 x.pcRuleFreezeBeforeSwitch(p);p.ruleMeta={familyId:'other',systemId:'custom',customName:'全新规则',confirmed:true};
 assert.equal(x.pcRuleCurrentData(p).traits.length,0);const view=x.pcGenericRuleEditorHTML(p);
 assert.match(view,/原有通用规则数据/);assert.match(view,/历史属性/);assert.match(view,/data-pc-copy-legacy-rule/);
 assert.equal(p.ruleData.traits[0].future.id,99);assert.equal(p.ruleSheets.insane.traits[0].value,'6');
 assert.match(html,/if\(copyOld&&\(pcRuleTemplateKey\(pcDraft\)\|\|pcDraft\.ruleSheets\?\.\[PC_GENERIC_RULE_SCOPE_MARK\]\)\)/);
 assert.doesNotMatch(html,/旧通用规则资料有未命名字段，本次没有复制任何内容/);
});
test('own generic scoped fields follow the same count and length safety checks; unknown future keys remain untouched',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).traits[0].detail='保留说明';assert.equal(x.pcValidateArchiveInput(p),'');
 x.pcRuleEditableData(p).traits[0].detail='x'.repeat(3001);assert.match(x.pcValidateArchiveInput(p),/过长/);
 x.pcRuleEditableData(p).traits[0].detail='安全';x.pcRuleEditableData(p).skills=Array.from({length:101},()=>({label:'技能',value:'4'}));assert.match(x.pcValidateArchiveInput(p),/超过 100 项/);
});
test('actual editor rule controls freeze old sheet before all three types of rule switch; custom rename is separate',()=>{
 const change=part("document.getElementById('pcRuleMenu')?.addEventListener('change'", "document.getElementById('pcRuleMenu')?.addEventListener('input'");
 assert.equal((change.match(/pcRuleFreezeBeforeSwitch\(pcDraft\)/g)||[]).length,3);
 const input=part("document.getElementById('pcRuleMenu')?.addEventListener('input'",'els.closeModuleAdvanced.addEventListener');
 assert.match(input,/pcRuleRetargetCustomScope\(pcDraft,key,e\.target\.value\)/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=/);
});
