/* PL收集梦想生活 · 查询编排服务 v0.2.0。无 DOM、localStorage 或写操作。 */
(function(root,factory){
 'use strict';const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./query-core.js'):root.PLQueryCore,node?require('./relation-index.js'):root.PLRelationIndex,
  node?require('./field-adapters.js'):root.PLFieldAdapters,node?require('./query-state.js'):root.PLQueryState);
 if(node)module.exports=api;else if(root)root.PLQueryEngine=api;
})(typeof globalThis==='object'?globalThis:null,function(core,relations,adapters,state){
 'use strict';if(!core||!relations||!adapters||!state)throw new Error('查询引擎的依赖未完整加载');
 const freeze=Object.freeze,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function create({data={},revision=0,now,selfId='',settings={},scopes={},searchIndexer}={}){
  if(!now)throw new Error('请指定本地参考时间');
  let index=relations.build(data,revision),snapshot=adapters.build(data,{index,revision,now,selfId,settings,searchIndexer});
  const sessions=new Map();
  function schema(page){if(!own(adapters.schemas,page))throw new Error('未注册查询页面：'+String(page));return adapters.schemas[page]}
  function session(page){schema(page);if(!sessions.has(page))sessions.set(page,state.createSession(null,page,schema(page)));return sessions.get(page)}
  function search(page,{draft=false,facets={},scope}={}){
   const sch=schema(page),query=draft?session(page).draft():session(page).applied();
   if(!query)throw new Error('没有已打开的筛选草稿');
   if(scope!=null&&typeof scope!=='function')throw new TypeError('范围权限必须是函数');
   if(scopes[page]!=null&&typeof scopes[page]!=='function')throw new TypeError('页面范围权限必须是函数');
   // 原数据范围先于搜索与计数。分享/隐藏模式必须由调用方明确传入相应 policy。
   const policy=scope||scopes[page]||(page==='profiles'?row=>row.blacklisted!=='yes':()=>true);
   const result=core.execute({rows:snapshot[page],schema:sch,query,sourceScope:policy,facets});
   return freeze({...result,rows:freeze([...result.rows]),ids:freeze([...result.ids]),revision:index.revision});
  }
  function replaceData(next,nextRevision,options={}){
   if(!Number.isSafeInteger(nextRevision)||nextRevision<=index.revision)throw new Error('新数据修订号必须严格递增');
   // 强异常安全：先完整建立下一版索引与只读投影，成功后一次性切换。
   const candidate=relations.build(next,nextRevision);
   const projected=adapters.build(next,{index:candidate,revision:nextRevision,now:options.now||now,selfId:options.selfId===undefined?selfId:options.selfId,settings:options.settings||settings,searchIndexer});
   index=candidate;snapshot=projected;return index.revision;
  }
  return freeze({
   schema,query:page=>session(page).applied(),begin:page=>session(page).begin(),draft:page=>session(page).draft(),
   dispatch:(page,action)=>session(page).dispatch(action),edit:(page,action)=>session(page).edit(action),
   apply:page=>session(page).apply(),cancel:page=>session(page).cancel(),restore:(page,raw)=>session(page).restore(raw),
   execute:search,replaceData,
   diagnostics:()=>index.diagnostics(),revision:()=>index.revision,
   // 返回只读投影快照，用于测试；不是页面数据存储的引用。
   snapshot:page=>{schema(page);return snapshot[page]}
  });
 }
 return freeze({create,version:'0.2.0'});
});
