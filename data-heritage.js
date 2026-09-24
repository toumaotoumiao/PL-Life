/* PL 数据传承：保留无法直接映射的历史字段和归一化前原值。仅保存 JSON 数据；不执行字段内容。 */
(function(root){
'use strict';
var VERSION=1, LIMIT_BYTES=1200000, LIMIT_ENTRIES=12000;
var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
var plain=function(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);};
var dangerous=function(k){return k==='__proto__'||k==='constructor'||k==='prototype';};
function copy(v){if(v===undefined)throw Error('历史字段包含未定义值，迁移已暂停');return JSON.parse(JSON.stringify(v));}
/* Compare JSON values by meaning; object key insertion order is not a user-data change.
 * Arrays retain order. Existing stored heritage values remain byte-for-byte untouched. */
function stable(v){return JSON.stringify(v,function(k,value){
 if(!plain(value))return value;
 var sorted=Object.create(null);
 Object.keys(value).sort().forEach(function(key){sorted[key]=value[key];});
 return sorted;
});}
function utf8Bytes(s){var n=0;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=55296&&c<=56319&&i+1<s.length&&s.charCodeAt(i+1)>=56320&&s.charCodeAt(i+1)<=57343){n+=4;i++;}else n+=3;}return n;}
function assertSafe(v,depth){
 if(depth>32)throw Error('历史信息层级过深，迁移已暂停');
 if(Array.isArray(v)){if(v.length>20000)throw Error('历史信息数组过大，迁移已暂停');v.forEach(function(x){assertSafe(x,depth+1);});}
 else if(plain(v)){Object.keys(v).forEach(function(k){if(dangerous(k))throw Error('历史信息包含不安全字段名，迁移已暂停');assertSafe(v[k],depth+1);});}
 else if(v!==null&&!['string','number','boolean'].includes(typeof v))throw Error('历史信息包含不支持的数据类型');
}
function clean(ledger){
 if(ledger===undefined||ledger===null)return {version:VERSION,entries:[]};
 if(!plain(ledger)||ledger.version!==VERSION||!Array.isArray(ledger.entries))throw Error('历史信息保留区格式不兼容，迁移已暂停');
 assertSafe(ledger,0);
 if(ledger.entries.length>LIMIT_ENTRIES||utf8Bytes(stable(ledger))>LIMIT_BYTES)throw Error('历史信息保留区超出安全容量；原档案未被修改，请先导出备份');
 var unique=new Set();
 ledger.entries.forEach(function(e){
   if(!plain(e)||!['root','settings','profiles','pcs','modules','runs'].includes(e.scope)||typeof e.id!=='string'||!Array.isArray(e.path)||!['unknown','normalized'].includes(e.kind)||!own(e,'value'))throw Error('历史信息记录格式异常，迁移已暂停');
   if(e.path.length>32||e.path.some(function(k){return typeof k!=='string'||k.length>150||dangerous(k);}))throw Error('历史信息路径不安全，迁移已暂停');
   if(own(e,'review')){
     var r=e.review;
     if(!plain(r)||!['reviewed','proposed','handled','deferred','applied'].includes(r.status)||!Number.isSafeInteger(r.updatedAt)||r.updatedAt<0||typeof r.note!=='string'||r.note.length>500)throw Error('历史信息核对记录格式异常，迁移已暂停');
     if(Object.keys(r).some(function(k){return !['status','updatedAt','note','targetPath','strategy','appliedAt'].includes(k)||dangerous(k);}))throw Error('历史信息核对记录含未知字段，迁移已暂停');
     if(['proposed','applied'].includes(r.status)){
       if(!Array.isArray(r.targetPath)||r.targetPath.length<1||r.targetPath.length>8||r.targetPath.some(function(k){return typeof k!=='string'||k.length>100||dangerous(k);}))throw Error('历史信息映射建议的目标路径无效');
       if(typeof e.value!=='string')throw Error('只有原始文本可以提出字段映射建议');
       if(r.status==='applied'){
         if(!['same','keep-current','fill-empty','append','replace'].includes(r.strategy)||!Number.isSafeInteger(r.appliedAt)||r.appliedAt<0)throw Error('历史字段迁移记录无效');
       }else if(own(r,'strategy')||own(r,'appliedAt'))throw Error('尚未迁移的映射建议不能包含迁移结果');
     }else if(own(r,'targetPath')||own(r,'strategy')||own(r,'appliedAt'))throw Error('当前核对状态不能保留映射路径');
   }

   var key=e.scope+'\u0000'+e.id+'\u0000'+stable(e.path)+'\u0000'+e.kind;
   if(unique.has(key))throw Error('历史信息存在重复路径，迁移已暂停');unique.add(key);
 });
 return copy(ledger);
}
function capture(raw,projected,previous){
 var ledger=clean(previous),found=new Map(ledger.entries.map(function(e){return [e.scope+'\u0000'+e.id+'\u0000'+stable(e.path)+'\u0000'+e.kind,e];}));
 function add(scope,id,path,kind,value){
   var key=scope+'\u0000'+id+'\u0000'+stable(path)+'\u0000'+kind;
   if(!found.has(key)){found.set(key,{scope:scope,id:id,path:path.slice(),kind:kind,value:copy(value)});
    if(found.size>LIMIT_ENTRIES)throw Error('历史信息条目过多，迁移已暂停');}
 }
 function descend(src,dst,scope,id,path,depth){
  if(depth>32)throw Error('历史字段嵌套层级过深，迁移已暂停');
  if(plain(src)&&plain(dst)){
   Object.keys(src).forEach(function(k){
     if(dangerous(k))throw Error('历史信息包含不安全字段名，迁移已暂停');
     if(!own(dst,k)){add(scope,id,path.concat(k),'unknown',src[k]);return;}
     descend(src[k],dst[k],scope,id,path.concat(k),depth+1);
   });return;
  }
  if(Array.isArray(src)&&Array.isArray(dst)){
    if(src.length!==dst.length){add(scope,id,path,'normalized',src);return;}
    var ids=src.every(function(x){return plain(x)&&typeof x.id==='string'&&x.id;})&&dst.every(function(x){return plain(x)&&typeof x.id==='string'&&x.id;});
    if(!ids){if(stable(src)!==stable(dst))add(scope,id,path,'normalized',src);return;}
    if(src.some(function(x,i){return x.id!==dst[i].id;})){add(scope,id,path,'normalized',src);return;}
    var destMap=new Map(dst.map(function(x){return [x.id,x];}));
    src.forEach(function(x,i){var match=ids?destMap.get(x.id):dst[i];
      if(match===undefined){add(scope,id,path,'normalized',src);return;}
      descend(x,match,scope,id,path.concat(ids?'id:'+x.id:String(i)),depth+1);
    });return;
  }
  if(stable(src)!==stable(dst)){
   // A deliberately saved empty string or null is still user data. Never
   // suppress a changed historical value merely because it is empty.
   if(src===undefined)throw Error('历史字段包含无法无损保存的未定义值，迁移已暂停');
   add(scope,id,path,'normalized',src);
  }
 }
 function collection(scope,a,b){
   if(!Array.isArray(a))return;
   var dest=new Map((Array.isArray(b)?b:[]).map(function(x){return [String(x.id),x];}));
   a.forEach(function(x,i){
     if(!plain(x)||!x.id)throw Error('历史档案缺少稳定编号，已暂停字段自动保留');
     var id=String(x.id),y=dest.get(id);
     if(!y){add(scope,id,[],'normalized',x);return;}
     descend(x,y,scope,id,[],0);
   });
 }
 // Exclude internal commit metadata and export-only timestamps from heritage capture.
 var knownRoot={format:raw.format,schemaVersion:raw.schemaVersion,app:projected.app,settings:projected.settings,data:projected.data};
 ['_localSave','exportedAt','meta','heritage'].forEach(function(k){if(own(raw,k))knownRoot[k]=raw[k];});
 Object.keys(raw).forEach(function(k){if(!own(knownRoot,k))add('root','', [k],'unknown',raw[k]);});
 if(plain(raw.data))Object.keys(raw.data).forEach(function(k){if(!['profiles','pcs','modules','runs'].includes(k))add('root','',['data',k],'unknown',raw.data[k]);});
 // UI version is build metadata; it is not a user-entered field.
 if(plain(raw.app)){var stableApp=Object.assign({},raw.app);delete stableApp.uiVersion;var targetApp=Object.assign({},projected.app||{});delete targetApp.uiVersion;descend(stableApp,targetApp,'root','',['app'],0);}
 if(plain(raw.settings))descend(raw.settings,projected.settings||{},'settings','',[],0);
 ['profiles','pcs','modules','runs'].forEach(function(k){collection(k,raw.data&&raw.data[k],projected.data&&projected.data[k]);});
 ledger.entries=Array.from(found.values());
 return clean(ledger);
}
function captureLegacy(raw,state){
 // Historic formats are not fully mapped. Preserve each original entity under its stable
 // post-normalization ID so deleting an entity also deletes its historical sidecar values.
 // Never retain a second, whole-archive copy that could resurrect deleted people's data.
 assertSafe(raw,0);
 if(!state||!Array.isArray(state.profiles))throw Error('历史格式缺少有效迁移状态');
 var entries=[];
 function add(scope,id,path,value){
   entries.push({scope:scope,id:id,path:path,kind:'unknown',value:copy(value)});
   if(entries.length>LIMIT_ENTRIES)throw Error('历史信息条目过多，迁移已暂停');
 }
 function rows(source,targets,scope,skipRuns){
   if(!Array.isArray(source))return;
   if(!Array.isArray(targets)||source.length!==targets.length)throw Error('历史档案数量与标准化结果不一致，已暂停迁移');
   source.forEach(function(obj,i){
     if(!plain(obj))throw Error('历史档案存在无法定位的字段，已暂停迁移');
     var id=String(targets[i]&&targets[i].id||'');
     if(!id)throw Error('历史档案缺少迁移后编号，已暂停迁移');
     var snapshot=copy(obj);
     if(skipRuns)delete snapshot.runs;
     add(scope,id,['legacySource'],snapshot);
   });
 }
 var srcProfiles=Array.isArray(raw)?raw:raw.profiles;
 rows(srcProfiles,state.profiles,'profiles',true);
 if(plain(raw)){
   if(own(raw,'settings'))add('settings','',['legacySource'],raw.settings);
   rows(raw.modules,state.modules,'modules',false);
   rows(raw.pcs,state.pcs,'pcs',false);
   function runRows(source,targets){
     if(!Array.isArray(source))return;
     // A filtered-out legacy record may contain text. Stop instead of dropping it or
     // retaining the entire source in an unscoped root entry.
     if(source.length!==targets.length)throw Error('部分历史桌次无法定位；请先导出原始备份，迁移已暂停');
     source.forEach(function(obj,i){var id=String(targets[i]&&targets[i].id||'');if(!id)throw Error('历史桌次缺少编号，迁移已暂停');add('runs',id,['legacySource'],obj);});
   }
   runRows(raw.runRecords,state.runRecords);
   runRows(raw.runPlans,state.runPlans);
   Object.keys(raw).forEach(function(k){
     if(!['settings','profiles','modules','pcs','runRecords','runPlans'].includes(k)){
       if(dangerous(k))throw Error('历史信息包含不安全字段名，迁移已暂停');
       add('root','',['legacyRoot',k],raw[k]);
     }
   });
 }
 // Very old per-profile runs are distinct records keyed by source coordinates. Rows that
 // were previously skipped because they had no module name stay with their source PL.
 (srcProfiles||[]).forEach(function(profile,i){
   if(!Array.isArray(profile.runs))return;
   var skipped=[];
   profile.runs.forEach(function(row,j){
     var name=typeof row==='string'?row:row&&row.name;
     if(!String(name||'').trim()){skipped.push({index:j,raw:row});return;}
     var id='legacy_run_p'+i+'_r'+j;
     if(!state.runRecords.some(function(r){return String(r.id)===id;}))throw Error('历史逐人桌次编号无法核对，已暂停迁移');
     add('runs',id,['legacySource'],row);
   });
   if(skipped.length)add('profiles',String(state.profiles[i].id),['legacySkippedRuns'],skipped);
 });
 return clean({version:VERSION,entries:entries});
}
function prune(ledger,archive){
 var x=clean(ledger),known={profiles:new Set(),pcs:new Set(),modules:new Set(),runs:new Set()};
 Object.keys(known).forEach(function(k){(archive.data&&archive.data[k]||[]).forEach(function(e){known[k].add(String(e.id));});});
 x.entries=x.entries.filter(function(e){return !known[e.scope]||known[e.scope].has(e.id);});return clean(x);
}
function summary(ledger){var x=clean(ledger),counts={unknown:0,normalized:0};x.entries.forEach(function(e){counts[e.kind]++;});return {total:x.entries.length,unknown:counts.unknown,normalized:counts.normalized,bytes:utf8Bytes(stable(x))};}
root.PLDataHeritage=Object.freeze({VERSION:VERSION,LIMIT_BYTES:LIMIT_BYTES,clean:clean,capture:capture,captureLegacy:captureLegacy,prune:prune,summary:summary});
})(typeof window!=='undefined'?window:globalThis);
