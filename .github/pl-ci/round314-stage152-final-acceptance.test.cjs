'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),relation=require(path.join(root,'relation-index.js'));
const cut=(from,to)=>{const a=html.indexOf(from);assert.notEqual(a,-1,'start '+from);const b=html.indexOf(to,a+from.length);assert.ok(b>a,'end '+to);return html.slice(a,b);};
const navigator=cut('function globalSearchTargetExists(action) {','/* 设置搜索 */');
function env({share=false, editorReject=false, records=[]}={}){
 const calls=[],spotlights=[],ui={};let filter='my-pl',search='long-tail';const searchDialog={hidden:true};
 const make=()=>({dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},innerHTML:'',scrollIntoView(){calls.push('scroll-card')},remove(){calls.push('remove-card')}});
 for(const view of ['profiles','pcs','modules','plans','records'])ui[view+'View']={prepend(node){spotlights.push(node)}};
 const ctx={globalSearchRows:[],profiles:[{id:'p1',name:'Alias'}],pcs:[{id:'c1',name:'Role'}],modules:[{id:'m1',name:'Mod'}],runPlans:[{id:'plan1',moduleName:'Mod'}],runRecords:records.length?records:[{id:'r1',moduleName:'Mod'}],els:ui,shareModeEnabled:share,
   profileListMode:'',isBlacklistedProfile:()=>false,
   document:{querySelectorAll:()=>[],addEventListener(){},createElement:make,getElementById:id=>id==='globalSearchBackdrop'?searchDialog:null},syncModalPageScrollLock:()=>calls.push('scroll-lock'),CSS:{escape:x=>x},
   escapeHTML:s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),
   switchView:(v,opt)=>{calls.push(`view:${v}`);assert.equal(opt.restoreScroll,false)},
   closeGlobalSearch:()=>calls.push('close'),renderGlobalSearch:()=>calls.push('rerender'),showToast:x=>calls.push('toast:'+x),
   openEditor:(id)=>{calls.push('pl:'+id);return true},openPcEditor:(id)=>{calls.push('pc:'+id);return editorReject?false:undefined},
   openNativeModuleEditor:(id)=>{calls.push('mod:'+id);return true},openPlanEditor:(id)=>{calls.push('plan:'+id);return true},
   setRunRecordCollapsed:(id)=>calls.push('uncollapse:'+id),recordDetailReveal:(id)=>{calls.push('reveal:'+id);return true},scrollRecordCardIntoView:id=>calls.push('record-scroll:'+id),requestAnimationFrame:fn=>fn()
 };
 vm.createContext(ctx);vm.runInContext(navigator,ctx);
 return {ctx,calls,spotlights,searchDialog,filter:()=>filter,search:()=>search};
}
test('PC 搜索：编辑器拒绝打开不得误报成功',()=>{
 const x=env({editorReject:true});x.ctx.globalSearchRows=[{action:{view:'pcs',id:'c1'}}];
 assert.equal(x.ctx.activateGlobalSearchResult(0),false);assert.ok(x.calls.includes('pc:c1'));
 assert.equal(x.filter(),'my-pl');assert.equal(x.search(),'long-tail');assert.equal(x.searchDialog.hidden,false);
 assert.ok(x.calls.includes('scroll-lock'));
});
test('PC 搜索：编辑器正常返回 undefined 仍被识别为成功',()=>{
 const x=env();x.ctx.globalSearchRows=[{action:{view:'pcs',id:'c1'}}];
 assert.equal(x.ctx.activateGlobalSearchResult(0),true);assert.ok(x.calls.includes('pc:c1'));
});
test('五类实体定位：稳定 ID、关闭搜索、原筛选不变',()=>{
 for(const [view,id,required] of [['profiles','p1','pl:p1'],['pcs','c1','pc:c1'],['modules','m1','mod:m1'],['plans','plan1','plan:plan1'],['records','r1','reveal:r1']]){
  const x=env();x.ctx.globalSearchRows=[{action:{view,id}}];assert.equal(x.ctx.activateGlobalSearchResult(0),true,view);
  assert.ok(x.calls.includes(required),view);assert.equal(x.filter(),'my-pl');assert.equal(x.search(),'long-tail');
 }
});
test('已删除目标不会打开编辑器，保留搜索层',()=>{
 const x=env();x.ctx.globalSearchRows=[{action:{view:'modules',id:'deleted'}}];
 assert.equal(x.ctx.activateGlobalSearchResult(0),false);assert.ok(x.calls.includes('rerender'));
 assert.equal(x.calls.includes('close'),false);
});
test('分享模式只显示公开标题、保留搜索及页面筛选，不进入编辑器',()=>{
 const x=env({share:true});x.ctx.globalSearchRows=[{title:'<Alias>',type:'PL',action:{view:'profiles',id:'p1'}}];
 assert.equal(x.ctx.activateGlobalSearchResult(0),true);assert.equal(x.spotlights.length,1);
 assert.match(x.spotlights[0].innerHTML,/&lt;Alias&gt;/);assert.equal(x.calls.some(c=>/^(pl:|pc:|mod:|plan:)/.test(c)),false);
 assert.equal(x.filter(),'my-pl');
});
test('只有名称、历史名称、明确 ID 三态不交叉修改',()=>{
 const index=relation.build({profiles:[],pcs:[],modules:[{id:'m1',name:'Case'},{id:'m2',name:'Second'}],plans:[{id:'p1',moduleId:'',moduleName:'Case',moduleLinkMode:'name-only'},{id:'p2',moduleId:'',moduleName:'Case'},{id:'p3',moduleId:'m2',moduleName:'Case'}],records:[]});
 assert.equal(index.resolveModule({moduleId:'',moduleName:'Case',moduleLinkMode:'name-only'}).status,'name-only');
 assert.equal(index.resolveModule({moduleId:'',moduleName:'Case'}).status,'legacy-unique');
 assert.equal(index.resolveModule({moduleId:'m2',moduleName:'Case'}).id,'m2');
 assert.deepEqual([...index.modulePlans('m1')],['p2']);assert.deepEqual([...index.modulePlans('m2')],['p3']);
});
test('历史重复名称不得自动选择某一个规则档案',()=>{
 const index=relation.build({profiles:[],pcs:[],modules:[{id:'m1',name:'Same',ruleMeta:{systemId:'coc'}},{id:'m2',name:'Same',ruleMeta:{systemId:'dnd'}}],plans:[{id:'p1',moduleName:'Same'}],records:[]});
 assert.equal(index.resolveModule({moduleName:'Same'}).status,'ambiguous');
 assert.deepEqual([...index.modulePlans('m1')],[]);assert.deepEqual([...index.modulePlans('m2')],[]);
});
test('分享模式原始检索函数排除私人联系方式、备注和 Log',()=>{
 const snippet=cut('function buildGlobalSearchRows(q) {','function renderGlobalSearch()');
 const secret=['phone-secret-x88','remarks-secret-y77','log-secret-z66'];
 const ctx={shareModeEnabled:true,profiles:[{id:'p1',name:'Public Alias',contact:secret[0],profileRemark:secret[1]}],pcs:[],modules:[],runPlans:[],runRecords:[{id:'r1',moduleName:'Public Module',logUrl:secret[2]}],isBlacklistedProfile:()=>false,
  displayProfileName:p=>p.name,normalizedEntityNameKey:s=>String(s||'').toLowerCase(),searchFieldRank:(s,q)=>String(s||'').toLowerCase().includes(q)?0:99,profilePickerNameCollator:new Intl.Collator('zh-CN')};
 vm.createContext(ctx);vm.runInContext(snippet,ctx);
 for(const q of secret)assert.equal(ctx.buildGlobalSearchRows(q).length,0,q);
 assert.equal(ctx.buildGlobalSearchRows('public').length,2);
});
test('保存规范化不得将仅本桌名称写成模组 ID',()=>{
 const start=html.indexOf('function buildCanonicalCollections()'),end=html.indexOf('    const all = [...runRecords, ...runPlans];',start);assert.ok(start>=0&&end>start);
 const snippet=html.slice(start,end)+'    return {runPlans,runRecords};\n}';
 const ctx={settings:{moduleArchive:{}},modules:[{id:'m1',name:'Case'}],runPlans:[{id:'p1',moduleName:'Case',moduleId:'',moduleLinkMode:'name-only'},{id:'p2',moduleName:'Case',moduleId:''}],runRecords:[],normalizeRichModule:m=>m,normalizedEntityNameKey:s=>String(s||'').toLowerCase()};
 vm.createContext(ctx);vm.runInContext(snippet+'\nvar result=buildCanonicalCollections();',ctx);
 assert.equal(ctx.result.runPlans[0].moduleId,'');assert.equal(ctx.result.runPlans[0].moduleLinkMode,'name-only');assert.equal(ctx.result.runPlans[1].moduleId,'');
});
