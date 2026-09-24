/* 历史信息人工核对：只记录建议与处理进度；原值保持不变，不自动覆盖业务字段。 */
(function(root){
'use strict';
var H=root.PLDataHeritage;
if(!H)throw Error('历史信息保留模块未加载');
var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
var names={profiles:'PL',pcs:'PC',modules:'模组',runs:'桌次',settings:'设置',root:'其他'};
var allowed={
 profiles:['identity.contact','identity.profileRemark','trpg.rpLength.usual'],
 pcs:['occupation','notes','background','backstory','description','personalDescription','remarks'],
 modules:['notes','source','author','recruitment.background','recruitment.recruitmentNotes','recruitment.cardRequirements','recruitment.rules'],
 runs:['tableName','sharedHoNote','experience.thoughts','experience.notes','dateRange.legacyDuration']
};
function key(e){return JSON.stringify([e.scope,e.id,e.path,e.kind]);}
function get(ledger,entryKey){var x=H.clean(ledger);return x.entries.find(function(e){return key(e)===entryKey;})||null;}
function objectFor(archive,e){if(e.scope==='settings')return archive.settings;if(e.scope==='root')return archive;var a=archive&&archive.data&&archive.data[e.scope];return Array.isArray(a)?a.find(function(x){return String(x.id)===e.id;}):null;}
function pathValue(o,path){for(var i=0;i<path.length;i++){if(!o||!own(o,path[i]))return undefined;o=o[path[i]];}return o;}
function candidates(archive,e){
 if(!e||typeof e.value!=='string'||!allowed[e.scope])return [];
 var row=objectFor(archive,e);if(!row)return [];
 return allowed[e.scope].map(function(dot){var path=dot.split('.'),value=pathValue(row,path);return {path:path,label:dot,value:value};}).filter(function(x){return typeof x.value==='string';});
}
function stats(ledger){var l=H.clean(ledger),n={total:l.entries.length,pending:0,reviewed:0,proposed:0,handled:0,deferred:0,applied:0};l.entries.forEach(function(e){var s=e.review&&e.review.status||'pending';n[s]++;});return n;}
function update(ledger,entryKey,action,options,archive){
 var l=H.clean(ledger),e=l.entries.find(function(x){return key(x)===entryKey;});if(!e)throw Error('历史信息已发生变化，请重新打开核对台');
 options=options||{};
 if(!['reviewed','proposed','handled','deferred','reset'].includes(action))throw Error('未知的核对操作');
 if(e.review&&e.review.status==='applied')throw Error('此历史字段已经执行过迁移；迁移审计记录不能直接撤销。如需修改，请编辑当前档案或使用迁移前恢复点。');
 if(action==='reset'){delete e.review;return H.clean(l);}
 var note=String(options.note||'');if(note.length>500)throw Error('核对备注不能超过 500 字');
 var review={status:action,note:note,updatedAt:Date.now()};
 if(action==='proposed'){
   var target=options.targetPath;
   if(!Array.isArray(target))throw Error('请先选择目标字段');
   var match=candidates(archive,e).find(function(x){return JSON.stringify(x.path)===JSON.stringify(target);});
   if(!match)throw Error('目标字段已经变更或不支持，请重新核对');
   review.targetPath=match.path;
 }
 e.review=review;
 return H.clean(l);
}

function markApplied(ledger,entryKey,options,archive){
 var l=H.clean(ledger),e=l.entries.find(function(x){return key(x)===entryKey;});if(!e)throw Error('历史信息已发生变化，请重新打开核对台');
 options=options||{};var note=String(options.note||'');if(note.length>500)throw Error('核对备注不能超过 500 字');
 var target=options.targetPath;if(!Array.isArray(target))throw Error('缺少目标字段');
 var match=candidates(archive,e).find(function(x){return JSON.stringify(x.path)===JSON.stringify(target);});if(!match)throw Error('目标字段已经变更或不支持，请重新核对');
 var strategy=String(options.strategy||'');if(!['same','keep-current','fill-empty','append','replace'].includes(strategy))throw Error('迁移方式无效');
 var appliedAt=Number(options.appliedAt||Date.now());if(!Number.isSafeInteger(appliedAt)||appliedAt<0)throw Error('迁移时间无效');
 e.review={status:'applied',note:note,updatedAt:Date.now(),targetPath:match.path,strategy:strategy,appliedAt:appliedAt};
 return H.clean(l);
}
root.PLHeritageReview=Object.freeze({key:key,get:get,objectFor:objectFor,candidates:candidates,stats:stats,update:update,markApplied:markApplied,names:names});
})(typeof window!=='undefined'?window:globalThis);
