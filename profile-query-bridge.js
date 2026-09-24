/* PL收集梦想生活 · PL 查询桥接层 v0.3.0：零 DOM/存储；按 ID 管理关系。 */
(function(root,factory){
 'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./query-state.js'):root.PLQueryState,node?require('./field-adapters.js'):root.PLFieldAdapters);
 if(node)module.exports=api;else if(root)root.PLProfileQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engineModule,state,adapters){
 'use strict';if(!engineModule||!state||!adapters)throw new Error('PL 查询依赖缺失');
 const str=v=>String(v==null?'':v).trim(),arr=v=>Array.isArray(v)?v:[];
 function signature(data,selfId,settings){
  let hash=2166136261;const add=x=>{for(const c of str(x))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;};
  add(selfId);add(JSON.stringify(arr(settings?.fields).map(f=>f.key)));
  for(const key of ['profiles','pcs','modules','plans','records']){
   const rows=arr(data[key]);add(key);add(rows.length);
   for(const r of rows){
    add(r?.id);add(r?.updatedAt);add(r?.name);add(r?.moduleId);add(r?.moduleName);
    if(key==='profiles'){
     for(const k of ['displayName','contact','profileRemark','birthDate','startDate','gender','usualRpLength','rpLengthMin','rpLengthMax'])add(r?.[k]);
     add(JSON.stringify(r?.notes||{}));add(JSON.stringify(r?.scores||{}));add(JSON.stringify(r?.blacklist||{}));
    }
    if(key==='pcs'){add(r?.ownerPlId);}
    if(key==='modules'){add(r?.title);}
    if(key==='plans'||key==='records'){
     add(r?.kpProfileId);add(r?.kp);add(arr(r?.plIds).join('\x1f'));
     if(key==='records')for(const k of ['startDate','endDate','tableName','logUrl','sharedHoNote'])add(r?.[k]);
     add(JSON.stringify(r?.participantAssignments||[]));
     if(key==='records'){add(JSON.stringify(r?.logEntries||[]));add(JSON.stringify(r?.logUrls||[]));add(JSON.stringify(r?.logLabels||[]));}
    }
   }
  }
  return hash.toString(16);
 }
 function legacyState(legacy){
  const filters={},set=(field,value)=>{if(value)filters[field]={op:'eq',value:String(value)}};
  set('relation',legacy.relation);set('runBands',legacy.run);set('dataFlags',legacy.data);
  return state.normalize({search:str(legacy.search),filters,sort:{field:'relevance',direction:'asc'}},'profiles',adapters.schemas.profiles);
 }
 function create({searchIndexer,exactMatcher}={}){
  let service=null,previous='',revision=0,builds=0;
  function query({data={},legacy={},selfId='',now,settings={}}){
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str(now)))throw new Error('请传入本地时间');
   const sig=signature(data,selfId,settings);
   if(!service){revision++;service=engineModule.create({data,revision,now,selfId,settings,searchIndexer});previous=sig;builds++;}
   else if(sig!==previous){const next=revision+1;service.replaceData(data,next,{now,selfId,settings});revision=next;previous=sig;builds++;}
   const normalized=legacyState(legacy);if(normalized.unresolved.length)throw new Error('无法识别 PL 筛选字段');
   service.restore('profiles',normalized.query);
   const mode=legacy.mode==='blacklist'?'blacklist':'active';
   const result=service.execute('profiles',{scope:row=>row.blacklisted===(mode==='blacklist'?'yes':'no')});
   const original=new Map(arr(data.profiles).map(p=>[str(p.id),p]));
   const projected=new Map(service.snapshot('profiles').map(p=>[p.id,p]));
   const rawRows=result.ids.map(id=>original.get(id));
   if(rawRows.some(p=>!p))throw new Error('PL 查询 ID 映射失败');
   const needle=str(legacy.search).normalize('NFKC').toLocaleLowerCase();
   const ranks=new Map();
   if(needle)for(const p of rawRows){
    const projection=projected.get(str(p.id));
    const exact=typeof exactMatcher==='function'?exactMatcher(p,needle):[projection.name,projection.displayName].some(x=>str(x).normalize('NFKC').toLocaleLowerCase()===needle);
    const direct=str(projection.directIndex).normalize('NFKC').toLocaleLowerCase();
    ranks.set(str(p.id),exact?0:direct.includes(needle)?1:2);
   }
   return Object.freeze({ids:result.ids,rawRows:Object.freeze(rawRows),ranks,count:result.count,total:result.total,query:service.query('profiles'),revision:service.revision(),diagnostics:service.diagnostics()});
  }
  return Object.freeze({query,invalidate:()=>{previous='';},revision:()=>revision,buildCount:()=>builds,diagnostics:()=>service?service.diagnostics():Object.freeze([])});
 }
 return Object.freeze({create,signature,legacyState,version:'0.3.0'});
});
