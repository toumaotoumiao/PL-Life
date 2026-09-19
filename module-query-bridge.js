/* PL收集梦想生活 · 模组档案与高级工具共享查询桥接层 v0.5.0；零 DOM/网络/存储。 */
(function(root,factory){'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./query-core.js'):root.PLQueryCore,node?require('./query-state.js'):root.PLQueryState,node?require('./field-adapters.js'):root.PLFieldAdapters);
 if(node)module.exports=api;else if(root)root.PLModuleQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engineModule,core,state,adapters){
 'use strict';if(!engineModule||!core||!state||!adapters)throw new Error('模组查询依赖未完整加载');
 const str=v=>String(v==null?'':v).trim(),arr=v=>Array.isArray(v)?v:[];
 function signatureArchive(data,selfId,settings){
  let hash=2166136261;const add=x=>{for(const c of str(x))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;};
  add(selfId);add(JSON.stringify(settings?.moduleArchive?.ratingSystems||[]));
  for(const type of ['profiles','pcs','modules','plans','records']){
   const rows=arr(data[type]);add(type);add(rows.length);
   for(const row of rows){add(JSON.stringify(row));}
  }return hash.toString(16);
 }
 const timestamp=x=>{if(x==null||x==='')return null;const v=typeof x==='number'?x:Date.parse(str(x));return Number.isFinite(v)?v:null};
 const compareName=(a,b)=>String(a||'').localeCompare(String(b||''),'zh-CN',{numeric:true,sensitivity:'base'});
 function archiveState(legacy){
  const filters={},set=(key,value)=>{if(value)filters[key]={op:'eq',value:str(value)}};
  set('era',legacy.era);set('location',legacy.location);set('rated',legacy.rating==='rated'?'yes':legacy.rating==='unrated'?'no':'');
  if(legacy.ho&&legacy.ho!=='unset')set('hoSystem',legacy.ho);
  if(legacy.run==='has')filters.recordCount={op:'range',min:1,max:''};
  if(legacy.run==='none')filters.recordCount={op:'range',min:0,max:0};
  if(legacy.run==='kp')filters.kpCount={op:'range',min:1,max:''};
  if(legacy.run==='pl')filters.plCount={op:'range',min:1,max:''};
  const normalized=state.normalize({search:str(legacy.search),filters,sort:{field:'relevance',direction:'asc'}},'modules',adapters.schemas.modules,{unknown:'reject'});
  if(normalized.unresolved.length)throw new Error('模组筛选字段无法识别');return normalized.query;
 }
 function createArchive({searchIndexer}={}){
  let svc=null,prev='',revision=0,builds=0;
  function query({data={},legacy={},selfId='',now,settings={}}){
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str(now)))throw new Error('请传入本地时间');
   const sig=signatureArchive(data,selfId,settings);
   if(!svc){svc=engineModule.create({data,selfId,now,settings,revision:++revision,searchIndexer});prev=sig;builds++}
   else if(sig!==prev){svc.replaceData(data,++revision,{selfId,now,settings});prev=sig;builds++}
   svc.restore('modules',archiveState(legacy));
   const result=svc.execute('modules',{scope:row=>legacy.ho!=='unset'||!row.hoSystem});
   const raw=new Map(arr(data.modules).map(m=>[str(m.id),m]));
   const proj=new Map(svc.snapshot('modules').map(m=>[m.id,m]));
   let ids=[...result.ids];
   const field=str(legacy.sort||'updated'),asc=field.endsWith('_asc');
   const dateMap={updated:'updatedAt',created_asc:'createdAt',created_desc:'createdAt',updated_asc:'updatedAt',updated_desc:'updatedAt',first_run_asc:'firstRunDate',first_run_desc:'firstRunDate',last_run_asc:'lastRunDate',last_run_desc:'lastRunDate',plan_asc:'firstPlanDate',plan_desc:'lastPlanDate'};
   const dateKey=dateMap[field];
   const rank=id=>{if(!legacy.search)return 0;const p=proj.get(id);const q=core.normalize(legacy.search),name=core.normalize(p.name);return name===q?0:name.startsWith(q)?1:2};
   ids.sort((a,b)=>{
    const x=proj.get(a),y=proj.get(b);if(legacy.search){const r=rank(a)-rank(b);if(r)return r}
    let r=0;
    if(dateKey){const av=x[dateKey],bv=y[dateKey];r=av==null&&bv==null?0:av==null?1:bv==null?-1:asc?av-bv:bv-av}
    else if(field==='name')r=compareName(x.name,y.name);
    else if(field==='runs')r=y.recordCount-x.recordCount;
    else if(field==='rating'){const av=x.score,bv=y.score;r=av==null&&bv==null?0:av==null?1:bv==null?-1:bv-av}
    else r=(y.updatedAt??-Infinity)-(x.updatedAt??-Infinity);
    return r||compareName(x.name,y.name)||a.localeCompare(b);
   });
   const rawRows=ids.map(id=>raw.get(id));if(rawRows.some(x=>!x))throw new Error('模组结果 ID 无法回映射');
   const projected=ids.map(id=>proj.get(id));
   const summary=Object.freeze({runs:projected.reduce((n,p)=>n+p.recordCount,0),kp:projected.reduce((n,p)=>n+p.kpCount,0),pl:projected.reduce((n,p)=>n+p.plCount,0),hasHo:projected.filter(p=>p.hoSystem==='has').length,
    average:(()=>{const scores=projected.map(p=>p.score).filter(x=>x!==null);return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null})()});
   return Object.freeze({ids:Object.freeze(ids),rawRows:Object.freeze(rawRows),count:ids.length,total:result.total,summary,revision:svc.revision(),diagnostics:svc.diagnostics(),query:svc.query('modules')});
  }
  return Object.freeze({query,invalidate:()=>{prev='';},buildCount:()=>builds,revision:()=>revision});
 }
 function signatureTools(rows,settings){let hash=2166136261;const add=x=>{for(const c of str(x))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;};
  add(JSON.stringify(settings?.moduleArchive?.ratingSystems||[]));for(const r of arr(rows))add(JSON.stringify(r));return hash.toString(16)}
 function toolState(legacy){const filters={},set=(k,v,op='eq')=>{if(str(v))filters[k]={op,value:str(v)}};
  set('era',legacy.era);set('location',legacy.location);set('reKp',legacy.intent);
  if(legacy.ho&&legacy.ho!=='unset')set('hoSystem',legacy.ho);
  if(legacy.nature)set('nature',legacy.nature,'contains');
  if(legacy.runs!==undefined&&legacy.runs!==null&&legacy.runs!=='')filters.runCount={op:'eq',value:Number(legacy.runs)};
  if(legacy.players)filters.playersRange={op:'overlap',min:legacy.players.min,max:legacy.players.max===Infinity?'':legacy.players.max};
  if(legacy.duration)filters.durationRange={op:'overlap',min:legacy.duration.min,max:legacy.duration.max===Infinity?'':legacy.duration.max};
  if(legacy.role==='pl'||legacy.role==='both')filters.plCount={op:'range',min:1,max:''};
  if(legacy.role==='kp'||legacy.role==='both')filters.kpCount={op:'range',min:1,max:''};
  const normalized=state.normalize({search:str(legacy.search),filters,sort:{field:'relevance',direction:'asc'}},'moduleTools',adapters.schemas.moduleTools,{unknown:'reject'});
  if(normalized.unresolved.length)throw new Error('模组高级工具筛选字段无法识别');return normalized.query;
 }
 function createTools({searchIndexer,compare}={}){
  let svc=null,prev='',revision=0,builds=0;
  function query({rows=[],legacy={},now='2026-01-01T00:00',settings={}}){
   const known=new Set();for(const row of arr(rows)){const id=str(row?.id);if(!id||known.has(id))throw new Error('模组高级工具存在空 ID 或重复 ID：'+id);known.add(id)}
   const data={moduleTools:rows};const sig=signatureTools(rows,settings);
   if(!svc){svc=engineModule.create({data,revision:++revision,now,settings,searchIndexer});prev=sig;builds++}
   else if(sig!==prev){svc.replaceData(data,++revision,{now,settings});prev=sig;builds++}
   svc.restore('moduleTools',toolState(legacy));
   const result=svc.execute('moduleTools',{scope:p=>legacy.ho!=='unset'||!p.hoSystem});
   const original=new Map(arr(rows).map(r=>[str(r.id),r]));let output=result.ids.map(id=>original.get(id));
   if(output.some(v=>!v))throw new Error('模组高级工具 ID 回映射失败');
   // 排序方式由高级工具页面的业务比较器提供，筛选和搜索统一经过查询内核。
   if(typeof compare==='function')output=[...output].sort((a,b)=>compare(a,b,legacy.sort||'updated',legacy.direction||'desc')||str(a.id).localeCompare(str(b.id)));
   return Object.freeze({rawRows:Object.freeze(output),ids:Object.freeze(output.map(r=>str(r.id))),total:result.total,count:output.length,revision:svc.revision(),diagnostics:svc.diagnostics()});
  }
  return Object.freeze({query,invalidate:()=>{prev='';},buildCount:()=>builds});
 }
 return Object.freeze({createArchive,createTools,archiveState,toolState,signatureArchive,signatureTools,version:'0.5.0'});
});
