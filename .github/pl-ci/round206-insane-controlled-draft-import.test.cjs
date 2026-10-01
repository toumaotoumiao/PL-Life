'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('/* Stage60 pure controlled-draft gate start.'),end=html.indexOf('/* Stage60 pure controlled-draft gate end */',start);
assert.ok(start>=0&&end>start);
const code=html.slice(start,end);
const clone=x=>JSON.parse(JSON.stringify(x));
const pcRuleCurrentData=pc=>pc.ruleSheets?.insane||{traits:[{label:'生命力',value:''},{label:'正气度',value:''}],skills:[],resources:[]};
const pcRuleEditableData=pc=>(pc.ruleSheets??={}).insane??=clone(pcRuleCurrentData(pc));
const pcInsaneSheetCell=(sheet,ref)=>sheet.cells[ref]??'';
const api=new Function('clone','pcRuleCurrentData','pcRuleEditableData','pcInsaneSheetCell',code+'\nreturn {candidates:pcInsaneDraftCandidates,plan:pcInsaneDraftBuildPlan,target:pcInsaneDraftTarget};')(clone,pcRuleCurrentData,pcRuleEditableData,pcInsaneSheetCell);
const fields=[['name','B20','虚构人物'],['age','B21','29'],['gender','E21','女'],['occupation','B26','调查员'],['life','E22','8'],['sanity','E23','7']];
function pc(){return {id:'pc-test',name:'旧姓名',age:'20',gender:'女',occupation:'旧职业',ruleMeta:{systemId:'insane',editionId:'2013-original'},ruleSheets:{insane:{traits:[{label:'生命力',value:'6',future:{t:1}},{label:'正气度',value:'5'}],skills:[{label:'旧特技',value:'保留'}],resources:[{label:'旧能力',value:'保留'}],futureSection:{n:1}}},futureRoot:{a:1}};}
function compare(){return {comparison:true,format:'insane-community-large-v2-readonly',rows:fields.map(([key,ref,v])=>({key,ref,value:v,state:'changed'}))};}
function sheets(){return [{name:'角色表',rows:{formulaRefs:new Set()},cells:Object.fromEntries(fields.map(x=>[x[1],x[2]]))}];}
function candidates(p=pc(),c=compare(),s=sheets()){return api.candidates(c,s,p);}
test('Round206 comparison and Insane scope required, no unchecked source accepted',()=>{
 assert.throws(()=>api.candidates({...compare(),comparison:false},sheets(),pc()),/先.*空白卡核对/);
 assert.throws(()=>api.candidates(compare(),sheets(),{...pc(),ruleMeta:{systemId:'coc'}}),/先.*Insane/);
});
test('Round206 all six candidates source-target mapping without default checks',()=>{
 const rows=candidates();assert.equal(rows.length,6);assert.equal(rows.filter(x=>x.eligible).length,5);
 assert.equal(rows.find(x=>x.ref==='E21').reason,'当前 PC 已是相同值');
 for(const x of rows)assert.match(x.ref,/^[A-Z]\d+$/);
 assert.equal(rows.find(x=>x.ref==='E22').current,'6');
});
test('Round206 no selection, unknown cell, formula and whitespace source fail closed',()=>{
 const p=pc(),rows=candidates();assert.throws(()=>api.plan(p,rows,[]),/勾选/);
 assert.throws(()=>api.plan(p,rows,['P40']),/尚未通过/);
 const sh=sheets();sh[0].rows.formulaRefs.add('B20');assert.equal(candidates(p,compare(),sh).find(x=>x.ref==='B20').eligible,false);
 sh[0].rows.formulaRefs.clear();sh[0].cells.B20=' 虚构人物';assert.equal(candidates(p,compare(),sh).find(x=>x.ref==='B20').eligible,false);
 assert.equal(p.name,'旧姓名');
});
test('Round206 selected subset changes draft clone only, preserves old data and future fields',()=>{
 const p=pc(),old=JSON.stringify(p),rows=candidates(p);
 const plan=api.plan(p,rows,['B20','E22']);
 assert.equal(JSON.stringify(p),old);assert.equal(plan.next.name,'虚构人物');assert.equal(plan.next.age,'20');
 assert.equal(plan.next.ruleSheets.insane.traits[0].value,'8');assert.deepEqual(plan.next.ruleSheets.insane.traits[0].future,{t:1});
 assert.deepEqual(plan.next.ruleSheets.insane.futureSection,{n:1});assert.equal(plan.next.ruleSheets.insane.skills[0].value,'保留');
 assert.equal(plan.changes.length,2);
});
test('Round206 changed target, PC identity and edition fail without overwrite',()=>{
 const p=pc(),rows=candidates(p);p.name='新手工编辑';assert.throws(()=>api.plan(p,rows,['B20']),/已变化/);
 const q=pc();q.id='other';assert.throws(()=>api.plan(q,rows,['B20']),/PC 或版次/);
 q.id='pc-test';q.ruleMeta.editionId='2025-revised';assert.throws(()=>api.plan(q,rows,['B20']),/PC 或版次/);
});
test('Round206 duplicate Insane resources and excessive or invalid values are unselectable',()=>{
 const p=pc();p.ruleSheets.insane.traits.push({label:'生命力',value:'99'});assert.equal(candidates(p).find(x=>x.ref==='E22').eligible,false);
 const sh=sheets();sh[0].cells.E22='13';assert.equal(candidates(pc(),compare(),sh).find(x=>x.ref==='E22').eligible,false);
 sh[0].cells.E22='8';sh[0].cells.B20='X'.repeat(101);assert.equal(candidates(pc(),compare(),sh).find(x=>x.ref==='B20').eligible,false);
 sh[0].cells.B20='bad\nvalue';assert.equal(candidates(pc(),compare(),sh).find(x=>x.ref==='B20').eligible,false);
});
test('Round206 unresolved skills, abilities, items and private notes never enter the import allowlist',()=>{
 const p=pc(),rows=candidates(p),plan=api.plan(p,rows,['B20']);
 assert.deepEqual(Object.keys(plan.next.ruleSheets.insane),Object.keys(p.ruleSheets.insane));
 assert.doesNotMatch(code,/P40|private-note|excelEdits|pcWorkbookPut|saveState\s*\(/);
 assert.deepEqual(Object.keys(plan.next).sort(),Object.keys(p).sort());
});
test('Round206 preview cancel has no writes and apply needs two explicit confirmations',()=>{
 const preview=html.slice(html.indexOf('let pcInsanePreviewSheets=null'),html.indexOf('function pcExcelDelimitedRows',html.indexOf('let pcInsanePreviewSheets=null')));
 assert.match(preview,/data-pc-insane-draft-ref/);assert.match(preview,/appConfirm\(/);assert.match(preview,/pcInsaneDraftBuildPlan\(pcDraft,session\.rows,selected\)/g);
 assert.match(preview,/if\(!ok\)return/);assert.match(preview,/pcInsanePreviewClose\(\);renderPcEditor\(\)/);
 assert.match(preview,/pcInsaneDraftCompareSession=null/);assert.match(html,/if\(pcInsaneDraftImportReview\)\{[\s\S]*?确认保存 PC/);
 assert.doesNotMatch(preview,/saveState\s*\(|pcWorkbookPut\s*\(/);
});
test('Round206 CI, release and privacy contracts',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8'),native=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
 for(const source of [wf,native])assert.match(source,/round206-insane-controlled-draft-import\.test\.cjs/);
 const v=html.match(/const APP_UI_VERSION = "([0-9.]+)";/)?.[1];assert.ok(v);assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes(v));
 for(const file of ['inSANe大判空白卡V2.0数据（自动卡）.xlsx','【新ins】角色卡汉化.pdf'])assert.equal(fs.existsSync(path.join(root,file)),false);
});
