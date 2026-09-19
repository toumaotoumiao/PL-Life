/* PL收集梦想生活 · 独立只读关系索引 v0.2.0。
 * 没有 DOM、存储及网络；只存 ID 与不可变的关系摘要。
 * 所有集合必须在同一次数据快照上构建；变更后重新 build，不按姓名自动并档。
 */
(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.PLRelationIndex=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const id=x=>String(x==null?'':x).trim();
 const key=x=>id(x).normalize('NFKC').toLocaleLowerCase();
 const array=x=>Array.isArray(x)?x:[];
 const frozen=x=>Object.freeze(x);
 function build(data={},revision=0){
  if(!Number.isSafeInteger(revision)||revision<0)throw new TypeError('数据版本应是非负安全整数');
  const input={profiles:array(data.profiles),pcs:array(data.pcs),modules:array(data.modules),plans:array(data.plans),records:array(data.records)};
  for(const [type,rows] of Object.entries(input))if(!Array.isArray(data[type])&&data[type]!=null)throw new TypeError(type+' 必须是数组');
  const byId={},byName={},problems=[];
  for(const [type,rows] of Object.entries(input)){
   const m=new Map();byId[type]=m;byName[type]=new Map();
   for(const row of rows){
    const v=id(row?.id);if(!v)throw new Error(type+' 存在空 ID；停止建立索引以免串档');
    if(m.has(v))throw new Error(type+' 存在重复 ID：'+v);
    m.set(v,row);
    if(type==='modules'){
     const n=key(row.name||row.title);if(n){if(!byName[type].has(n))byName[type].set(n,[]);byName[type].get(n).push(v)}
    }
   }
  }
  const plPlans=new Map(),plRecords=new Map(),pcLinks=new Map(),modulePlans=new Map(),moduleRecords=new Map(),planLinks=new Map(),recordLinks=new Map();
  const add=(m,k,v)=>{if(!k)return;if(!m.has(k))m.set(k,[]);m.get(k).push(v)};
  const missing=(kind,entityId,field,ref)=>problems.push(frozen({kind,entityId,field,ref}));
  function resolveModule(entity,kind){
   const entityId=id(entity.id),explicit=id(entity.moduleId);
   if(explicit){
    if(byId.modules.has(explicit))return frozen({id:explicit,status:'id'});
    missing('missing-module-id',entityId,'moduleId',explicit);
    return frozen({id:'',status:'missing-id'});
   }
   const name=key(entity.moduleName),candidates=byName.modules.get(name)||[];
   if(candidates.length===1)return frozen({id:candidates[0],status:'legacy-unique'});
   if(candidates.length>1){missing('ambiguous-module-name',entityId,'moduleName',id(entity.moduleName));return frozen({id:'',status:'ambiguous'});}
   if(name)missing('missing-module-name',entityId,'moduleName',id(entity.moduleName));
   return frozen({id:'',status:name?'missing-name':'unlinked'});
  }
  function scan(rows,kind){
   for(const entity of rows){
    const eid=id(entity.id),module=resolveModule(entity,kind),plIds=[...new Set(array(entity.plIds).map(id).filter(Boolean))],kpId=id(entity.kpProfileId);
    if(module.id)add(kind==='plan'?modulePlans:moduleRecords,module.id,eid);
    if(kpId){if(byId.profiles.has(kpId))add(kind==='plan'?plPlans:plRecords,kpId,frozen({entityId:eid,role:'kp'}));else missing('missing-kp-id',eid,'kpProfileId',kpId)}
    for(const pid of plIds){if(byId.profiles.has(pid))add(kind==='plan'?plPlans:plRecords,pid,frozen({entityId:eid,role:'pl'}));else missing('missing-pl-id',eid,'plIds',pid)}
    const entityPc=new Map();
    const collect=(assignment,role)=>{
     const pid=id(assignment?.pcId);if(!pid){if(id(assignment?.pcName))missing('pc-name-only',eid,'pcName',id(assignment.pcName));return}
     if(!byId.pcs.has(pid)){missing('missing-pc-id',eid,'pcId',pid);return}
     if(!entityPc.has(pid))entityPc.set(pid,new Set());entityPc.get(pid).add(role);
     const owner=id(byId.pcs.get(pid).ownerPlId),declared=id(assignment?.plId|| (role==='kp'?kpId:''));
     if(owner&&declared&&owner!==declared)missing('pc-owner-mismatch',eid,'pcId',pid);
    };
    for(const a of array(entity.participantAssignments))collect(a,'pl');
    if(entity.kpc?.enabled)collect(entity.kpc,'kp');
    for(const [pid,roles] of entityPc){
     const entry=frozen({entityId:eid,kind,pcId:pid,moduleId:module.id,moduleStatus:module.status,moduleName:id(entity.moduleName),roles:frozen([...roles])});
     add(pcLinks,pid,entry);add(kind==='plan'?planLinks:recordLinks,eid,entry);
    }
   }
  }
  scan(input.plans,'plan');scan(input.records,'record');
  for(const pc of input.pcs){const owner=id(pc.ownerPlId);if(owner&&!byId.profiles.has(owner))missing('missing-pc-owner',id(pc.id),'ownerPlId',owner)}
  const list=(m,k)=>frozen([...(m.get(id(k))||[])]);
  const one=(type,x)=>byId[type].has(id(x));
  return frozen({revision,
   has:(type,x)=>{if(!own(byId,type))throw new Error('未知索引对象：'+type);return one(type,x)},
   profilePlans:x=>list(plPlans,x),profileRecords:x=>list(plRecords,x),pcLinks:x=>list(pcLinks,x),
   modulePlans:x=>list(modulePlans,x),moduleRecords:x=>list(moduleRecords,x),
   planPcLinks:x=>list(planLinks,x),recordPcLinks:x=>list(recordLinks,x),
   resolveModule:(entity,kind='record')=>resolveModuleReadOnly(entity),
   diagnostics:()=>frozen([...problems]),
   collectionIds:type=>{if(!own(byId,type))throw new Error('未知索引对象：'+type);return frozen([...byId[type].keys()])}
  });
  function resolveModuleReadOnly(entity){
   const explicit=id(entity?.moduleId);
   if(explicit)return frozen({id:byId.modules.has(explicit)?explicit:'',status:byId.modules.has(explicit)?'id':'missing-id'});
   const ids=byName.modules.get(key(entity?.moduleName))||[];
   return frozen({id:ids.length===1?ids[0]:'',status:ids.length===1?'legacy-unique':ids.length>1?'ambiguous':key(entity?.moduleName)?'missing-name':'unlinked'});
  }
 }
 return frozen({build,version:'0.2.0'});
});
