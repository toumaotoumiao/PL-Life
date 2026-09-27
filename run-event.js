/* PL收集梦想生活 · 跑团事件统一层 v1.1.0
   只读派生：不修改开团计划、跑团记录或历史字段。 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else if(root)root.PLRunEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const arr=v=>Array.isArray(v)?v:[];
  const text=v=>String(v==null?'':v).trim();
  const pad=n=>String(n).padStart(2,'0');
  function validDate(value){
    const s=text(value),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return '';
    const y=+m[1],mo=+m[2],d=+m[3],leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    return y>=1&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]?`${String(y).padStart(4,'0')}-${pad(mo)}-${pad(d)}`:'';
  }
  function clock(value){const m=/^(\d{1,2}):(\d{2})$/.exec(text(value));if(!m)return '';const h=+m[1],min=+m[2];return h>=0&&h<=23&&min>=0&&min<=59?`${pad(h)}:${pad(min)}`:'';}
  function normalizeRoleFlags(value){return {kp:Boolean(value&&value.kp),pl:Boolean(value&&value.pl)};}
  function roleName(flags){return flags.kp&&flags.pl?'kppl':flags.kp?'kp':flags.pl?'pl':'other';}
  function assignmentsForSelf(entity,selfId,roles){
    const sid=text(selfId),assignments=arr(entity&&entity.participantAssignments),out=[];
    if(roles.pl&&sid){const row=assignments.find(a=>text(a&&a.plId)===sid);if(row)out.push(row);}
    if(roles.kp&&entity&&entity.kpc&&entity.kpc.enabled!==false)out.push(entity.kpc);
    return out;
  }
  function hoText(row){
    if(!row)return '';
    const mode=text(row.hoMode);if(mode==='number'){const n=Number(row.hoNumber);return n>0?`HO${n}`:'';}
    if(mode==='custom')return text(row.hoCustom);
    return text(row.hoCustom)||(Number(row.hoNumber)>0?`HO${Number(row.hoNumber)}`:'');
  }
  function pcText(row){return row?text(row.pcName):'';}
  function eventBase(entity,kind,selfId,roleResolver){
    const roles=normalizeRoleFlags(typeof roleResolver==='function'?roleResolver(entity,selfId,kind):{}),assignments=assignmentsForSelf(entity,selfId,roles),
      pcNames=[...new Set(assignments.map(pcText).filter(Boolean))],hos=[...new Set(assignments.map(hoText).filter(Boolean))];
    return {
      runId:text(entity&&entity.id),moduleId:text(entity&&entity.moduleId),moduleName:text(entity&&entity.moduleName)||'未命名模组',tableName:text(entity&&entity.tableName),
      ruleMeta:entity&&entity.ruleMeta||null,source:kind,archived:kind==='record',status:text(entity&&entity.tableStatus),roles,role:roleName(roles),pcName:pcNames[0]||'',ho:hos[0]||'',pcNames,hos
    };
  }
  function slotEvents(entity,kind,selfId,roleResolver){
    const base=eventBase(entity,kind,selfId,roleResolver),slots=arr(kind==='record'?entity&&entity.sessionSlots:entity&&entity.timeSlots),out=[];
    slots.forEach((slot,index)=>{const date=validDate(slot&&slot.date);if(!date)return;out.push(Object.assign({},base,{eventId:`${base.runId||kind}:${text(slot&&slot.id)||index}:${date}`,date,dateSource:'slot',daypart:text(slot&&slot.daypart)||'evening',startTime:clock(slot&&slot.startTime),endTime:clock(slot&&slot.endTime),order:Number.isFinite(Number(slot&&slot.order))?Number(slot.order):0,slotId:text(slot&&slot.id)}));});
    return out;
  }
  function fallbackRecordEvent(entity,selfId,roleResolver){
    const date=validDate(entity&&entity.startDate)||validDate(entity&&entity.endDate);if(!date)return null;
    const base=eventBase(entity,'record',selfId,roleResolver);
    return Object.assign({},base,{eventId:`${base.runId||'record'}:fallback:${date}`,date,dateSource:validDate(entity&&entity.startDate)?'start':'end',daypart:'',startTime:'',endTime:'',order:0,slotId:''});
  }
  function compare(a,b){return text(a.date).localeCompare(text(b.date))||text(a.startTime).localeCompare(text(b.startTime))||Number(a.order||0)-Number(b.order||0)||text(a.moduleName).localeCompare(text(b.moduleName),'zh-CN');}
  function createEvents({plans=[],records=[],selfId='',roleResolver,includeUnrelated=false}={}){
    const out=[],archivedIds=new Set(arr(records).map(r=>text(r&&r.id)).filter(Boolean));
    arr(records).forEach(r=>{const rows=slotEvents(r,'record',selfId,roleResolver);if(rows.length)out.push(...rows);else{const fallback=fallbackRecordEvent(r,selfId,roleResolver);if(fallback)out.push(fallback);}});
    /* 同一桌归档后记录沿用原编号；若异常状态下计划和记录同时存在，以归档记录为准，避免全年统计重复。 */
    arr(plans).forEach(p=>{const id=text(p&&p.id);if(id&&archivedIds.has(id))return;out.push(...slotEvents(p,'plan',selfId,roleResolver));});
    const filtered=includeUnrelated?out:out.filter(e=>e.roles.kp||e.roles.pl);
    return filtered.sort(compare);
  }
  function within(events,{start='',end='',year=null}={}){
    const s=validDate(start),e=validDate(end),y=year==null?null:Number(year);
    return arr(events).filter(row=>{const d=validDate(row&&row.date);if(!d)return false;if(Number.isFinite(y)&&Number(d.slice(0,4))!==y)return false;if(s&&d<s)return false;if(e&&d>e)return false;return true;});
  }
  function summarize(events){
    const rows=arr(events),runIds=new Set(),days=new Set(),mods=new Set(),kpRuns=new Set(),plRuns=new Set();
    rows.forEach(e=>{const rid=text(e&&e.runId);if(rid)runIds.add(rid);const d=validDate(e&&e.date);if(d)days.add(d);const mid=text(e&&e.moduleId)||`name:${text(e&&e.moduleName).toLowerCase()}`;if(mid)mods.add(mid);if(e&&e.roles&&e.roles.kp&&rid)kpRuns.add(rid);if(e&&e.roles&&e.roles.pl&&rid)plRuns.add(rid);});
    return {tables:runIds.size,sessions:rows.length,days:days.size,modules:mods.size,kpTables:kpRuns.size,plTables:plRuns.size};
  }
  function moduleSpans(events){
    const map=new Map();arr(events).forEach(e=>{const key=text(e&&e.moduleId)||`name:${text(e&&e.moduleName).toLowerCase()}`;if(!key)return;let row=map.get(key);if(!row){row={key,moduleId:text(e.moduleId),moduleName:text(e.moduleName)||'未命名模组',dates:[],events:[],roles:{kp:false,pl:false}};map.set(key,row);}row.events.push(e);row.dates.push(e.date);row.roles.kp=row.roles.kp||Boolean(e.roles&&e.roles.kp);row.roles.pl=row.roles.pl||Boolean(e.roles&&e.roles.pl);});
    return [...map.values()].map(row=>{row.dates=[...new Set(row.dates.filter(validDate))].sort();row.start=row.dates[0]||'';row.end=row.dates[row.dates.length-1]||'';row.sessions=row.events.length;row.days=row.dates.length;row.role=roleName(row.roles);return row;}).sort((a,b)=>a.start.localeCompare(b.start)||a.moduleName.localeCompare(b.moduleName,'zh-CN'));
  }
  function runSpans(events){
    const map=new Map();arr(events).forEach(e=>{const key=text(e&&e.runId)||text(e&&e.eventId);if(!key)return;let row=map.get(key);if(!row){row={key,runId:text(e&&e.runId),moduleId:text(e&&e.moduleId),moduleName:text(e&&e.moduleName)||'未命名模组',tableName:text(e&&e.tableName),source:text(e&&e.source),archived:Boolean(e&&e.archived),dates:[],events:[],roles:{kp:false,pl:false}};map.set(key,row);}row.events.push(e);row.dates.push(e.date);row.roles.kp=row.roles.kp||Boolean(e.roles&&e.roles.kp);row.roles.pl=row.roles.pl||Boolean(e.roles&&e.roles.pl);});
    return [...map.values()].map(row=>{row.dates=[...new Set(row.dates.filter(validDate))].sort();row.start=row.dates[0]||'';row.end=row.dates[row.dates.length-1]||'';row.sessions=row.events.length;row.days=row.dates.length;row.role=roleName(row.roles);return row;}).sort((a,b)=>a.start.localeCompare(b.start)||a.moduleName.localeCompare(b.moduleName,'zh-CN')||a.tableName.localeCompare(b.tableName,'zh-CN'));
  }
  function byDate(events){const map=new Map();arr(events).forEach(e=>{const d=validDate(e&&e.date);if(!d)return;if(!map.has(d))map.set(d,[]);map.get(d).push(e);});for(const rows of map.values())rows.sort(compare);return map;}
  return {validDate,clock,createEvents,within,summarize,moduleSpans,runSpans,byDate,compare};
});
