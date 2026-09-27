'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`Missing code: ${start}`);return html.slice(a,b);};
const definitions=between('const TRPG_RULE_FAMILIES=','let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();')+'\n'+between('function defaultModuleRuleMeta(','function normalizeModuleRating(');
const coc={familyId:'brp',systemId:'coc',editionId:'7e',source:'user-selected'},brp={familyId:'brp',systemId:'brp-generic',editionId:'',source:'user-selected'},insane={familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'};
const mk=(id,ruleMeta)=>({id,name:'同名模组',ruleMeta});
function context(extra={},code=''){const ctx=vm.createContext({...extra});vm.runInContext(definitions+'\n'+code,ctx);return ctx;}

test('legacy CoC7 / CoC6 names have the exact edition, while bare CoC remains unspecified',()=>{
 const c=context({});
 for(const [label,edition] of [['CoC7','7e'],['CoC 7','7e'],['Call of Cthulhu 7th Edition','7e'],['CoC6','6e'],['CoC 6','6e'],['CoC','']])assert.equal(c.inferModuleRuleMeta(label).editionId,edition,label);
 assert.equal(c.inferModuleRuleMeta('Insane').systemId,'insane');
});
test('an official rule ignores its hidden old custom string; two custom rules still differ',()=>{
 const c=context({});
 assert.equal(c.moduleRulesMatch(mk('a',{...coc,customName:'旧词',customEdition:'旧版'}),mk('b',{...coc})),true);
 assert.equal(c.moduleRulesMatch(mk('a',brp),mk('b',coc)),false);
 const custom={familyId:'custom',systemId:'custom',customName:'玩家自制规则',customEdition:'A'};
 assert.equal(c.moduleRulesMatch(mk('a',custom),mk('b',{...custom,customEdition:'B'})),false);
});
function recordContext({brpAlready=false,selected=false}={}){
 let selectedId='',confirmed=0,createdByAdd=null;
 const mods=[mk('mod-coc',coc),mk('mod-brp',brp)],records=[{id:'old-coc',moduleId:'mod-coc',moduleName:'同名模组'},...(brpAlready?[{id:'old-brp',moduleId:'mod-brp',moduleName:'同名模组'}]:[])];
 const ctx=context({
  els:{newModuleName:{value:'同名模组'}},runRecords:records,modules:mods,selectedModuleName:'',newModuleSuggestionSelectedId:'',
  shareModeBlock:()=>false,passActionGate:()=>true,normalizedEntityNameKey:s=>String(s||'').trim().toLowerCase(),
  selectedNewModuleSuggestion:()=>selected?mods[1]:null,modulesByNormalizedName:()=>mods,moduleById:id=>mods.find(m=>m.id===id),
  exactSearchFieldMatch:(a,b)=>a===b,recordModuleOptionLabel:m=>m.name,newRunRuleFromModule:m=>({...m.ruleMeta,source:'module-inherited'}),appSelect:async()=>{confirmed++;return 'mod-brp';},
  addTableToModule:(name,options)=>{createdByAdd={name,options};return 'new-desk';},
  normalizeRunRecord:x=>x,uid:()=>`new-${records.length}`,saveState:()=>true,closeNewModuleSuggestions:()=>{},
  moduleFrameDirty:false,mobileMedia:{matches:false},recordEditingIds:new Set(),setRunRecordCollapsed:()=>{},
  renderRunRecords:()=>{},scrollRecordCardIntoView:()=>{},renderNativeModules:()=>{},renderProfiles:()=>{},setPlanUndo:()=>{},showToast:()=>{},
  appConfirm:async()=>true,normalizeRichModule:x=>x,settings:{moduleArchive:{}},clone:x=>structuredClone(x),
  },between('async function createFirstRunRecord() {','function addTableToModule(moduleName'));
 return {ctx,mods,records,stats:()=>({createdByAdd,confirmed})};
}
test('the first-record entry selects the actual BRP ID instead of a same-title old CoC desk',async()=>{
 const {ctx,records,stats}=recordContext();await ctx.createFirstRunRecord();
 assert.equal(stats().confirmed,1);assert.equal(records.length,2);assert.equal(records[1].moduleId,'mod-brp');
 assert.equal(records[1].ruleMeta.systemId,'brp-generic');
});
test('an existing BRP desk is reused only after the same stable ID was confirmed',async()=>{
 for(const selected of [false,true]){
  const {ctx,records,stats}=recordContext({brpAlready:true,selected});
  await ctx.createFirstRunRecord();
  assert.equal(stats().createdByAdd?.options.moduleId,'mod-brp');assert.equal(records.length,2);
  assert.equal(stats().confirmed,selected?0:1);
 }
});
test('an expired selected module ID cannot fall back to a different same-title archive',()=>{
 const code=between('function addTableToModule(moduleName, options = {}) {','async function renameModule(moduleName)');
 const mods=[mk('mod-brp',brp)];const records=[];let notices=[];
 const ctx=context({
  passActionGate:()=>true,normalizedEntityNameKey:s=>String(s||'').trim().toLowerCase(),moduleById:id=>mods.find(m=>m.id===id),
  modulesByNormalizedName:()=>mods,runRecords:records,appNotice:(...args)=>notices.push(args),
 },code);
 assert.equal(ctx.addTableToModule('同名模组',{moduleId:'deleted-coc'}),false);
 assert.equal(records.length,0);assert.equal(notices.length,1);
});
test('the plan-created module inherits a saved BRP rule and does not assign a rule to an old unrecorded desk',()=>{
 for(const original of [brp,null]){
  let plan={id:'p',moduleId:'',moduleName:'',ruleMeta:original&&{...original}},mods=[];
  const ctx=context({
   runPlans:[plan],modules:mods,planInputPending:null,
   els:{planEditorContent:{querySelector:()=>({querySelector:()=>({value:'新模组'})})}},
   CSS:{escape:x=>x},uid:()=>`created-${mods.length}`,clone:x=>structuredClone(x),
   modulesByNormalizedName:()=>[],normalizeRunRuleSnapshot:x=>x?{...x}:null,normalizeRichModule:x=>({...x,ruleMeta:x.ruleMeta||coc}),settings:{moduleArchive:{}},
   saveState:()=>true,renderNativeModules:()=>{},renderRunPlans:()=>{},renderPlanEditor:()=>{},
   editingPlanId:'',moduleFrameDirty:false,transientPlanIds:new Set(),setPlanUndo:()=>{},showToast:()=>{},
   },between('function createAndLinkModuleForPlan(planId) {','function renderPlanEditor()'));
  assert.equal(ctx.createAndLinkModuleForPlan('p'),true);
  assert.equal(mods.length,1);
  assert.equal(mods[0].ruleMeta.systemId,original?.systemId||'coc');
  assert.equal(plan.ruleMeta?.systemId||null,original?.systemId||null);
 }
});
test('want/can-host existing module selection and removal use ID even when the titles are identical',()=>{
 const mods=[mk('c',coc),mk('b',brp)],intro={pl:{wantModules:[{moduleId:'c',name:'同名模组',note:'Coc备注'}]},kp:{canHostModules:[]}};
 const ctx=context({
  modules:mods,selfIntroDraft:intro,selfIntroPendingModules:[],
  ensureSelfIntroDraft:()=>{},selfIntroIntentRows:()=>intro.pl.wantModules,
  selfIntroPathGet:(data,p)=>p==='pl.wantModules'?data.pl.wantModules:data.kp.canHostModules,
  selfIntroPathSet:(data,p,v)=>{if(p==='pl.wantModules')data.pl.wantModules=v;else data.kp.canHostModules=v;},
  normalizedEntityNameKey:x=>String(x||'').trim().toLowerCase(),modulesByNormalizedName:name=>mods.filter(m=>m.name===name),
  searchTextMatches:()=>true,ruleSearchTerms:()=>[],profilePickerNameCollator:{compare:(a,b)=>a.localeCompare(b)},
  bestSearchFieldRank:()=>0,moduleById:id=>mods.find(m=>m.id===id),showToast:()=>{},
  els:{selfIntroView:null},CSS:{escape:x=>x},queueSelfIntroSave:()=>{},
  refreshSelfIntroIntentCards:()=>{},updateSelfIntroModuleSuggestions:()=>{},requestAnimationFrame:()=>{},
  },between('function selfIntroIntentPath(kind) {','function selfIntroModuleSuggestionsHTML(')+'\n'+between('function selectSelfIntroExistingModule(kind, moduleId) {','async function addSelfIntroModuleIntent(')+'\n'+between('function removeSelfIntroModuleIntent(kind, moduleId, moduleName) {','function selfIntroSearchText()'));
 assert.deepEqual(Array.from(ctx.selfIntroIntentExistingMatches('want',''),m=>m.id),['b']);
 ctx.selectSelfIntroExistingModule('want','b');assert.equal(intro.pl.wantModules.length,2);
 ctx.updateSelfIntroModuleIntentNote('want','b','同名模组','BRP备注');
 assert.equal(intro.pl.wantModules[0].note,'Coc备注');assert.equal(intro.pl.wantModules[1].note,'BRP备注');
 ctx.removeSelfIntroModuleIntent('want','c','同名模组');
 assert.deepEqual(intro.pl.wantModules.map(x=>x.moduleId),['b']);
});
test('pending modules are merged only into the same rule; different-rule same-title modules survive saving',()=>{
 const mods=[mk('existing-brp',brp)],pending=mk('pending-coc',coc),intro={pl:{wantModules:[{moduleId:pending.id,name:pending.name}]},kp:{canHostModules:[]}};
 const profile={id:'self',selfIntro:null};
 const ctx=context({
  modules:mods,profiles:[profile],selfIntroDraft:intro,selfIntroBaseline:null,selfIntroPendingModules:[pending],selfIntroSaveTimer:null,
  selfIntroDirty:()=>true,selfProfileFrom:()=>profile,clearTimeout:()=>{},updateSelfIntroSaveState:()=>{},
  clone:x=>structuredClone(x),modulesByNormalizedName:name=>mods.filter(x=>x.name===name),normalizeRichModule:x=>x,
  selfIntroPathGet:(data,p)=>p==='pl.wantModules'?data.pl.wantModules:data.kp.canHostModules,
  reconcileSelfIntroIntentRefs:()=>{},normalizeSelfIntro:x=>x,saveState:()=>true,settings:{moduleArchive:{}},
  refreshSelfIntroIntentCards:()=>{},console:{error:()=>{}},
  },between('function commitSelfIntroDraft() {','function selfIntroIntentPath(kind)'));
 assert.equal(ctx.commitSelfIntroDraft(),true);
 assert.deepEqual(mods.map(x=>x.id),['existing-brp','pending-coc']);
 assert.equal(profile.selfIntro.pl.wantModules[0].moduleId,'pending-coc');
});
test('version, CI and storage contracts move together without changing existing schema',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.ok(/^8\.1\.12\.\d+$/.test(version));
 assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/CACHE_PREFIX\}v([\d.]+)`/)?.[1],version);
 assert.equal(html.split(`<strong class="version-log-version">v${version}</strong>`).length-1,1);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
 assert.match(fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8'),/round153-multirule-crossview-id\.test\.cjs/);
});
