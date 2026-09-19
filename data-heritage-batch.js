/* 历史字段批量安全迁移：只处理人工已确认的文本映射，且目标为空或内容完全一致。 */
(function(root){
'use strict';
var H=root.PLDataHeritage,R=root.PLHeritageReview,A=root.PLHeritageApply;
if(!H||!R||!A)throw Error('历史信息迁移依赖缺失');
var MAX_BATCH=40;
var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
var copy=function(x){return JSON.parse(JSON.stringify(x));};
var pathKey=function(e){return JSON.stringify([e.scope,e.id,e.review.targetPath]);};
function read(obj,path){var at=obj;for(var i=0;i<path.length;i++){if(at===null||typeof at!=='object'||!own(at,path[i]))return {exists:false};at=at[path[i]];}return {exists:true,value:at};}
function write(obj,path,value){var at=obj;for(var i=0;i<path.length-1;i++){if(!at||typeof at!=='object'||!own(at,path[i]))throw Error('迁移目标结构发生变化');at=at[path[i]];}var field=path[path.length-1];if(!at||typeof at!=='object'||!own(at,field)||typeof at[field]!=='string')throw Error('迁移目标字段发生变化');at[field]=value;}
function plan(archive,ledger){
 var clean=H.clean(ledger),entries=clean.entries,groups=new Map(),eligible=[],excluded={conflict:0,duplicate:0,invalid:0,nonText:0,emptySource:0},proposed=0;
 // 已迁移到同一目标的条目也参与冲突判定，防止二次写入不同历史值。
 entries.forEach(function(e){if(e.review&&['proposed','applied'].includes(e.review.status)&&Array.isArray(e.review.targetPath)){
  var k=pathKey(e);groups.set(k,(groups.get(k)||0)+1);
 }});
 entries.forEach(function(e){if(!e.review||e.review.status!=='proposed')return;proposed++;
  if(typeof e.value!=='string'){excluded.nonText++;return;}
  if(!e.value.trim()){excluded.emptySource++;return;}
  if((groups.get(pathKey(e))||0)>1){excluded.duplicate++;return;}
  var obj=R.objectFor(archive,e),path=e.review.targetPath;
  if(!obj||!Array.isArray(path)||!R.candidates(archive,e).some(function(x){return JSON.stringify(x.path)===JSON.stringify(path);})){excluded.invalid++;return;}
  var current=read(obj,path);
  if(!current.exists||typeof current.value!=='string'){excluded.invalid++;return;}
  var kind=A.classify(current.value,e.value);
  if(kind==='conflict'){excluded.conflict++;return;}
  eligible.push({key:R.key(e),scope:e.scope,id:e.id,sourcePath:e.path.slice(),path:path.slice(),kind:kind,strategy:kind==='same'?'same':'fill-empty',before:current.value,after:e.value});
 });
 return {eligible:eligible,excluded:excluded,proposed:proposed,maxBatch:MAX_BATCH,remainingAfterFirstBatch:Math.max(0,eligible.length-MAX_BATCH)};
}
function execute(archive,ledger,keys){
 if(!Array.isArray(keys)||!keys.length||keys.length>MAX_BATCH||keys.some(function(k){return typeof k!=='string';})||new Set(keys).size!==keys.length)throw Error('请选择 1 至 '+MAX_BATCH+' 条不同的历史信息');
 var current=plan(archive,ledger),lookup=new Map(current.eligible.map(function(x){return [x.key,x];})),selected=keys.map(function(k){var row=lookup.get(k);if(!row)throw Error('迁移条件或字段已变化，请重新预览');return row;});
 var nextArchive=copy(archive),nextLedger=H.clean(ledger),entryMap=new Map(nextLedger.entries.map(function(e){return [R.key(e),e];})),now=Date.now(),items=[];
 selected.forEach(function(row){
  var e=entryMap.get(row.key),obj=e&&R.objectFor(nextArchive,e);
  if(!e||!obj||e.review.status!=='proposed')throw Error('历史条目已变化，请重新预览');
  var available=R.candidates(nextArchive,e).some(function(x){return JSON.stringify(x.path)===JSON.stringify(row.path);});
  var actual=read(obj,row.path);
  if(!available||!actual.exists||typeof actual.value!=='string'||actual.value!==row.before||e.value!==row.after)throw Error('目标字段内容已经变化，请重新核对');
  if(A.classify(actual.value,e.value)!==row.kind)throw Error('迁移条件已经变化');
  if(row.kind==='empty')write(obj,row.path,e.value);
  var note=String(e.review.note||'');
  e.review={status:'applied',note:note,updatedAt:now,targetPath:row.path.slice(),strategy:row.strategy,appliedAt:now};
  items.push({scope:e.scope,id:e.id,sourcePath:e.path.slice(),targetPath:row.path.slice(),kind:e.kind,strategy:row.strategy,before:row.before,after:row.after,changed:row.before!==row.after});
 });
 nextLedger=H.clean(nextLedger);nextArchive.heritage=nextLedger;
 var report={format:'pl-life-heritage-batch-report',version:1,createdAt:new Date(now).toISOString(),count:items.length,changed:items.filter(function(x){return x.changed;}).length,unchanged:items.filter(function(x){return !x.changed;}).length,items:items};
 return {archive:nextArchive,ledger:nextLedger,report:report};
}
root.PLHeritageBatch=Object.freeze({MAX_BATCH:MAX_BATCH,plan:plan,execute:execute});
})(typeof window!=='undefined'?window:globalThis);
