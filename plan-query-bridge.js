/* PL收集梦想生活 · 计划查询桥接层 v0.6.0 · 只读，零 DOM/存储/网络。 */
(function(root,factory){'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./query-state.js'):root.PLQueryState,node?require('./field-adapters.js'):root.PLFieldAdapters);
 if(node)module.exports=api;else if(root)root.PLPlanQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engine,state,adapters){
 'use strict';if(!engine||!state||!adapters)throw new Error('计划查询依赖缺失');
 const str=x=>String(x==null?'':x).trim(),rows=x=>Array.isArray(x)?x:[];
 function signature(data,selfId,now){
  let hash=2166136261;const add=v=>{for(const c of String(v==null?'':v))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0};
  add(selfId);add(str(now).slice(0,13));
  for(const type of ['plans','profiles','modules']){
   const list=rows(data[type]);add(type);add(list.length);
   for(const row of list)add(JSON.stringify(row));
  }
  // relation-index 构建同时需要 records/pcs；变更 ID 后应重建诊断。
  for(const type of ['pcs','records']){const list=rows(data[type]);add(type);add(list.length);for(const row of list){add(row?.id);add(row?.updatedAt);}}
  return hash.toString(16);
 }
 function legacyState(legacy){
  for(const [key,allowed] of Object.entries({role:['','kp','pl','both','other'],schedule:['','scheduled','unscheduled','active','overdue'],people:['','solo','small','large']})){if(!allowed.includes(str(legacy[key])))throw new Error('未知计划筛选选项：'+key);}
  const filters={},set=(k,v)=>{if(str(v))filters[k]={op:'eq',value:str(v)}};
  set('role',legacy.role);
  if(legacy.schedule==='scheduled')set('scheduled','yes');
  else if(legacy.schedule==='unscheduled')set('scheduled','no');
  else if(['active','overdue'].includes(legacy.schedule))set('status',legacy.schedule);
  if(legacy.people==='solo')filters.participantCount={op:'range',min:0,max:1};
  else if(legacy.people==='small')filters.participantCount={op:'range',min:2,max:3};
  else if(legacy.people==='large')filters.participantCount={op:'range',min:4,max:''};
  const result=state.normalize({search:str(legacy.search),filters,sort:{field:'relevance',direction:'asc'}},'plans',adapters.schemas.plans,{unknown:'reject'});
  if(result.unresolved.length)throw new Error('计划筛选字段无法识别');return result.query;
 }
 function create({searchIndexer}={}){
  let svc=null,prev='',rev=0,builds=0;
  function query({data={},legacy={},selfId='',now,settings={}}){
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str(now)))throw new Error('计划查询需要本地时间');
   const sig=signature(data,selfId,now);
   if(!svc){svc=engine.create({data,selfId,now,settings,revision:++rev,searchIndexer});prev=sig;builds++;}
   else if(sig!==prev){svc.replaceData(data,rev+1,{selfId,now,settings});rev++;prev=sig;builds++;}
   svc.restore('plans',legacyState(legacy));const result=svc.execute('plans');
   const raw=new Map(rows(data.plans).map(p=>[str(p.id),p]));const projected=new Map(svc.snapshot('plans').map(p=>[p.id,p]));
   const output=result.ids.map(id=>raw.get(id));if(output.some(x=>!x))throw new Error('计划 ID 回映射失败');
   // 原始“进行中 → 下一场 → 待归档 → 未排期”业务顺序；关键词命中等级优先于该顺序。
   const order={active:0,upcoming:1,overdue:2,unscheduled:3};
   const rank=p=>{
    if(!str(legacy.search))return 0;
    const q=str(legacy.search).normalize('NFKC').toLowerCase();
    const t=str(p.tableName).normalize('NFKC').toLowerCase(),m=str(p.name).normalize('NFKC').toLowerCase();
    return t===q?0:m===q?1:t.includes(q)||m.includes(q)?2:3;
   };
   output.sort((a,b)=>{
    const x=projected.get(str(a.id)),y=projected.get(str(b.id));const ar=rank(x)-rank(y);if(ar)return ar;
    let delta=(order[x.status]??9)-(order[y.status]??9);if(delta)return delta;
    if(x.nextDate||y.nextDate){delta=!x.nextDate?1:!y.nextDate?-1:x.nextDate.localeCompare(y.nextDate);if(delta)return delta;delta=(x.nextPart??9)-(y.nextPart??9);if(delta)return delta;}
    delta=(y.updatedAt??0)-(x.updatedAt??0);return delta||str(a.id).localeCompare(str(b.id));
   });
   const ids=output.map(p=>str(p.id)),counts={};for(const p of output)counts[projected.get(str(p.id)).status]=(counts[projected.get(str(p.id)).status]||0)+1;
   return Object.freeze({ids:Object.freeze(ids),rawRows:Object.freeze(output),count:ids.length,total:result.total,counts:Object.freeze(counts),query:svc.query('plans'),diagnostics:svc.diagnostics(),revision:svc.revision()});
  }
  return Object.freeze({query,invalidate:()=>{prev='';},buildCount:()=>builds,revision:()=>rev});
 }
 return Object.freeze({create,legacyState,signature,version:'0.6.0'});
});
