'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j);}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function api(){return new Function('clone','escapeHTML','moduleRuleDisplay','normalizedEntityNameKey','PC_CARD_TIME_REFS','PC_COC_KEYS',part('function normalizePcRuleData(','function normalizePcArchive(')+'\n'+part('function pcValidateArchiveInput(','function assertRunLogInputPreserved(')+'\n'+part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')+'\nreturn {pcRuleCurrentData,pcRuleEditableData,pcRuleRetargetCustomScope,pcRuleSavedGenericOptions,pcRuleSwitchToSavedScope,pcRuleGenericKey,pcRuleScope,pcRuleGroupUi,pcRuleDetailToken,pcRuleReadingDetailToken,pcRuleReadingGroupToken,pcRuleReadingSearchUi,pcRuleDetailOpenUi,pcRuleReadingDetailOpenUi,pcRuleReadingOpenUi,pcRuleFilterUi,normalizePcRuleSheets,pcValidateArchiveInput,pcGenericRuleEditorHTML};')(structuredClone,escapeHTML,m=>m?.customName||m?.systemId||'通用规则',x=>String(x||'').trim().toLowerCase(),{},[]);}
function pc(id='p1'){return {id,name:'虚构',ruleMeta:{familyId:'other',systemId:'custom',editionId:'',customName:'规则甲',customEdition:'一版',confirmed:true,source:'user-selected'},ruleData:{traits:[{label:'旧',value:'不修改'}],skills:[],resources:[]},ruleSheets:{future:{keep:'未来字段'}},coc:{san:33},excelEdits:[{sheet:'源表',ref:'A1',value:'旧值'}]};}
const copy=v=>JSON.parse(JSON.stringify(v));
test('a rename into an existing ruleset is refused without changing either sheet, meta or legacy data',()=>{
 const x=api(),p=pc(),meta=copy(p.ruleMeta),legacy=copy(p.ruleData),coc=copy(p.coc),excel=copy(p.excelEdits);
 x.pcRuleEditableData(p).traits.push({label:'甲专属',value:'25',detail:'说明',future:{id:7}});
 const keyA=x.pcRuleGenericKey(p);p.ruleMeta.customName='规则乙';x.pcRuleEditableData(p).traits.push({label:'乙专属',value:'99'});const keyB=x.pcRuleGenericKey(p);
 const a=copy(p.ruleSheets[keyA]),b=copy(p.ruleSheets[keyB]);
 assert.equal(x.pcRuleRetargetCustomScope(p,'customName','规则甲'),false);
 assert.equal(p.ruleMeta.customName,'规则乙');assert.deepEqual(p.ruleSheets[keyA],a);assert.deepEqual(p.ruleSheets[keyB],b);
 assert.deepEqual(p.ruleData,legacy);assert.deepEqual(p.coc,coc);assert.deepEqual(p.excelEdits,excel);assert.equal(p.ruleSheets.future.keep,'未来字段');assert.equal(x.pcRuleCurrentData(p).traits.at(-1).value,'99');
 assert.equal(x.pcValidateArchiveInput(p),'');
});
test('an edition collision is also refused; switching deliberately is still able to read both',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).skills.push({label:'第一版',value:'11'});const first=x.pcRuleGenericKey(p);
 p.ruleMeta.customEdition='二版';x.pcRuleEditableData(p).skills.push({label:'第二版',value:'22'});const second=x.pcRuleGenericKey(p);
 assert.equal(x.pcRuleRetargetCustomScope(p,'customEdition','一版'),false);
 assert.equal(p.ruleMeta.customEdition,'二版');assert.equal(x.pcRuleCurrentData(p).skills[0].value,'22');
 p.ruleMeta.customEdition='一版';assert.equal(x.pcRuleCurrentData(p).skills[0].value,'11');
 const restored=copy(p);restored.ruleSheets=x.normalizePcRuleSheets(restored.ruleSheets);
 assert.equal(restored.ruleSheets[first].skills[0].value,'11');assert.equal(restored.ruleSheets[second].skills[0].value,'22');
});
test('nonconflicting rename moves sheet and transient editor/reading state without changing its data',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).resources.push({label:'资源',value:'7',detail:'不能丢',ext:{a:1}});
 const oldKey=x.pcRuleGenericKey(p),oldToken=x.pcRuleDetailToken(p,'resources',0),oldGroup=x.pcRuleReadingGroupToken(p,'resources');
 x.pcRuleGroupUi(p,'resources').query='资源';x.pcRuleGroupUi(p,'resources').filled=true;
 x.pcRuleDetailOpenUi.add(oldToken);x.pcRuleReadingDetailOpenUi.add(x.pcRuleReadingDetailToken(p,'resources',0));x.pcRuleReadingOpenUi.add(oldGroup);x.pcRuleReadingSearchUi.set(oldGroup,'资源');
 assert.equal(x.pcRuleRetargetCustomScope(p,'customName','新规则'),true);
 const nextKey=x.pcRuleGenericKey(p),nextToken=x.pcRuleDetailToken(p,'resources',0),nextGroup=x.pcRuleReadingGroupToken(p,'resources');
 assert.notEqual(oldKey,nextKey);assert.equal(p.ruleSheets[oldKey],undefined);
 assert.equal(x.pcRuleCurrentData(p).resources[0].ext.a,1);assert.equal(x.pcRuleCurrentData(p).resources[0].detail,'不能丢');
 assert.equal(x.pcRuleGroupUi(p,'resources').query,'资源');assert.equal(x.pcRuleGroupUi(p,'resources').filled,true);
 assert(x.pcRuleDetailOpenUi.has(nextToken));assert(!x.pcRuleDetailOpenUi.has(oldToken));assert(x.pcRuleReadingOpenUi.has(nextGroup));assert.equal(x.pcRuleReadingSearchUi.get(nextGroup),'资源');
});
test('transient editor and reading state is isolated by PC id even when rules and editions match',()=>{
 const x=api(),a=pc('A'),b=pc('B');
 x.pcRuleGroupUi(a,'skills').query='A 私有搜索';x.pcRuleGroupUi(a,'skills').filled=true;x.pcRuleDetailOpenUi.add(x.pcRuleDetailToken(a,'skills',0));
 x.pcRuleReadingSearchUi.set(x.pcRuleReadingGroupToken(a,'skills'),'A 的阅读搜索');
 assert.deepEqual(x.pcRuleGroupUi(b,'skills'),{query:'',filled:false});assert.notEqual(x.pcRuleDetailToken(a,'skills',0),x.pcRuleDetailToken(b,'skills',0));
 assert.equal(x.pcRuleReadingSearchUi.has(x.pcRuleReadingGroupToken(b,'skills')),false);
 assert.equal(x.pcRuleDetailOpenUi.has(x.pcRuleDetailToken(b,'skills',0)),false);
});
test('the saved-rule selector explicitly switches to existing data without copying/merging or rewriting the legacy source',()=>{
 const x=api(),p=pc(),legacy=copy(p.ruleData);
 x.pcRuleEditableData(p).traits.push({label:'甲',value:'1'});const a=x.pcRuleGenericKey(p);
 p.ruleMeta.customName='规则乙';x.pcRuleEditableData(p).skills.push({label:'乙',value:'2'});const b=x.pcRuleGenericKey(p);
 let choices=x.pcRuleSavedGenericOptions(p);
 assert(choices.some(v=>v.key===a&&v.label.includes('规则甲')));
 const beforeA=copy(p.ruleSheets[a]),beforeB=copy(p.ruleSheets[b]);
 assert.equal(x.pcRuleSwitchToSavedScope(p,a),true);assert.equal(p.ruleMeta.customName,'规则甲');assert.equal(x.pcRuleCurrentData(p).traits.at(-1).value,'1');
 assert.deepEqual(p.ruleSheets[a],beforeA);assert.deepEqual(p.ruleSheets[b],beforeB);assert.deepEqual(p.ruleData,legacy);
 assert.equal(x.pcRuleSwitchToSavedScope(p,'generic:v1:[\"x\"]'),false);
 assert.equal(x.pcRuleSwitchToSavedScope(p,b),true);assert.equal(x.pcRuleCurrentData(p).skills[0].value,'2');
 const out=x.pcGenericRuleEditorHTML(p);assert.match(out,/规则乙/);
});
test('the menu handler refuses collision with visible inline status and restores input to the actual draft',()=>{
 const handler=part("document.getElementById('pcRuleMenu')?.addEventListener('input'",'els.closeModuleAdvanced.addEventListener');
 assert.match(handler,/if\(!success\)/);assert.match(handler,/e\.target\.value=String\(pcDraft\.ruleMeta\?\.\[key\]\|\|''\)/);
 assert.match(handler,/data-pc-rule-scope-notice/);assert.match(handler,/aria-live/);assert.match(handler,/本次重命名未执行/);
 assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=/);assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
