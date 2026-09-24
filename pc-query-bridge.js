/* PL收集梦想生活 · PC 查询桥接层 v0.2.2。
 * 映射现有页面控件值到版本化查询状态；只读运行，不触碰 DOM / 存储。
 * 页面传入同一轮数据快照；不把查询结果写入原始对象。
 */
(function(root,factory){
 'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-engine.js'):root.PLQueryEngine,node?require('./query-state.js'):root.PLQueryState,node?require('./field-adapters.js'):root.PLFieldAdapters);
 if(node)module.exports=api;else if(root)root.PLPCQueryBridge=api;
})(typeof globalThis==='object'?globalThis:null,function(engineModule,queryState,adapters){
 'use strict';if(!engineModule||!queryState||!adapters)throw new Error('PC 查询桥接层依赖不完整');
 const str=x=>String(x==null?'':x).trim(),arr=x=>Array.isArray(x)?x:[];
 const normalize=x=>str(x).normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').toLowerCase();
 // 轻量签名只用于检测运行期数据变更；实际数据的唯一来源始终是页面的源档案。
 // 签名不持久化、不可用作安全校验。保存成功必须调用 invalidate()。
 function signature(data,selfId,now){
  let hash=2166136261;const add=x=>{for(const c of str(x)){hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}};
  add(selfId);add(now.slice(0,13));
  for(const type of ['profiles','pcs','modules','plans','records']){
   const rows=arr(data[type]);add(type);add(rows.length);
   for(const row of rows){
    add(row?.id);add(row?.updatedAt);add(row?.name);add(row?.moduleId);add(row?.moduleName);
    if(type==='pcs'){add(row?.ownerPlId);add(row?.ownerNameSnapshot);add(row?.status);add(row?.alias);add(row?.era);add(row?.occupation);add(row?.gender);add(row?.residence);add(row?.birthplace);add(row?.notes);add(arr(row?.tags).join('\x1f'));for(const skill of arr(row?.skills))add(skill?.name);for(const snap of arr(row?.snapshots)){add(snap?.moduleName);add(snap?.tableName);add(snap?.date);add(snap?.note);}}
    if(type==='profiles'){add(row?.displayName);add(row?.publicName);add(row?.blacklist?.active);}
    if(type==='modules'){add(row?.era);add(row?.location);}
    if(type==='plans'||type==='records'){
     add(row?.kpProfileId);add(row?.startDate);add(row?.endDate);add(arr(row?.plIds).join('\x1f'));
     for(const a of arr(row?.participantAssignments)){add(a?.plId);add(a?.pcId);add(a?.pcName);add(a?.hoMode);add(a?.hoNumber);}
     add(row?.kpc?.pcId);add(row?.kpc?.enabled);for(const slot of arr(row?.timeSlots)){add(slot?.date);add(slot?.daypart);}
    }
   }
  }
  return hash.toString(16);
 }
 function create({searchIndexer}={}){
  let service=null,prevSignature='',version=0,builds=0,lastData=null,optionCache=null;
  function prepare({data={},selfId='',now,settings={}}){
   if(typeof now!=='string'||!/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.test(now))throw new Error('需要明确的本地时间');
   const sig=signature(data,selfId,now);
   if(!service){version++;service=engineModule.create({data,revision:version,selfId,now,settings,searchIndexer});prevSignature=sig;builds++;optionCache=null;}
   else if(sig!==prevSignature){const next=version+1;service.replaceData(data,next,{now,selfId,settings});version=next;prevSignature=sig;builds++;optionCache=null;}
   lastData=data;return service;
  }
  function query({data,legacy={},selfId='',now,settings={}}){
   const svc=prepare({data,selfId,now,settings});
   const normalized=queryState.legacyPcState(legacy,adapters.schemas.pcs);
   if(normalized.unresolved.length)throw new Error('PC 查询条件无法识别：'+normalized.unresolved.map(x=>x.field).join(','));
   svc.restore('pcs',normalized.query);
   const result=svc.execute('pcs');
   const rawMap=new Map(arr(data.pcs).map(pc=>[str(pc.id),pc]));
   const rawRows=result.ids.map(id=>rawMap.get(id));
   if(rawRows.some(x=>!x))throw new Error('查询结果与档案 ID 对应失败');
   return Object.freeze({ids:result.ids,rawRows:Object.freeze(rawRows),count:result.count,total:result.total,facets:result.facets,query:svc.query('pcs'),diagnostics:svc.diagnostics(),revision:svc.revision()});
  }
  function options(){
   if(!service||!lastData)return Object.freeze({modules:Object.freeze([]),tags:Object.freeze([])});
   if(optionCache)return optionCache;
   const pcids=new Set(service.snapshot('pcs').map(x=>x.id));
   const names=new Map(arr(lastData.modules).map(x=>[str(x.id),str(x.name||x.title)]));
   const mod=new Map(),tags=new Set(),byName=new Map();
   for(const [moduleId,moduleName] of names){
    const key=normalize(moduleName);if(!key)continue;
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(moduleId);
   }
   for(const pc of service.snapshot('pcs'))for(const tag of pc.tags)tags.add(tag);
   for(const row of [...arr(lastData.plans),...arr(lastData.records)]){
    const linked=arr(row.participantAssignments).some(a=>pcids.has(str(a?.pcId)))||(row.kpc?.enabled&&pcids.has(str(row.kpc.pcId)));
    if(!linked)continue;
    const mid=str(row.moduleId),name=str(row.moduleName)||names.get(mid)||'';
    // 显式 ID 失效时拒绝依靠同名猜测，相关异常由 diagnostics 报告。
    if(mid&&!names.has(mid))continue;
    if(mid){mod.set(mid,names.get(mid)||name);continue;}
    const candidates=byName.get(normalize(name))||[];
    // 只有唯一的历史名字可以安全映射为真实模组 ID；跨页按该 ID 传递。
    if(candidates.length===1){mod.set(candidates[0],names.get(candidates[0]));continue;}
    if(!name)continue;
    const key='name:'+normalize(name);
    mod.set(key,candidates.length>1?`${name}（同名模组待核对）`:`${name}（尚无模组档案）`);
   }
   const moduleMap=new Map(arr(lastData.modules).map(m=>[str(m.id),m]));
   const modules=Object.freeze([...mod].map(([value,label])=>{
    const module=moduleMap.get(value),duplicates=byName.get(normalize(label))||[];
    if(module&&duplicates.length>1){
     const era=str(module.era),place=str(module.location),detail=[era,place].filter(Boolean).join(' · ');
     const sameDetail=duplicates.filter(mid=>{const m=moduleMap.get(mid);return [str(m?.era),str(m?.location)].filter(Boolean).join(' · ')===detail}).length>1;
     label+=detail?` · ${detail}`:'';
     if(!detail||sameDetail)label+=` · ID ${value.slice(-8)}`;
    }
    return Object.freeze({value,label});
   }).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN')||a.value.localeCompare(b.value)));
   optionCache=Object.freeze({modules,tags:Object.freeze([...tags].sort((a,b)=>a.localeCompare(b,'zh-CN')))});
   return optionCache;
  }
  return Object.freeze({query,options,invalidate:()=>{prevSignature='';},revision:()=>version,buildCount:()=>builds,diagnostics:()=>service?service.diagnostics():Object.freeze([])});
 }
 return Object.freeze({create,signature,version:'0.2.1'});
});
