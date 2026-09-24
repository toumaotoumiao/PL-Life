/* 历史字段安全迁移：仅对已人工确认的文本映射执行预览和显式写入。 */
(function(root){
'use strict';
var H=root.PLDataHeritage,R=root.PLHeritageReview;
if(!H||!R)throw Error('历史信息模块未加载');
var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
var clone=function(v){return JSON.parse(JSON.stringify(v));};
var dangerous=function(k){return k==='__proto__'||k==='constructor'||k==='prototype';};
function safePath(path){return Array.isArray(path)&&path.length>0&&path.length<=8&&path.every(function(k){return typeof k==='string'&&k.length>0&&k.length<=100&&!dangerous(k);});}
function targetObject(archive,e){return R.objectFor(archive,e);}
function readPath(obj,path){var cur=obj;for(var i=0;i<path.length;i++){if(!cur||!own(cur,path[i]))return {exists:false,value:undefined};cur=cur[path[i]];}return {exists:true,value:cur};}
function writePath(obj,path,value){if(!safePath(path))throw Error('目标字段路径不安全');var cur=obj;for(var i=0;i<path.length-1;i++){if(!cur||typeof cur!=='object'||!own(cur,path[i]))throw Error('目标字段结构已经变化，请重新核对');cur=cur[path[i]];}var last=path[path.length-1];if(!cur||typeof cur!=='object'||!own(cur,last))throw Error('目标字段已经不存在，请重新核对');cur[last]=value;}
function entryAndTarget(archive,ledger,entryKey){
 var l=H.clean(ledger),e=R.get(l,entryKey);if(!e)throw Error('历史信息已发生变化，请重新打开核对台');
 if(!e.review||!['proposed','applied'].includes(e.review.status)||!safePath(e.review.targetPath))throw Error('请先确认映射建议');
 if(typeof e.value!=='string')throw Error('当前只支持将历史文本迁移到文本字段');
 var obj=targetObject(archive,e);if(!obj)throw Error('目标档案已经不存在');
 var found=readPath(obj,e.review.targetPath);if(!found.exists||typeof found.value!=='string')throw Error('目标字段已经变化或不再是文本字段，请重新核对');
 return {ledger:l,entry:e,obj:obj,path:e.review.targetPath.slice(),historical:e.value,current:found.value};
}
function classify(current,historical){if(current===historical)return 'same';if(!String(current).trim())return 'empty';return 'conflict';}
function mergeText(current,historical){var a=String(current||''),b=String(historical||'');if(!a.trim())return b;if(a===b||a.includes(b))return a;return a.replace(/\s+$/,'')+'\n\n'+b.replace(/^\s+/,'');}
function allowedStrategies(kind){if(kind==='same')return ['same'];if(kind==='empty')return ['fill-empty','replace'];return ['keep-current','append','replace'];}
function defaultStrategy(kind){return kind==='same'?'same':kind==='empty'?'fill-empty':'keep-current';}
function resultValue(current,historical,strategy){
 if(strategy==='same'||strategy==='keep-current')return current;
 if(strategy==='fill-empty'){if(String(current).trim())throw Error('目标字段已经有内容，不能使用“仅填入空字段”');return historical;}
 if(strategy==='append')return mergeText(current,historical);
 if(strategy==='replace')return historical;
 throw Error('未知的迁移策略');
}
function preview(archive,ledger,entryKey,strategy){
 var ctx=entryAndTarget(archive,ledger,entryKey),kind=classify(ctx.current,ctx.historical),allowed=allowedStrategies(kind),chosen=strategy||defaultStrategy(kind);
 if(!allowed.includes(chosen))throw Error('当前内容状态不允许使用所选迁移方式');
 return {entry:clone(ctx.entry),targetPath:ctx.path,current:ctx.current,historical:ctx.historical,kind:kind,allowedStrategies:allowed,defaultStrategy:defaultStrategy(kind),strategy:chosen,result:resultValue(ctx.current,ctx.historical,chosen),changes:chosen!=='same'&&chosen!=='keep-current'&&ctx.current!==resultValue(ctx.current,ctx.historical,chosen)};
}
function apply(archive,ledger,entryKey,strategy,note){
 var p=preview(archive,ledger,entryKey,strategy),nextArchive=clone(archive),nextLedger=H.clean(ledger),e=R.get(nextLedger,entryKey),obj=targetObject(nextArchive,e);
 if(p.changes)writePath(obj,p.targetPath,p.result);
 nextLedger=R.markApplied(nextLedger,entryKey,{targetPath:p.targetPath,strategy:p.strategy,note:String(note||''),appliedAt:Date.now()},nextArchive);
 nextArchive.heritage=nextLedger;
 return {archive:nextArchive,ledger:nextLedger,preview:p};
}
function readTarget(archive,ledger,entryKey){var ctx=entryAndTarget(archive,ledger,entryKey);return {path:ctx.path,value:ctx.current,entry:clone(ctx.entry)};}
root.PLHeritageApply=Object.freeze({preview:preview,apply:apply,readTarget:readTarget,classify:classify,mergeText:mergeText});
})(typeof window!=='undefined'?window:globalThis);
