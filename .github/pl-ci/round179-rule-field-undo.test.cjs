'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j);}
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function api(){return new Function('clone','escapeHTML','moduleRuleDisplay',part('function normalizePcRuleData(','function normalizePcArchive(')+'\n'+part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')+'\nreturn {pcRuleEditableData,pcRuleCurrentData,pcRuleDeleteUndoUi,pcRuleUndoDeleted,pcRuleUndoCount,pcRuleRememberDeleted,pcRuleGenericKey,pcRuleScope,pcRuleRetargetCustomScope,pcRuleUiScope,pcRuleDetailToken,pcRuleReadingDetailToken,pcRuleDetailOpenUi,pcRuleReadingDetailOpenUi,pcRuleUndoToken,pcGenericRuleEditorHTML,pcRuleGroupUi};')(structuredClone,escapeHTML,m=>m?.customName||m?.systemId||'规则');}
function pc(id='A'){return {id,name:'虚构 PC',ruleMeta:{familyId:'other',systemId:'custom',customName:'规则甲',customEdition:'一版',confirmed:true},ruleSheets:{future:{foo:'keep'}},ruleData:{traits:[{label:'旧资料',value:'不改'}],skills:[],resources:[]},coc:{san:41},excelEdits:[{sheet:'原件',ref:'A1',value:'勿改'}]};}
function rm(x,p,key,index){const rows=x.pcRuleEditableData(p)[key];x.pcRuleRememberDeleted(p,key,index,rows[index]);rows.splice(index,1);return rows;}
test('one-step undo restores the whole row and original order without touching unrelated data',()=>{
 const x=api(),p=pc();let rows=x.pcRuleEditableData(p).skills;
 rows.push({label:'第1项',value:'11'}, {label:'第2项',value:'22',detail:'说明\n保留',future:{nested:['keep']}}, {label:'第3项',value:'33'});
 const original=structuredClone(rows),legacy=structuredClone(p.ruleData),future=structuredClone(p.ruleSheets.future),excel=structuredClone(p.excelEdits),coc=structuredClone(p.coc);
 x.pcRuleDetailOpenUi.add(x.pcRuleDetailToken(p,'skills',1));x.pcRuleReadingDetailOpenUi.add(x.pcRuleReadingDetailToken(p,'skills',1));
 rm(x,p,'skills',1);assert.equal(x.pcRuleUndoCount(p,'skills'),1);assert.equal(rows.length,2);
 assert.equal(x.pcRuleUndoDeleted(p,'skills'),1);assert.deepEqual(rows,original);
 assert(x.pcRuleDetailOpenUi.has(x.pcRuleDetailToken(p,'skills',1)));assert(x.pcRuleReadingDetailOpenUi.has(x.pcRuleReadingDetailToken(p,'skills',1)));
 assert.equal(x.pcRuleUndoCount(p,'skills'),0);assert.deepEqual(p.ruleData,legacy);assert.deepEqual(p.ruleSheets.future,future);assert.deepEqual(p.coc,coc);assert.deepEqual(p.excelEdits,excel);
});
test('two deletes, reverse undo order and active group isolation',()=>{
 const x=api(),p=pc(),rows=x.pcRuleEditableData(p).resources;
 for(const name of ['甲','乙','丙','丁'])rows.push({label:name,value:name});
 rm(x,p,'resources',1);rm(x,p,'resources',1);assert.deepEqual(rows.map(r=>r.label),['甲','丁']);assert.equal(x.pcRuleUndoCount(p,'resources'),2);
 assert.equal(x.pcRuleUndoDeleted(p,'resources'),1);assert.equal(x.pcRuleUndoDeleted(p,'resources'),1);assert.deepEqual(rows.map(r=>r.label),['甲','乙','丙','丁']);
 rm(x,p,'resources',0);assert.equal(x.pcRuleUndoCount({...p,id:'B'},'resources'),0);assert.equal(x.pcRuleUndoCount(p,'traits'),0);
 const other=structuredClone(p);other.ruleMeta.customName='规则乙';assert.equal(x.pcRuleUndoCount(other,'resources'),0);
 assert.equal(x.pcRuleUndoDeleted(other,'resources'),-1);assert.equal(x.pcRuleUndoCount(p,'resources'),1);
});
test('a full group refuses undo without consuming its saved row',()=>{
 const x=api(),p=pc(),rows=x.pcRuleEditableData(p).traits;rows.length=0;
 for(let i=0;i<40;i++)rows.push({label:`t${i}`,value:String(i)});
 rm(x,p,'traits',2);rows.push({label:'新增字段',value:'99'});const before=structuredClone(rows);
 assert.equal(x.pcRuleUndoDeleted(p,'traits'),-2);assert.deepEqual(rows,before);assert.equal(x.pcRuleUndoCount(p,'traits'),1);
 rows.pop();assert.equal(x.pcRuleUndoDeleted(p,'traits'),2);assert.equal(rows[2].label,'t2');
});
test('renaming the current custom ruleset migrates only its undo history',()=>{
 const x=api(),p=pc();x.pcRuleEditableData(p).skills.push({label:'可恢复',value:'9',future:{a:1}});
 rm(x,p,'skills',0);const prior=x.pcRuleUndoToken(p,'skills');assert.equal(x.pcRuleRetargetCustomScope(p,'customName','规则新名称'),true);
 assert.notEqual(x.pcRuleUndoToken(p,'skills'),prior);assert.equal(x.pcRuleDeleteUndoUi.has(prior),false);assert.equal(x.pcRuleUndoCount(p,'skills'),1);
 assert.equal(x.pcRuleUndoDeleted(p,'skills'),0);assert.equal(x.pcRuleCurrentData(p).skills[0].future.a,1);
});
test('undo UI remains inline, is scoped to active group, and saves only on explicit Save',()=>{
 const x=api(),p=pc();const rows=x.pcRuleEditableData(p).skills;rows.push({label:'实例技能',value:'8'});rm(x,p,'skills',0);
 const ui=x.pcGenericRuleEditorHTML(p);assert.match(ui,/data-pc-rule-undo="skills"/);assert.match(ui,/本组已删除 1 项/);assert.doesNotMatch(ui,/data-pc-rule-undo="traits"/);
 assert.match(html,/pcRuleDeleteUndoUi\.clear\(\)/);assert.match(html,/pcRuleRememberDeleted\(pcDraft,key,index,rows\[index\]\)/);
 assert.match(html,/pcRuleUndoDeleted\(pcDraft,key\)/);assert.match(html,/if\(index===-2\)/);
});
