'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('/* Stage60 pure controlled-draft gate start.'),b=html.indexOf('/* Stage60 pure controlled-draft gate end */',a),c=html.indexOf('/* Stage61 specialty mapping preflight start.'),d=html.indexOf('let pcInsanePreviewSheets=null',c);
assert.ok(a>0&&b>a&&c>b&&d>c,'existing production source and follow-on helper must exist');
const source=html.slice(a,b)+html.slice(c,d);
const clone=x=>JSON.parse(JSON.stringify(x)),pcRuleCurrentData=p=>p.ruleSheets?.insane||{traits:[],skills:[],resources:[]},pcRuleEditableData=p=>(p.ruleSheets??={}).insane??=clone(pcRuleCurrentData(p)),pcInsaneSheetCell=(s,ref)=>s.cells?.[ref]??'',escapeHTML=x=>String(x).replace(/[&<>"']/g,y=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[y]));
const api=new Function('clone','pcRuleCurrentData','pcRuleEditableData','pcInsaneSheetCell','escapeHTML',source+'\nreturn {check:pcInsaneSpecialityPreflight,plan:pcInsaneSpecialityBuildPlan,undo:pcInsaneDraftUndoPlan,html:pcInsaneSpecialityDraftHTML,current:pcInsaneSpecialityCurrent};')(clone,pcRuleCurrentData,pcRuleEditableData,pcInsaneSheetCell,escapeHTML);
const pc=(withSheet=true)=>{const p={id:'fictional',name:'虚构调查者',ruleMeta:{systemId:'insane',editionId:'2013-original',confirmed:true,source:'user-selected'},future:{keep:true}};if(withSheet)p.ruleSheets={insane:{traits:[{label:'生命力',value:'6',future:'keep'}],skills:[{label:'原有特技',value:'手填',detail:'原资料',future:{keep:true}}],resources:[],futureSection:{keep:true}}};return p;};
const row=(value,ref,grid,domain,number)=>({value,ref,state:'changed',match:{ref:grid,domain,row:number}}),supp=(...rows)=>({comparison:true,groups:{specialties:rows}});
const rows=()=>supp(row('特技甲','B29','I3',1,3),row('特技乙','C29','K4',2,4));
function apply(p,refs=['B29']){const beforeSheetExisted=Object.hasOwn(p.ruleSheets||{},'insane'),plan=api.plan(p,rows(),refs,true);return {plan,review:{pcId:p.id,editionId:p.ruleMeta.editionId,changes:clone(plan.changes),beforeSheetExisted,afterSheet:clone(plan.next.ruleSheets.insane),saveCommitted:false}};}
test('Round209 conflicting source location blocks ALL candidates, not only later input',()=>{
 const data=supp(row('甲','B29','I3',1,3),row('乙','C29','I3',1,3));const result=api.check(data,pc());assert.ok(result.every(x=>x.status==='待人工核对'));assert.throws(()=>api.plan(pc(),data,['B29'],true),/唯一核对/);
 const repeated=supp(row('甲','B29','I3',1,3),row('甲','C29','K4',2,4));assert.ok(api.check(repeated,pc()).every(x=>x.status==='待人工核对'));const latin=supp(row('STAR','B29','I3',1,3),row('star','C29','K4',2,4));assert.ok(api.check(latin,pc()).every(x=>x.status==='待人工核对'));
});
test('Round209 requires explicit rule edition and manual source-edition acknowledgment',()=>{
 const p=pc();p.ruleMeta.editionId='';assert.equal(api.check(rows(),p)[0].status,'待人工核对');assert.throws(()=>api.plan(p,rows(),['B29'],true),/规则版次/);
 p.ruleMeta.editionId='2025-revised';p.ruleMeta.confirmed=false;assert.throws(()=>api.plan(p,rows(),['B29'],true),/规则版次/);
 p.ruleMeta.confirmed=true;assert.throws(()=>api.plan(p,rows(),['B29'],false),/版次与当前 PC 一致/);
});
test('Round209 adds only selected unique learned names to a cloned draft with source provenance',()=>{
 const before=pc(),original=clone(before),{plan}=apply(before,['B29']);assert.deepEqual(before,original);assert.equal(plan.next.ruleSheets.insane.skills.length,2);assert.equal(plan.next.ruleSheets.insane.skills[0].future.keep,true);
 const item=plan.next.ruleSheets.insane.skills[1];assert.deepEqual(item,{label:'特技甲',value:'已选择',detail:'',insaneSource:{format:'community-large-v2',inputRef:'B29',gridRef:'I3',domain:1,row:3,editionId:'2013-original'}});
 assert.equal(plan.next.ruleSheets.insane.futureSection.keep,true);assert.equal(plan.next.future.keep,true);assert.equal(plan.next.ruleSheets.insane.traits[0].future,'keep');assert.ok(!JSON.stringify(plan.next).includes('P40'));
});
test('Round209 blocks duplicate selection, old PC skill and limits before mutation',()=>{
 const p=pc(),before=clone(p);assert.throws(()=>api.plan(p,rows(),['B29','B29'],true),/不重复/);p.ruleSheets.insane.skills.push({label:'特技甲',value:'原值'});assert.throws(()=>api.plan(p,rows(),['B29'],true),/唯一核对/);assert.equal(p.ruleSheets.insane.skills.at(-1).value,'原值');
 assert.throws(()=>api.plan(before,rows(),[],true),/请选择/);
 const huge=pc();huge.ruleSheets.insane.skills=Array.from({length:100},(_,i)=>({label:`旧${i}`,value:'x'}));assert.throws(()=>api.plan(huge,rows(),['B29'],true),/上限/);
});
test('Round209 mismatched grid and non-diff input never becomes eligible',()=>{
 const p=pc();for(const item of [row('甲','B29','K3',1,3),{...row('甲','B29','I3',1,3),state:'unchanged'},row('坏\n字','B29','I3',1,3)]){const data=supp(item);assert.equal(api.check(data,p)[0].status,'待人工核对');assert.throws(()=>api.plan(p,data,['B29'],true),/唯一核对/);}
});
test('Round209 undo removes only imported row, preserves unrelated edits and future data',()=>{
 const {plan,review}=apply(pc(),['B29','C29']);plan.next.notes='随后手工备注';plan.next.ruleSheets.insane.skills.push({label:'随后手工特技',value:'后加'});const restored=api.undo(plan.next,review).next;assert.deepEqual(restored.ruleSheets.insane.skills.map(x=>x.label),['原有特技','随后手工特技']);assert.equal(restored.notes,'随后手工备注');assert.equal(restored.ruleSheets.insane.futureSection.keep,true);
 assert.equal(plan.next.ruleSheets.insane.skills.length,4);
});
test('Round209 undo refuses changed imported row, wrong edition, already saved, or new sheet with new data',()=>{
 const {plan,review}=apply(pc(),['B29']);plan.next.ruleSheets.insane.skills[1].value='用户后来修改';assert.throws(()=>api.undo(plan.next,review),/已被修改/);
 const p=pc(),second=apply(p);second.plan.next.ruleMeta.editionId='2025-revised';assert.throws(()=>api.undo(second.plan.next,second.review),/版次/);
 const other=apply(pc());other.review.saveCommitted=true;assert.throws(()=>api.undo(other.plan.next,other.review),/保存状态/);
 const blank=pc(false),third=apply(blank);assert.equal(Object.hasOwn(api.undo(third.plan.next,third.review).next.ruleSheets,'insane'),false);
 third.plan.next.ruleSheets.insane.skills.push({label:'新手动特技',value:'x'});assert.throws(()=>api.undo(third.plan.next,third.review),/其他修改/);
});
test('Round209 actual savePcEditor commits only selected specialty and verifies ordinary local readback',async()=>{
 const start=html.indexOf('async function savePcEditor(){'),stop=html.indexOf('\nasync function deletePcArchive(',start),vstart=html.indexOf('async function pcExcelVerifySavedPc('),vstop=html.indexOf('\n/* v8.1.11.84',vstart);
 assert.ok(start>0&&stop>start&&vstart>0&&vstop>vstart);
 const original=pc();original.ownerPlId='self';const imported=apply(original,['B29']);const stored={raw:null};let calls=0;
 const ctx={clone,pcDraft:clone(imported.plan.next),pcDndDraftImportReview:null,pcInsaneDraftImportReview:clone(imported.review),pcMediaUploadBusy:false,pcWorkbookSaveBusy:false,editingPcId:original.id,pcWorkbookPending:null,pcExcelTemplateProfilePending:null,pcMediaDraftMeta:new Map(),pcEditorNewMediaIds:new Set(),pcEditorDeleteMediaIds:new Set(),pcRuleDeleteUndoUi:new Map(),pcs:[clone(original)],runPlans:[],runRecords:[],settings:{pcExcelTemplateProfiles:[]},profiles:[{id:'self'}],localStorage:{getItem:()=>stored.raw},STORAGE_KEY:'synthetic-only',pcRuleCurrentData,pcRuleEditableData,pcInsaneSheetCell,escapeHTML,
 pcById:id=>ctx.pcs.find(x=>x.id===id),profileById:id=>id==='self'?{id}:null,profileNameById:()=> '我',pcValidateArchiveInput:()=>'',pcCandidatesByOwnerName:()=>[],normalizedEntityNameKey:x=>String(x).toLowerCase(),canonicalPcFromRuntime:x=>clone(x),normalizePcArchive:x=>clone(x),
 appNotice:msg=>{ctx.alerts.push(msg)},appConfirm:async()=>true,alerts:[],pcMediaCommitDraftMeta:async()=>[],pcMediaRollbackDraftMeta:async()=>true,pcMediaDelete:async()=>true,pcWorkbookGet:async()=>null,pcWorkbookPut:async()=>true,pcWorkbookDelete:async()=>true,
 saveState:()=>{calls++;stored.raw=JSON.stringify({data:{pcs:clone(ctx.pcs)}});return true;},safeParseStoredJson:JSON.parse,pcCrc32:()=>0,syncPcNameAcrossRuns:()=>{},editorMainSaveFailed:()=>false,markEditorMainSaveFailure:()=>{},clearEditorMainSaveFailure:()=>{},renderPcEditor:()=>{},renderPcArchive:()=>{},renderRunPlans:()=>{},renderRunRecords:()=>{},renderProfiles:()=>{},showToast:()=>{},pcEditorBaseline:'before'};
 vm.createContext(ctx);vm.runInContext(source,ctx);vm.runInContext(html.slice(vstart,vstop),ctx);vm.runInContext(html.slice(start,stop),ctx);
 assert.equal(await ctx.savePcEditor(),true);assert.equal(calls,1);assert.equal(ctx.pcInsaneDraftImportReview,null);
 const saved=JSON.parse(stored.raw).data.pcs[0];assert.equal(saved.ruleSheets.insane.skills.length,2);assert.equal(saved.ruleSheets.insane.skills[1].insaneSource.inputRef,'B29');assert.equal(saved.ruleSheets.insane.skills[0].future.keep,true);assert.equal(saved.future.keep,true);
 ctx.pcs=clone(JSON.parse(stored.raw).data.pcs);assert.equal(ctx.pcs[0].ruleSheets.insane.skills[1].value,'已选择');
 const retry=apply(original,['B29']);ctx.pcDraft=clone(retry.plan.next);ctx.pcInsaneDraftImportReview=clone(retry.review);ctx.pcs=[clone(original)];ctx.appConfirm=async()=>{ctx.pcDraft.ruleSheets.insane.skills[1].value='手工更改';return true;};
 assert.equal(await ctx.savePcEditor(),false);assert.equal(calls,1);assert.equal(ctx.pcs[0].ruleSheets.insane.skills.length,1);
});
test('Round209 UI escapes names and requires two explicit user interactions',()=>{
 const out=api.html(api.check(supp(row('<img src=x>','B29','I3',1,3)),pc()));assert.match(out,/&lt;img/);assert.doesNotMatch(out,/<img src=x>/);assert.match(out,/data-pc-insane-specialty-ack/);assert.match(out,/data-pc-insane-specialty-ref/);assert.match(html,/data-pc-insane-specialty-apply/);assert.match(html,/pcInsaneSpecialityBuildPlan\(pcDraft,session\.specialtySupplement,refs,ack\)/);
});
test('Round209 save and reuse guard covers speciality review without persisting Excel source',()=>{
 const saving=html.slice(html.indexOf('async function savePcEditor(){'),html.indexOf('async function deletePcArchive('));assert.match(saving,/pcInsaneSpecialityCurrent\(pcDraft,row\)/);assert.match(saving,/confirmationFingerprint=JSON\.stringify\(canonicalPcFromRuntime\(pcDraft\)\)/);assert.match(saving,/pcInsaneDraftImportReview\.saveCommitted=true/);assert.match(html,/pcInsaneDraftImportReview=\{pcId:String\(pcDraft\.id\|\|''\).*changes:final\.changes/);
 for(const phrase of ['pcWorkbookPending=','pcWorkbookPut('])assert.doesNotMatch(source, new RegExp(phrase.replace('(','\\(')));
});
test('Round209 CI, schema and packaging boundaries',()=>{
 for(const name of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml'])assert.match(fs.readFileSync(path.join(root,'.github/workflows',name),'utf8'),/round209-insane-specialty-controlled-draft\.test\.cjs/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+"/);assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp(html.match(/const APP_UI_VERSION = "([^"]+)"/)?.[1]||'__missing_version__'));assert.match(html,/schemaVersion:\s*26|SCHEMA_VERSION\s*=\s*26|schema26/);
 for(const f of ['inSANe大判空白卡V2.0数据（自动卡）.xlsx','【新ins】角色卡汉化.pdf'])assert.equal(fs.existsSync(path.join(root,f)),false);
});
