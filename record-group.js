/* PL收集梦想生活 · 跑团记录可视分组 v0.8.0 · 无数据写入。 */
(function(root,factory){'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory();if(node)module.exports=api;else if(root)root.PLRecordGroups=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';const s=v=>String(v==null?'':v).trim(),norm=v=>s(v).normalize('NFKC').toLocaleLowerCase();
 function group(records=[],modules=[]){
  const byId=new Map(),byName=new Map(),items=new Map(),nameKeys=new Map();
  for(const m of modules){const id=s(m.id),name=s(m.name||m.title);if(id)byId.set(id,m);const key=norm(name);if(key){if(!byName.has(key))byName.set(key,[]);byName.get(key).push(m);}}
  for(const r of records){
   const explicit=s(r.moduleId),rawName=s(r.moduleName),nameKey=norm(rawName),candidate=byName.get(nameKey)||[];
   const resolved=explicit?byId.get(explicit):candidate.length===1?candidate[0]:null;
   const key=resolved?'id:'+s(resolved.id):explicit?'missing:'+explicit:'legacy:'+nameKey;
   const name=rawName||s(resolved?.name)||'未命名模组';
   if(!items.has(key))items.set(key,{key,name,moduleId:resolved?s(resolved.id):'',status:resolved?(explicit?'id':'legacy-unique'):explicit?'missing-id':candidate.length>1?'ambiguous':'unlinked',records:[]});
   items.get(key).records.push(r);
  }
  for(const item of items.values()){
   const nameKey=norm(item.name);if(!nameKeys.has(nameKey))nameKeys.set(nameKey,[]);nameKeys.get(nameKey).push(item);
  }
  const output=[];
  for(const item of items.values()){
   const duplicate=nameKeys.get(norm(item.name)).length>1;
   const archive=byId.get(item.moduleId);
   const distinguishing=item.moduleId?([s(archive?.author),s(archive?.era)].filter(Boolean)[0]||'档案')+' · '+item.moduleId.slice(-6):item.status==='missing-id'?'失效关联 · '+item.key.slice(8):'待确认关联';
   // Distinct groups must never share an interactive key even when titles are identical.
   const label=duplicate?`${item.name} · ${distinguishing}`:item.name;
   output.push(Object.freeze({key:item.key,name:item.name,label,moduleId:item.moduleId,status:item.status,ambiguous:duplicate||item.status==='ambiguous'||item.status==='missing-id',records:Object.freeze([...item.records])}));
  }
  return Object.freeze(output);
 }
 return Object.freeze({group,version:'0.8.0'});
});
