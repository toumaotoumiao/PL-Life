'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const segment=(a,b)=>{const x=html.indexOf(a);assert.ok(x>=0,a);const y=html.indexOf(b,x+a.length);assert.ok(y>x,b);return html.slice(x,y);};
const globalCode=segment('function globalSearchTargetExists(action) {','/* 设置搜索 */');
function createSearchHarness({share=false,results=[]}={}){
 const calls=[],state={},element={hidden:false},spotlights=[];
 const makeCard=()=>({dataset:{},className:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},innerHTML:'',scrollIntoView(){calls.push('spotlight-scroll');},remove(){calls.push('spotlight-remove');}});
 const root=()=>({prepend(card){spotlights.push(card);}});
 const els={profilesView:root(),pcsView:root(),modulesView:root(),plansView:root(),recordsView:root()};
 const profile={id:'pl-100',name:'Test Person'},pc={id:'pc-100',name:'Test PC'},mod={id:'mod-100',name:'Test Module'},plan={id:'plan-100',moduleName:'Test Module'},record={id:'rec-100',moduleName:'Test Module'};
 const s={globalSearchRows:results,shareModeEnabled:share,profiles:[profile],pcs:[pc],modules:[mod],runPlans:[plan],runRecords:[record],els,
  document:{querySelectorAll:()=>[],addEventListener(){},createElement:makeCard},CSS:{escape:x=>x},
  showToast:msg=>calls.push('toast:'+msg),renderGlobalSearch:()=>calls.push('render-search'),closeGlobalSearch:()=>calls.push('close-search'),
  switchView:(v,options)=>calls.push('view:'+v+':'+JSON.stringify(options)),openEditor:id=>{calls.push('open-pl:'+id);return true;},openPcEditor:id=>{calls.push('open-pc:'+id);return true;},
  openNativeModuleEditor:id=>{calls.push('open-module:'+id);return true;},openPlanEditor:id=>{calls.push('open-plan:'+id);return true;},
  setRunRecordCollapsed:(id,closed,remember)=>calls.push(`collapse:${id}:${closed}:${remember}`),recordDetailReveal:id=>{calls.push('reveal-record:'+id);return true;},scrollRecordCardIntoView:id=>calls.push('scroll-record:'+id),
  isBlacklistedProfile:()=>false,requestAnimationFrame:fn=>fn(),escapeHTML:str=>String(str).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
 };
 vm.createContext(s);vm.runInContext(globalCode,s);
 return {s,calls,spotlights};
}
for(const [view,id,call] of [['profiles','pl-100','open-pl:pl-100'],['pcs','pc-100','open-pc:pc-100'],['modules','mod-100','open-module:mod-100'],['plans','plan-100','open-plan:plan-100']]){
 test(`global search: ${view} opens exact id without changing old filters`,()=>{
  const x=createSearchHarness({results:[{action:{view,id}}]});
  assert.equal(x.s.activateGlobalSearchResult(0),true);
  assert.ok(x.calls.includes(call));assert.ok(x.calls.includes(`view:${view}:{"restoreScroll":false}`));
  assert.equal(x.calls.filter(c=>c==='close-search').length,1);
 });
}
test('global search: records use existing spotlight for filtered/paged result',()=>{
 const x=createSearchHarness({results:[{action:{view:'records',id:'rec-100'}}]});
 assert.equal(x.s.activateGlobalSearchResult(0),true);
 assert.deepEqual(x.calls.slice(-3),['collapse:rec-100:false:false','reveal-record:rec-100','scroll-record:rec-100']);
});
test('global search: missing exact id leaves search open and never opens an editor',()=>{
 const x=createSearchHarness({results:[{action:{view:'profiles',id:'pl-deleted'}}]});
 assert.equal(x.s.activateGlobalSearchResult(0),false);
 assert.deepEqual(x.calls.filter(c=>c.startsWith('open-')||c==='close-search'),[]);
 assert.ok(x.calls.includes('render-search'));
});
test('global search: share mode reveals only whitelisted title, never opens private editor',()=>{
 const x=createSearchHarness({share:true,results:[{type:'PL',title:'Public <alias>',action:{view:'profiles',id:'pl-100'}}]});
 assert.equal(x.s.activateGlobalSearchResult(0),true);
 assert.equal(x.calls.some(c=>c.startsWith('open-')),false);
 assert.equal(x.spotlights.length,1);
 assert.ok(x.spotlights[0].innerHTML.includes('Public &lt;alias&gt;'));
 assert.ok(!x.spotlights[0].innerHTML.includes('case-contact'));
});
test('global search: ordinary non-entity destinations remain navigable',()=>{
 const x=createSearchHarness({results:[{action:{view:'stats'}}]});
 assert.equal(x.s.activateGlobalSearchResult(0),true);
 assert.ok(x.calls.some(c=>c.startsWith('view:stats')));
});
test('global search: source no longer resets old query, owner, and rule filters before opening',()=>{
 const code=segment('function activateGlobalSearchResult(index) {','/* 设置搜索 */');
 for(const marker of ['els.search.value = ""','els.moduleNativeSearch.value = ""','els.pcSearch.value=""','renderPcArchive();','renderNativeModules();'])assert.ok(!code.includes(marker),marker);
 for(const marker of ['openEditor(String(action.id))','openPcEditor(String(action.id))','openNativeModuleEditor(String(action.id))','openPlanEditor(String(action.id))','recordDetailReveal(id)'])assert.ok(code.includes(marker),marker);
});
test('PC editor enforces share-mode read-only path, even when opened programmatically',()=>{
 assert.match(html,/function openPcEditor\(id="", ownerPlId=""\)\{\s*if\(shareModeBlock\("PC 编辑"\)\)return false;/);
});
test('record create-and-link checks live record snapshot after async confirmation',async()=>{
 const code=segment('async function createAndLinkModuleForRecord(','async function changeRecordModule(');
 let row={id:'rec-1',moduleName:'Example',moduleId:'',updatedAt:1},saves=0;
 const s={runRecords:[row],modules:[],normalizeRunRuleSnapshot:()=>({systemId:'co7'}),sameRuleNamedModules:()=>[],
  appConfirm:async()=>{row.updatedAt=2;return true;},showToast:()=>{},normalizeRichModule:x=>x,uid:()=> 'module-2',mutateRunRecord:()=>{saves++;return true;},renderNativeModules(){},renderProfiles(){},renderRunRecords(){},Date,
 };
 vm.createContext(s);vm.runInContext(code,s);
 assert.equal(await s.createAndLinkModuleForRecord('rec-1','Example'),false);
 assert.equal(s.modules.length,0);assert.equal(saves,0);
});
test('record create-and-link normal path saves only after confirmation and no racing edit',async()=>{
 const code=segment('async function createAndLinkModuleForRecord(','async function changeRecordModule(');
 const row={id:'rec-1',moduleName:'Example',moduleId:'',updatedAt:1};let saves=0;
 const s={runRecords:[row],modules:[],normalizeRunRuleSnapshot:()=>({systemId:'co7'}),sameRuleNamedModules:()=>[],
  appConfirm:async()=>true,showToast:()=>{},normalizeRichModule:x=>x,uid:()=> 'module-2',mutateRunRecord:(id,update)=>{saves++;update(row);return true;},renderNativeModules(){},renderProfiles(){},renderRunRecords(){},Date,settings:{moduleArchive:{}}
 };
 vm.createContext(s);vm.runInContext(code,s);
 assert.equal(await s.createAndLinkModuleForRecord('rec-1','Example'),true);
 assert.equal(s.modules.length,1);assert.equal(saves,1);assert.equal(row.moduleId,'module-2');
});
test('KP and PL creation block stale confirmation before adding a profile',async()=>{
 const snippets=[segment('async function createProfileAsKpFromRunPicker(','async function createAndAddProfileFromRunPicker('),segment('async function createAndAddProfileFromRunPicker(','function planPlPickerOptionsHTML(')];
 for(let i=0;i<snippets.length;i++){
  const row={id:'plan-1',plIds:[],updatedAt:1};let created=0;
  const s={runPlans:[row],runRecords:[],profiles:[],planPlPickerQuery:()=> 'Example',recordPlPickerQuery:()=> 'Example',
   exactProfileMatches:()=>[],shareModeBlock:()=>false,planKpChangeAllowed:()=>true,appConfirm:async()=>{row.updatedAt=3;return true;},
   makeBlankProfile:()=>{created++;return {id:'pl-x'};},showToast(){},flushPlanInputSave(){},planInputPending:null};
  vm.createContext(s);vm.runInContext(snippets[i],s);
  const fn=i===0?s.createProfileAsKpFromRunPicker:s.createAndAddProfileFromRunPicker;
  assert.equal(await fn('plan','plan-1','Example'),false);
  assert.equal(created,0);
 }
});
