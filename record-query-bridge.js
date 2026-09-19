/* PL收集梦想生活 · 跑团记录查询桥接层 v0.7.0。纯计算；原始桌次只读。 */
(function(root,factory){'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./query-state.js'):root.PLQueryState,node?require('./field-adapters.js'):root.PLFieldAdapters);
 if(node)module.exports=api;else if(root)root.PLRecordQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engine,state,adapters){
 'use strict';if(!engine||!state||!adapters)throw new Error('跑团记录查询依赖缺失');
 const str=x=>String(x==null?'':x).trim(),list=x=>Array.isArray(x)?x:[];
 const roles=['all','pl','kp','other'],logs=['','has','none','multi'],dates=['','complete','partial','undated'],assignments=['','pc','ho','missing'];
 const sorts=['default','start_desc','start_asc','end_desc','end_asc','created_desc','created_asc','updated_desc','updated_asc'];
 function signature(data,selfId){
  // Per-record content must participate: auto-save edits may not update updatedAt.
  let h=2166136261;const add=v=>{for(const c of String(v??''))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0};add(selfId);
  // Only include fields needed by record projection and relation diagnostics.
  // PC original Excel attachments can be very large; never hash them on every search keystroke.
  const fields={
   profiles:p=>[p?.id,p?.name,p?.displayName],
   modules:m=>[m?.id,m?.name,m?.title],
   pcs:p=>[p?.id,p?.ownerPlId],
   plans:p=>[p?.id,p?.moduleId,p?.moduleName,p?.kpProfileId,p?.plIds,
     list(p?.participantAssignments).map(a=>[a?.plId,a?.pcId,a?.pcName]),p?.kpc?.enabled,p?.kpc?.pcId]
  };
  for(const type of ['records','profiles','modules','pcs','plans']){
   const rows=list(data[type]);add(type);add(rows.length);
   for(const r of rows)add(JSON.stringify(type==='records'?r:fields[type](r)));
  }return h.toString(16);
 }
 function legacyState(legacy={}){
  if(!roles.includes(str(legacy.role)||'all')||!logs.includes(str(legacy.log))||!dates.includes(str(legacy.date))||!assignments.includes(str(legacy.assignment))||!sorts.includes(str(legacy.sort)||'default'))throw new Error('未知跑团记录筛选或排序选项');
  const filters={},eq=(field,value)=>{if(value!==''&&value!=null)filters[field]={op:'eq',value}};
  if(legacy.role&&legacy.role!=='all')eq('roleFlags',str(legacy.role));
  if(legacy.log==='has')filters.logCount={op:'range',min:1,max:''};
  if(legacy.log==='none')eq('logCount',0);
  if(legacy.log==='multi')filters.logCount={op:'range',min:2,max:''};
  eq('dateState',str(legacy.date));
  if(legacy.assignment==='pc')eq('pcFlags','has');
  if(legacy.assignment==='missing')eq('pcFlags','missing');
  if(legacy.assignment==='ho')eq('hoState','has');
  const mode=str(legacy.sort)||'default';
  const field=mode==='default'?'relevance':({start:'startDate',end:'endDate',created:'createdAt',updated:'updatedAt'})[mode.split('_')[0]];
  const direction=mode==='default'?'asc':mode.endsWith('_asc')?'asc':'desc';
  const normalized=state.normalize({search:str(legacy.search),filters,sort:{field,direction}},'records',adapters.schemas.records,{unknown:'reject'});
  if(normalized.unresolved.length)throw new Error('跑团记录筛选字段无法识别');return normalized.query;
 }
 function create({searchIndexer}={}){
  let svc=null,previous='',revision=0,builds=0;
  function query({data={},legacy={},selfId='',now,settings={}}={}){
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str(now)))throw new Error('跑团记录查询需要明确本地时间');
   const sig=signature(data,selfId);
   if(!svc){svc=engine.create({data,selfId,now,settings,revision:++revision,searchIndexer});previous=sig;builds++;}
   else if(sig!==previous){svc.replaceData(data,++revision,{selfId,now,settings});previous=sig;builds++;}
   svc.restore('records',legacyState(legacy));const result=svc.execute('records');
   const raw=new Map(list(data.records).map(r=>[str(r.id),r]));const projected=new Map(svc.snapshot('records').map(r=>[r.id,r]));
   const original=result.ids.map(id=>raw.get(id));if(original.some(r=>!r))throw new Error('跑团记录 ID 回映射失败');
   const idSet=new Set(result.ids);const counts={};for(const id of result.ids){const p=projected.get(id);counts[p.dateState]=(counts[p.dateState]||0)+1;}
   return Object.freeze({ids:Object.freeze([...result.ids]),idSet,rawRows:Object.freeze(original),count:result.ids.length,total:result.total,counts:Object.freeze(counts),query:svc.query('records'),diagnostics:svc.diagnostics(),revision:svc.revision()});
  }
  return Object.freeze({query,invalidate:()=>{previous=''},buildCount:()=>builds,revision:()=>revision});
 }
 return Object.freeze({create,legacyState,signature,version:'0.7.0'});
});
