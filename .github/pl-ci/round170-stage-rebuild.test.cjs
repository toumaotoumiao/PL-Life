'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const part=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);assert.ok(x>=0&&y>x,`missing boundary ${a}`);return html.slice(x,y)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scope=part('function normalizePcRuleData(','function normalizePcArchive(');
const editor=part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){');
const reader=part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){');
const api=new Function('clone','escapeHTML','moduleRuleDisplay',`${scope}\n${editor}\n${reader}\nreturn {normalizePcRuleData,normalizePcRuleSheets,pcRuleCurrentData,pcMoveRuleEntry,pcRuleGroupUi,pcRuleFilled,pcRuleReadingHTML,pcGenericRuleEditorHTML,pcRuleDetailOpenUi,pcRuleReadingOpenUi};`)(structuredClone,esc,r=>r.systemId);
const make=()=>({id:'pc-synthetic',name:'synthetic',ruleMeta:{systemId:'insane'},ruleData:{traits:[{label:'old',value:'v',detail:'legacy',extra:{p:1}}],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'生命力',value:'6',detail:'公开说明',extra:{a:true}}],skills:Array.from({length:10},(_,i)=>({label:'特技'+i,value:String(i),detail:i===3?'公开效果\n使用条件':'',future:{i}})),resources:[],unknownSection:{v:1}},shinobigami:{traits:[{label:'流派',value:'甲'}],skills:[],resources:[]}},coc:{san:44},excelEdits:[{sheet:'角色卡',ref:'B6',value:'original'}]});
test('rule field descriptions and unknown extensions survive normalization and active-only moves',()=>{
 const pc=make(),before=structuredClone(pc);const normalized=api.normalizePcRuleSheets(pc.ruleSheets);
 assert.deepEqual(normalized.insane.unknownSection,{v:1});assert.equal(normalized.insane.skills[3].detail,'公开效果\n使用条件');assert.deepEqual(normalized.insane.skills[3].future,{i:3});
 assert.equal(api.pcMoveRuleEntry(pc,'skills',3,1),4);assert.equal(pc.ruleSheets.insane.skills[4].detail,'公开效果\n使用条件');
 assert.deepEqual(pc.ruleSheets.shinobigami,before.ruleSheets.shinobigami);assert.deepEqual(pc.ruleData,before.ruleData);assert.deepEqual(pc.coc,before.coc);assert.deepEqual(pc.excelEdits,before.excelEdits);
});
test('long reading is grouped with 6-item summary and expands without losing escaped long description',()=>{
 const pc=make();pc.ruleSheets.insane.skills[3].detail='<img src=x onerror=alert(1)>\n公开效果';
 const rendered=api.pcRuleReadingHTML(pc);assert.match(rendered,/展开全部（另 4 项）/);assert.match(rendered,/&lt;img src=x/);assert.doesNotMatch(rendered,/<img src=x/);
 const token='pc-synthetic:insane:skills';api.pcRuleReadingOpenUi.add(token);assert.match(api.pcRuleReadingHTML(pc),new RegExp(`data-pc-rule-read-token="${token}"[^>]* open`));
});
test('field editor provides public description and non-mutating filter controls only above 8 rows',()=>{
 const pc=make();let rendered=api.pcGenericRuleEditorHTML(pc);assert.match(rendered,/data-pc-rule-search="skills"/);assert.match(rendered,/data-pc-rule-filled="skills"/);assert.match(rendered,/data-pc-generic-field="detail"/);assert.match(rendered,/公开说明 · 已填/);
 assert.deepEqual(api.pcRuleGroupUi(pc,'skills'),{query:'',filled:false});assert.equal(api.pcRuleFilled({label:'A',detail:'note',value:''}),true);
 pc.ruleSheets.insane.skills=pc.ruleSheets.insane.skills.slice(0,8);rendered=api.pcGenericRuleEditorHTML(pc);assert.doesNotMatch(rendered,/data-pc-rule-search="skills"/);
});
test('public description and code boundaries preserve original CoC7 Excel data and schema26',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);assert.match(html,/const APP_UI_VERSION = "\d+(?:\.\d+){3}"/);
 assert.match(html,/String\(row\?\.detail\|\|''\)\.length>3000/);
 assert.match(html,/pcGenericArchiveBlocks\(pc,state,innerWidth/);assert.match(html,/maxLines=26,maxBody=700/);
 assert.match(html,/data-pc-copy-legacy-rule/);assert.match(html,/克苏鲁的呼唤第七版|CoC7/);
});
