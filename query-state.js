/* PL收集梦想生活 · 版本化查询状态 v0.2.0。纯函数，无持久化副作用。 */
(function(root,factory){
 'use strict';const api=factory(typeof module==='object'&&module.exports?require('./query-core.js'):root.PLQueryCore);
 if(typeof module==='object'&&module.exports)module.exports=api;else if(root)root.PLQueryState=api;
})(typeof globalThis==='object'?globalThis:null,function(core){
 'use strict';if(!core)throw new Error('必须先加载查询核心');
 const VERSION=2,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),pages=['profiles','pcs','modules','plans','records','moduleTools'];
 const freeze=Object.freeze;
 const DEFAULT_SORT=freeze({pcs:freeze({field:'updatedAt',direction:'desc'}),modules:freeze({field:'updatedAt',direction:'desc'}),moduleTools:freeze({field:'updatedAt',direction:'desc'})});
 function plain(o){return Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null))}
 function safeField(s){return typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s)}
 function validScalar(v){return typeof v==='string'&&v.length<=256||typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'}
 function clauseCopy(raw){
  if(!plain(raw)||!['eq','contains','in','notIn','exists','range','dateRange','overlap'].includes(raw.op))throw new TypeError('筛选条件无效');
  const op=raw.op;
  if(op==='in'||op==='notIn'){
   if(!Array.isArray(raw.values)||raw.values.length>100||raw.values.some(v=>!validScalar(v)))throw new TypeError('筛选多选值无效');
   return freeze({op,values:freeze([...raw.values])});
  }
  if(op==='exists')return freeze({op,value:raw.value!==false});
  if(op==='range'||op==='dateRange'||op==='overlap'){
   const check=v=>v==null||v===''||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=50;
   if(!check(raw.min)||!check(raw.max))throw new TypeError('区间值无效');
   if(op==='dateRange'&&[raw.min,raw.max].some(v=>v!=null&&v!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(String(v))))throw new TypeError('日期格式必须为 YYYY-MM-DD');
   const min=raw.min??'',max=raw.max??'';
   if(min!==''&&max!==''&&String(min)>String(max)&&op==='dateRange')throw new RangeError('日期起止颠倒');
   if(op!=='dateRange'&&min!==''&&max!==''&&Number(min)>Number(max))throw new RangeError('数值区间起止颠倒');
   return freeze({op,min,max});
  }
  if(!validScalar(raw.value))throw new TypeError('筛选值无效');
  return freeze({op,value:raw.value});
 }
 function empty(page,defaultSort){if(!pages.includes(page))throw new Error('未知查询页面');return freeze({version:VERSION,page,search:'',filters:freeze({}),sort:freeze(defaultSort||DEFAULT_SORT[page]||{field:'relevance',direction:'asc'})})}
 function normalize(raw,page,schema,{unknown='preserve'}={}){
  if(!pages.includes(page)||!schema?.fields)throw new TypeError('页面或字段 schema 无效');
  if(raw==null)return freeze({query:empty(page),unresolved:freeze([])});
  if(!plain(raw))throw new TypeError('查询状态应为对象');
  const source=raw.query&&plain(raw.query)?raw.query:raw;
  if(source.version!=null&&source.version!==VERSION&&source.version!==1)throw new Error('未知查询状态版本：'+String(source.version));
  if(source.page!=null&&source.page!==page)throw new Error('查询页面不匹配');
  const search=String(source.search==null?'':source.search);
  if(search.length>300)throw new RangeError('搜索词过长');
  if(source.filters!=null&&!plain(source.filters))throw new TypeError('筛选集合无效');
  const filters={},unresolved=[];
  for(const [field,clause] of Object.entries(source.filters||{})){
   if(!safeField(field))throw new Error('危险字段标识');
   const c=clauseCopy(clause);
   if(!own(schema.fields,field)){
    if(unknown==='reject')throw new Error('未知筛选字段：'+field);
    unresolved.push(freeze({field,reason:'field-removed',clause:c}));continue;
   }
   Object.defineProperty(filters,field,{value:c,enumerable:true,writable:false,configurable:false});
  }
  const s=source.sort&&plain(source.sort)?source.sort:(DEFAULT_SORT[page]||{field:'relevance',direction:'asc'});
  if(typeof s.field!=='string'||!safeField(s.field)||!['asc','desc'].includes(s.direction))throw new Error('排序规则无效');
  let sort=freeze({field:s.field,direction:s.direction});
  if(sort.field!=='relevance'&&!own(schema.fields,sort.field)){
   unresolved.push(freeze({field:sort.field,reason:'sort-removed'}));sort=freeze({field:'relevance',direction:'asc'});
  }
  return freeze({query:freeze({version:VERSION,page,search,filters:freeze(filters),sort}),unresolved:freeze(unresolved)});
 }
 function reduce(query,action,schema){
  if(!plain(action))throw new TypeError('查询操作无效');
  const prev=normalize(query,query.page,schema,{unknown:'reject'}).query;
  let next=prev;
  if(action.type==='search')next={...prev,search:String(action.value??'')};
  else if(action.type==='filter'){
   if(!safeField(action.field)||!own(schema.fields,action.field))throw new Error('筛选字段未注册');
   next={...prev,filters:{...prev.filters,[action.field]:clauseCopy(action.clause)}};
  }else if(action.type==='clear-filter'){
   if(!safeField(action.field))throw new Error('筛选字段无效');
   const filters={...prev.filters};delete filters[action.field];next={...prev,filters};
  }else if(action.type==='clear-filters')next={...prev,filters:{}};
  else if(action.type==='reset-query')next={...prev,search:'',filters:{}};
  else if(action.type==='sort')next={...prev,sort:action.sort};
  else throw new Error('未知查询操作：'+String(action.type));
  return normalize(next,prev.page,schema,{unknown:'reject'}).query;
 }
 function serialize(query,schema){const normalized=normalize(query,query.page,schema,{unknown:'reject'}).query;return JSON.stringify(normalized)}
 function deserialize(text,page,schema){if(typeof text!=='string'||text.length>32768)throw new Error('查询状态文本无效');return normalize(JSON.parse(text),page,schema)}
 function legacyPcState(legacy,schema){
  if(!plain(legacy))throw new TypeError('旧版 PC 筛选状态无效');
  const filters={};const set=(f,v)=>{if(v)filters[f]={op:'eq',value:String(v)}};
  if(legacy.owner==='__unlinked__')set('ownerState','unlinked');else set('ownerId',legacy.owner);
  set('status',legacy.status);set('relation',legacy.relation);
  // 老版关系 linked 以任何计划/记录为准，新版字段仍应由关系计数明确计算。
  set('moduleKeys',legacy.module);set('tags',legacy.tag);set('ruleFamilyId',legacy.ruleFamily);set('ruleSystemId',legacy.ruleSystem);set('ruleEditionId',legacy.ruleEdition);
  const sortMap={name:{field:'name',direction:'asc'},runs:{field:'totalCount',direction:'desc'},recent:{field:'latestDate',direction:'desc'},updated:{field:'updatedAt',direction:'desc'}};
  return normalize({search:legacy.search||'',filters,sort:sortMap[legacy.sort]||sortMap.updated},'pcs',schema);
 }
 function createSession(initial,page,schema){
  let applied=normalize(initial,page,schema).query,draft=null;
  return freeze({
   applied:()=>applied,draft:()=>draft,begin:()=>{draft=normalize(applied,page,schema).query;return draft},
   dispatch:action=>{applied=reduce(applied,action,schema);return applied},
   edit:action=>{if(!draft)throw new Error('尚未打开筛选草稿');draft=reduce(draft,action,schema);return draft},
   apply:()=>{if(!draft)throw new Error('没有可应用的草稿');applied=draft;draft=null;return applied},
   cancel:()=>{draft=null;return applied},
   restore:raw=>{const result=normalize(raw,page,schema);applied=result.query;draft=null;return result}
  });
 }
 return freeze({VERSION,empty,normalize,reduce,serialize,deserialize,legacyPcState,createSession,version:'0.2.0'});
});
