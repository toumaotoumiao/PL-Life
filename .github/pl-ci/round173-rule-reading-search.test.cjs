'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const part=(start,end)=>{const i=html.indexOf(start),j=html.indexOf(end,i);assert.ok(i>=0&&j>i,start);return html.slice(i,j);};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=new Function('clone','escapeHTML',`${part('function normalizePcRuleData(', 'function normalizePcArchive(')}\n${part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){')}\nreturn {pcRuleReadingHTML,pcRuleReadingSearchUi,pcRuleReadingOpenUi,pcRuleCurrentData,pcRuleReadingGroupToken};`)(structuredClone,escapeHTML);
function pc(id='synthetic-insane',systemId='insane') {return {id,ruleMeta:{systemId},ruleSheets:{insane:{traits:[],skills:[{label:'不公开的占位字段',value:'',detail:''},...Array.from({length:12},(_,i)=>({label:'特技'+i,value:String(i),detail:i===9?'带换行的公开说明\n可供检索：马灯':'第'+i+'项说明',extension:{original:i}}))],resources:[]},shinobigami:{traits:[],skills:[{label:'忍术',value:'2',detail:'另一规则'}],resources:[]}},ruleData:{traits:[],skills:[],resources:[]},coc:{san:33},excelEdits:[{sheet:'旧卡',ref:'B2',value:'旧内容'}]};}
test('reading search is only shown for groups with more than eight filled rows, and scans public description',()=>{
 const record=pc(),raw=JSON.stringify(record),token=api.pcRuleReadingGroupToken(record,'skills');
 api.pcRuleReadingSearchUi.set(token,'马灯');const rendered=api.pcRuleReadingHTML(record);
 assert.match(rendered,/data-pc-rule-reading-search="skills"/);assert.match(rendered,/显示 1 \/ 12/);assert.match(rendered,/data-pc-rule-search-active="1"[^>]* open/);assert.match(rendered,/data-pc-rule-reading-item="10" /); // source index includes an unfilled row
 assert.match(rendered,/data-pc-rule-reading-item="2" hidden/);assert.deepEqual(JSON.parse(raw),record);
 record.ruleMeta.systemId='shinobigami';assert.doesNotMatch(api.pcRuleReadingHTML(record),/data-pc-rule-reading-search/);
 record.ruleMeta.systemId='insane';assert.match(api.pcRuleReadingHTML(record),/value="马灯"/);
 record.ruleSheets.insane.skills=record.ruleSheets.insane.skills.slice(0,5);assert.doesNotMatch(api.pcRuleReadingHTML(record),/data-pc-rule-reading-search/);assert.ok(!api.pcRuleReadingSearchUi.has(token));
 api.pcRuleReadingSearchUi.clear();
});
test('UI-only search has PC and rule-scoped keys, never becomes persisted archive material',()=>{
 const a=pc('a'),b=pc('b');const keyA=api.pcRuleReadingGroupToken(a,'skills'),keyB=api.pcRuleReadingGroupToken(b,'skills');
 assert.notEqual(keyA,keyB);api.pcRuleReadingSearchUi.set(keyA,'特技7');
 assert.match(api.pcRuleReadingHTML(a),/value="特技7"/);assert.doesNotMatch(api.pcRuleReadingHTML(b),/value="特技7"/);
 assert.deepEqual(Object.keys(a.ruleSheets.insane.skills[8].extension),['original']);assert.equal(a.excelEdits[0].value,'旧内容');
 api.pcRuleReadingSearchUi.clear();
});
test('actual editor input and event delegate are wired; no source schema or Excel exporter mutation',()=>{
 assert.match(html,/const readingSearch=e\.target\.dataset\.pcRuleReadingSearch/);
 assert.match(html,/pcApplyRuleReadingSearch\(e\.target\.closest\('\[data-pc-rule-reading-group\]'\),e\.target\.value\)/);
 assert.match(html,/pcRuleReadingSearchUi\.clear\(\)/);
 assert.match(html,/reading&&!e\.target\.dataset\.pcRuleSearchActive/);
 assert.match(html,/\.pc-rule-reading-item\[hidden\][\s\S]*?\{display:none!important\}/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/const APP_UI_VERSION = "\d+(?:\.\d+){3}"/);
});
