/* PL收集梦想生活 · 个人统计查询桥接 v0.8.1 · 全部统计基于同一归档桌次集合。 */
(function(root,factory){'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./field-adapters.js'):root.PLFieldAdapters,node?require('./query-state.js'):root.PLQueryState);
 if(node)module.exports=api;else if(root)root.PLStatsQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engine,adapters,state){
 'use strict';if(!engine||!adapters||!state)throw new Error('个人统计查询依赖缺失');
 const text=x=>String(x==null?'':x).trim(),array=x=>Array.isArray(x)?x:[];
 const isDate=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text(s));if(!m)return false;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);if(y<1||mo<1||mo>12||d<1)return false;
  const leap=y%4===0&&(y%100!==0||y%400===0);
  return d<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];};
 function resolveBounds({range='all',start='',end='',now}={}){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text(now)))throw new Error('统计查询需要本地时间');
  if(!['all','year','12m','custom'].includes(range))throw new Error('统计范围无效');
  const date=now.slice(0,10),year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
  if(range==='year')return Object.freeze({start:`${year}-01-01`,end:`${year}-12-31`});
  if(range==='12m'){
   const d=new Date(year,month-12,1);const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
   return Object.freeze({start:s,end:date});
  }
  if(range==='all')return Object.freeze({start:'',end:''});
  if(start&&!isDate(start)||end&&!isDate(end)||start&&end&&start>end)throw new Error('自定义日期范围无效');
  return Object.freeze({start:text(start),end:text(end)});
 }
 function signature(data,selfId){
  // Only fields that can affect statistical membership or relation projections;
  // PC original workbooks and image payloads must never be traversed for search input.
  let h=2166136261;const add=value=>{for(const c of String(value??''))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0};add(selfId);
  for(const type of ['records','profiles','modules','pcs','plans']){
   const rows=array(data[type]);add(type);add(rows.length);
   for(const r of rows){
    const v=type==='records'?[r.id,r.moduleId,r.moduleName,r.tableName,r.kpProfileId,r.kp,r.plIds,r.participantAssignments,r.kpc,r.startDate,r.endDate,r.sessionSlots,r.logEntries,r.logUrls,r.logUrl,r.logLabels]:
      type==='profiles'?[r.id,r.name,r.displayName,r.publicName]:type==='modules'?[r.id,r.name,r.title]:
      type==='pcs'?[r.id,r.ownerPlId]:[r.id,r.moduleId,r.moduleName,r.kpProfileId,r.plIds,r.participantAssignments,r.kpc,r.timeSlots];
    add(JSON.stringify(v));
   }
  }return h.toString(16);
 }
 function create({searchIndexer}={}){
  let svc=null,previous='',revision=0,builds=0;
  function query({data={},selfId='',now,settings={},range='all',start='',end='',role='all'}={}){
   if(!['all','kp','pl'].includes(role))throw new Error('统计身份无效');
   const bounds=resolveBounds({range,start,end,now}),sig=signature(data,selfId);
   if(!svc){svc=engine.create({data,selfId,now,settings,revision:++revision,searchIndexer});previous=sig;builds++;}
   else if(sig!==previous){svc.replaceData(data,++revision,{now,selfId,settings});previous=sig;builds++;}
   const filters={roleFlags:{op:'in',values:role==='all'?['kp','pl']:[role]}};
   if(bounds.start||bounds.end)filters.statDate={op:'dateRange',min:bounds.start,max:bounds.end};
   const normalized=state.normalize({search:'',filters,sort:{field:'statDate',direction:'asc'}},'records',adapters.schemas.records,{unknown:'reject'});
   if(normalized.unresolved.length)throw new Error('统计查询条件无法识别');
   svc.restore('records',normalized.query);
   const result=svc.execute('records');const raw=new Map(array(data.records).map(r=>[text(r.id),r]));
   const rawRows=result.ids.map(id=>raw.get(id));if(rawRows.some(r=>!r))throw new Error('统计桌次编号无法回映射');
   const projections=new Map(svc.snapshot('records').map(r=>[r.id,r]));
   const kp=result.ids.filter(id=>projections.get(id).roleFlags.includes('kp')).length;
   const pl=result.ids.filter(id=>projections.get(id).roleFlags.includes('pl')).length;
   return Object.freeze({ids:Object.freeze([...result.ids]),rawRows:Object.freeze(rawRows),count:result.ids.length,total:array(data.records).length,
    personalTotal:svc.snapshot('records').filter(r=>r.roleFlags.some(x=>x==='kp'||x==='pl')).length,kpCount:kp,plCount:pl,
    bounds,role,revision:svc.revision(),diagnostics:svc.diagnostics()});
  }
  return Object.freeze({query,buildCount:()=>builds,invalidate:()=>{previous='';}});
 }
 return Object.freeze({create,resolveBounds,signature,version:'0.8.1'});
});
