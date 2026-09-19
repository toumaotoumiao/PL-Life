/* PL收集梦想生活 · 字段适配器 v0.2.0。只读投影；不存储隐私联系人原文。 */
(function(root,factory){
 'use strict';const api=factory(typeof module==='object'&&module.exports?require('./query-core.js'):root.PLQueryCore,
 typeof module==='object'&&module.exports?require('./relation-index.js'):root.PLRelationIndex);
 if(typeof module==='object'&&module.exports)module.exports=api;else if(root)root.PLFieldAdapters=api;
})(typeof globalThis==='object'?globalThis:null,function(core,relations){
 'use strict';if(!core||!relations)throw new Error('必须先加载查询核心与关系索引');
 const arr=v=>Array.isArray(v)?v:[],id=v=>String(v==null?'':v).trim(),t=id;
 const norm=core.normalize,freeze=Object.freeze;
 const farr=v=>freeze([...v]);
 const has=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(t(v))?t(v):'';
 const number=v=>has(v)&&Number.isFinite(Number(v))?Number(v):null;
 function scorePresent(scores){return Object.values(object(scores)).some(v=>number(v)!==null)}
 function validLogs(r){
  // Unlinked notes are legitimate saved Log entries, even before a URL is added.
  const urls=new Set(),entries=arr(r.logEntries),source=entries.length?entries:arr(r.logUrls);
  let noteOnly=0;
  source.forEach((item,i)=>{
   const url=t(item&&typeof item==='object'?item.url:item);
   const label=t(item&&typeof item==='object'?(item.label||item.note):arr(r.logLabels)[i]);
   if(url)urls.add(url);else if(label)noteOnly++;
  });
  if(t(r.logUrl))urls.add(t(r.logUrl));
  return urls.size+noteOnly;
 }
 function moduleScore(m,settings){
  const rating=object(m.rating),manual=number(rating.manualScore);if(manual!==null)return manual;
  const systems=arr(settings?.moduleArchive?.ratingSystems),system=systems.find(x=>id(x.id)===id(rating.ratingSystemId))||systems[0];
  if(!system)return null;let total=0,weight=0;
  for(const c of arr(system.criteria)){
   const w=number(c.weight),v=number(object(rating.scores)[id(c.id)]);
   if(w!==null&&w>0&&v!==null){total+=w*v;weight+=w}
  }
  return weight?total/weight:null;
 }
 function hoStatus(value){if(value===true)return'has';if(value===false)return'none';const v=norm(value);if(['has','yes','有','有ho','有ho位','有ho位之分'].includes(v))return'has';if(['none','no','无','无ho','无ho位','无ho位之分'].includes(v))return'none';return''}
 function parseRange(raw,kind){
  const z=t(raw).toLowerCase().replace(/[～〜~—–－]/g,'-').replace(/至|到/g,'-').replace(/＋/g,'+');if(!z)return null;
  if(kind==='players'&&!/\d/.test(z)){
   const cn={单:1,一:1,双:2,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10},m=z.match(/(单|双|一|二|两|三|四|五|六|七|八|九|十)\s*(?:人|名|位)?/);
   return m?freeze({min:cn[m[1]],max:cn[m[1]]}):null;
  }
  const minutes=kind==='duration'&&/(分钟|分鐘|mins?\b|minutes?\b)/i.test(z)&&!/(小时|小時|时|時|時間|时间|\bh(?:rs?|ours?)?\b)/i.test(z);
  const unit=minutes?1/60:1;
  if(kind==='duration'&&/前半|后半|後半|上半|下半|第一(?:部|幕|章|阶段|階段)?|第二(?:部|幕|章|阶段|階段)?/.test(z)){
   const nums=[...z.matchAll(/\d+(?:\.\d+)?/g)].map(x=>+x[0]);
   if(nums.length>=2&&!/\d\s*-\s*\d/.test(z)){const sum=nums.reduce((a,b)=>a+b,0)*unit;return freeze({min:sum,max:/\d+(?:\.\d+)?\s*\+/.test(z)?Infinity:sum})}
  }
  let m=z.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if(m){let a=+m[1]*unit,b=+m[2]*unit;if(a>b)[a,b]=[b,a];return freeze({min:a,max:b})}
  m=z.match(/(\d+(?:\.\d+)?)\s*\+/);
  if(m)return freeze({min:+m[1]*unit,max:Infinity});
  m=z.match(/\d+(?:\.\d+)?/);
  if(m)return freeze({min:+m[0]*unit,max:+m[0]*unit});
  if(kind==='duration'){
   if(/超大长篇|超大長篇|超长篇|超長篇/.test(z))return freeze({min:24,max:Infinity});
   if(/长篇|長篇/.test(z))return freeze({min:8,max:Infinity});
   if(/中篇/.test(z))return freeze({min:4,max:12});
   if(/短篇/.test(z))return freeze({min:0,max:4});
  }
  return null;
 }
 function querySchema(fields,search){
  const f={};for(const [key,type] of Object.entries(fields))f[key]={get:r=>r[key],type};
  return freeze({id:r=>r.id,fields:freeze(f),search:freeze(search.map(([field,weight])=>freeze({get:r=>r[field],weight})))});
 }
 const schemas=freeze({
  profiles:querySchema({name:'text',displayName:'text',blacklisted:'text',relation:'text',recordCount:'number',runBands:'text',dataFlags:'text',contactFilled:'text',rated:'text',updatedAt:'number'},[['name',0],['displayName',0],['directIndex',1],['relatedIndex',5]]),
  pcs:querySchema({name:'text',ownerId:'text',ownerState:'text',status:'text',era:'text',tags:'text',relation:'text',moduleKeys:'text',recordCount:'number',planCount:'number',totalCount:'number',latestDate:'date',updatedAt:'number',scoreZero:'number'},[['name',0],['alias',1],['ownerName',2],['era',3],['occupation',3],['tags',4],['moduleNames',5],['hoNames',5],['notes',8],['skillNames',6],['searchIndex',10]]),
  modules:querySchema({name:'text',era:'text',location:'text',hoSystem:'text',recordCount:'number',kpCount:'number',plCount:'number',score:'number',rated:'text',playersRange:'range',durationRange:'range',updatedAt:'number',createdAt:'number',firstRunDate:'number',lastRunDate:'number',firstPlanDate:'number',lastPlanDate:'number'},[['name',0],['author',2],['location',3],['era',3],['searchIndex',7]]),
  plans:querySchema({name:'text',moduleId:'text',kpId:'text',plIds:'text',role:'text',status:'text',scheduled:'text',participantCount:'number',nextDate:'date',updatedAt:'number'},[['tableName',0],['name',1],['peopleNames',2],['pcNames',3],['logLabels',7],['searchIndex',9]]),
  records:querySchema({name:'text',moduleId:'text',kpId:'text',plIds:'text',role:'text',roleFlags:'text',pcFlags:'text',logCount:'number',dateState:'text',pcState:'text',hoState:'text',startDate:'date',endDate:'date',statDate:'date',createdAt:'number',updatedAt:'number'},[['tableName',0],['name',1],['peopleNames',2],['pcNames',3],['logLabels',7],['searchIndex',8]]),
  moduleTools:querySchema({name:'text',author:'text',era:'text',location:'text',hoSystem:'text',reKp:'text',nature:'text',plCount:'number',kpCount:'number',runCount:'number',score:'number',playersRange:'range',durationRange:'range',updatedAt:'number'},[['name',0],['author',2],['searchExtras',7]])
 });
 function build(data={},options={}){
  const idx=options.index||relations.build(data,options.revision||0),selfId=id(options.selfId),settings=options.settings||{},now=options.now;
  const searchIndexer=typeof options.searchIndexer==='function'?options.searchIndexer:null;
  // 当前本地时间由调用者提供，不使用 UTC 字符串推导用户的本地“今天”。
  if(!now||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(now))throw new Error('必须传入已确定本地时区的 now，如 2026-09-18T09:00');
  const today=now.slice(0,10),hour=Number(now.slice(11,13)),part=hour<12?0:hour<18?1:2;
  const source={profiles:arr(data.profiles),pcs:arr(data.pcs),modules:arr(data.modules),plans:arr(data.plans),records:arr(data.records),moduleTools:arr(data.moduleTools)};
  const pmap=new Map(source.profiles.map(p=>[id(p.id),p]));
  const mmap=new Map(source.modules.map(m=>[id(m.id),m]));
  const pcmap=new Map(source.pcs.map(p=>[id(p.id),p]));
  const recordsMap=new Map(source.records.map(r=>[id(r.id),r]));
  const plansMap=new Map(source.plans.map(r=>[id(r.id),r]));
  const display=p=>t(p?.displayName)||t(p?.name);
  const pname=pid=>display(pmap.get(pid))||'';
  const mid=e=>idx.resolveModule(e).id;
  const selfRuns=selfId?idx.profileRecords(selfId):[];
  const selfKpRunIds=new Set(selfRuns.filter(x=>x.role==='kp').map(x=>x.entityId));
  const selfPlRunIds=new Set(selfRuns.filter(x=>x.role==='pl').map(x=>x.entityId));
  const read=()=>{
   const records=source.records.map(r=>{
    const links=idx.recordPcLinks(r.id),start=date(r.startDate),end=date(r.endDate),logs=validLogs(r),plIds=farr([...new Set(arr(r.plIds).map(id))]),kpId=id(r.kpProfileId),resolution=idx.resolveModule(r);
    const statDate=start||arr(r.sessionSlots).map(s=>date(s?.date)).filter(Boolean).sort()[0]||'';
    const ass=arr(r.participantAssignments),pcNames=farr([...new Set([...ass.map(a=>t(a.pcName)),t(r.kpc?.pcName)].filter(Boolean))]);
    const missingPc=plIds.some(pid=>!ass.some(a=>id(a.plId)===pid&&(t(a.pcName)||t(a.pcId))))||ass.some(a=>!t(a.pcName)&&!t(a.pcId));
    const hasPc=ass.some(a=>has(a.pcName)||has(a.pcId))||Boolean(r.kpc?.enabled&&(has(r.kpc.pcName)||has(r.kpc.pcId)));
    const validHo=a=>Boolean(a&&t(a.hoMode)!=='none'&&(t(a.hoNumber)&&Number(a.hoNumber)>0||t(a.hoCustom)));
    const ho=ass.some(validHo)||(r.kpc?.enabled&&validHo(r.kpc))||false;
    const isKp=Boolean(selfId&&(kpId===selfId||(!kpId&&['我','本人','自己'].includes(t(r.kp)))));
    const isPl=Boolean(selfId&&(plIds.includes(selfId)||ass.some(a=>id(a.plId)===selfId)));
    const both=isKp&&isPl;
    const role=both?'both':isKp?'kp':isPl?'pl':'other';
    const roleFlags=farr([...(isKp?['kp']:[]),...(isPl?['pl']:[]),...(!isKp&&!isPl?['other']:[])]);
    const pcFlags=farr([...(hasPc?['has']:[]),...(missingPc?['missing']:[]),...(!hasPc?['none']:[])]);
    const logLabels=farr([...arr(r.logEntries).map(x=>t(x?.label||x?.note)),...arr(r.logLabels)].filter(Boolean));
    const searchParts=[r.tableName,r.moduleName,r.kp,pname(kpId),...plIds.map(pname),...ass.map(a=>pname(id(a.plId))),...pcNames,r.startDate,r.endDate,r.actualDuration,r.thoughts,r.runNotes,r.notes,r.sharedHoNote,r.logUrl,...arr(r.logUrls),...arr(r.logEntries).flatMap(x=>[x?.url,x?.label,x?.note]),...arr(r.sessionSlots).flatMap(s=>[s?.date,s?.daypart]),...ass.flatMap(a=>[a?.hoNumber,a?.hoCustom]),r.kpc?.hoCustom];
    const searchIndex=searchIndexer?String(searchIndexer(searchParts)):searchParts.map(t).join(' ');
    return freeze({id:id(r.id),name:t(r.moduleName)||t(mmap.get(resolution.id)?.name),tableName:t(r.tableName),moduleId:resolution.id,moduleResolution:resolution.status,kpId,plIds,role,
     peopleNames:farr([pname(kpId),t(r.kp),...plIds.map(pname),...ass.map(a=>pname(id(a.plId)))].filter(Boolean)),pcNames,logCount:logs,logLabels,searchIndex,roleFlags,pcFlags,
     dateState:!start&&!end?'undated':start&&end?'complete':'partial',pcState:missingPc?'missing':hasPc?'has':'none',hoState:ho?'has':'none',startDate:start,endDate:end,statDate,createdAt:number(r.createdAt),updatedAt:number(r.updatedAt),linkedPcIds:farr(links.map(x=>x.pcId))});
   });
   const plans=source.plans.map(p=>{
    const plIds=farr([...new Set(arr(p.plIds).map(id))]),kpId=id(p.kpProfileId)||(selfId&&['我','本人','自己'].includes(t(p.kp))?selfId:''),resolution=idx.resolveModule(p);
    const slots=arr(p.timeSlots).map(s=>({date:date(s?.date),part:({morning:0,afternoon:1,evening:2})[t(s?.daypart)]??2})).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)||a.part-b.part);
    const active=slots.find(s=>s.date===today&&s.part===part),future=slots.find(s=>s.date>today||s.date===today&&s.part>part);
    const status=!slots.length?'unscheduled':active?'active':future?'upcoming':'overdue';
    const both=Boolean(selfId&&kpId===selfId&&plIds.includes(selfId)),role=both?'both':selfId&&kpId===selfId?'kp':selfId&&plIds.includes(selfId)?'pl':'other';
    return freeze({id:id(p.id),name:t(p.moduleName)||t(mmap.get(resolution.id)?.name),tableName:t(p.tableName),moduleId:resolution.id,moduleResolution:resolution.status,kpId,plIds,role,status,scheduled:slots.length?'yes':'no',participantCount:plIds.length,
     nextDate:active?.date||future?.date||'',nextPart:active?.part??future?.part??null,updatedAt:number(p.updatedAt),peopleNames:farr([pname(kpId),t(p.kp),...plIds.map(pname)].filter(Boolean)),pcNames:farr(arr(p.participantAssignments).map(a=>t(a.pcName)).filter(Boolean)),
     logLabels:farr(arr(p.logLabels).map(t).filter(Boolean)),searchIndex:searchIndexer?String(searchIndexer([p.tableName,p.moduleName,p.kp,p.sharedHoNote,p.logUrl,p.logLabels,p.logUrls,arr(p.logEntries).flatMap(e=>[e?.label,e?.note,e?.url]),arr(p.timeSlots).flatMap(slot=>[slot?.date,slot?.daypart,slot?.startTime,slot?.endTime]),arr(p.participantAssignments).flatMap(a=>[a?.pcName,a?.hoCustom,a?.hoNumber]),p.kpc?.pcName])):''});
   });
   const pcs=source.pcs.map(pc=>{
    const links=idx.pcLinks(pc.id),recs=links.filter(x=>x.kind==='record'),plans=links.filter(x=>x.kind==='plan'),dates=[];
    for(const link of links){const entity=link.kind==='record'?recordsMap.get(link.entityId):plansMap.get(link.entityId);
     if(!entity)continue;if(link.kind==='record'){if(date(entity.endDate||entity.startDate))dates.push(date(entity.endDate||entity.startDate))}
     else for(const slot of arr(entity.timeSlots))if(date(slot.date))dates.push(date(slot.date));
    }
    const ownerId=id(pc.ownerPlId),owner=pmap.get(ownerId),name=owner?display(owner):t(pc.ownerNameSnapshot)||'未关联 PL';
    const moduleNames=farr([...new Set(links.map(l=>t(mmap.get(l.moduleId)?.name)||l.moduleName).filter(Boolean))]);
    const tagRows=farr(arr(pc.tags).map(t).filter(Boolean)),status=t(pc.status)==='retired'?'archived':t(pc.status)||'active';
    const hoNames=farr(links.flatMap(l=>{
     const entity=(l.kind==='record'?recordsMap:plansMap).get(l.entityId);
     return arr(entity?.participantAssignments).filter(a=>id(a.pcId)===id(pc.id)).flatMap(a=>[t(a.hoCustom),t(a.hoNumber)]).filter(Boolean);
    }));
    const skillNames=farr(arr(pc.skills).map(s=>t(s.name)).filter(Boolean));
    const snapshotTexts=arr(pc.snapshots).flatMap(s=>[s?.moduleName,s?.tableName,s?.date,s?.note]).map(t).filter(Boolean);
    const hoSearch=farr(links.flatMap(l=>{
     const entity=(l.kind==='record'?recordsMap:plansMap).get(l.entityId);
     const ass=[...arr(entity?.participantAssignments).filter(a=>id(a.pcId)===id(pc.id)),...(entity?.kpc?.enabled&&id(entity.kpc.pcId)===id(pc.id)?[entity.kpc]:[])];
     return ass.map(a=>a.hoMode==='none'?'无 HO':a.hoMode==='number'?(a.hoNumber?'HO'+a.hoNumber:'HO未选'):a.hoMode==='custom'?(t(a.hoCustom)||'自定义HO'):'').filter(Boolean);
    }));
    const searchIndex=searchIndexer?String(searchIndexer([pc.name,pc.alias,name,pc.era,pc.occupation,pc.gender,pc.residence,pc.birthplace,status,({active:'使用中',dead:'死亡',archived:'封存'})[status]||'',pc.tags,moduleNames,hoSearch,pc.notes,skillNames,snapshotTexts])):'';
    return freeze({id:id(pc.id),name:t(pc.name),alias:t(pc.alias),ownerId,ownerName:name,ownerState:!ownerId?'unlinked':owner?'linked':'missing',status,era:t(pc.era),occupation:t(pc.occupation),gender:t(pc.gender),residence:t(pc.residence),birthplace:t(pc.birthplace),
     tags:tagRows,notes:t(pc.notes),skillNames,hoNames,moduleNames,moduleKeys:farr([...new Set([...links.map(l=>l.moduleId||(l.moduleStatus==='missing-id'?'':'name:'+norm(l.moduleName))).filter(Boolean),...links.filter(l=>l.moduleStatus==='legacy-unique'&&l.moduleName).map(l=>'name:'+norm(l.moduleName))])]),searchIndex,relation:farr([...recs.length?['records']:[],...plans.length?['plans']:[],...links.length?['linked']:['unlinked']]),
     recordCount:recs.length,planCount:plans.length,totalCount:links.length,latestDate:dates.sort().at(-1)||'',updatedAt:number(pc.updatedAt),scoreZero:number(pc.coc?.san)});
   });
   const recordRowsMap=new Map(records.map(r=>[r.id,r]));
   const profiles=source.profiles.map(p=>{
    const pid=id(p.id),runs=idx.profileRecords(pid),plans=idx.profilePlans(pid),recordIds=[...new Set(runs.map(x=>x.entityId))],moduleNames=farr([...new Set(recordIds.map(rid=>recordRowsMap.get(rid)?.name).filter(Boolean))]);
    const other=pid!==selfId;
    const mypl=Boolean(other&&selfId&&runs.some(x=>x.role==='pl'&&selfKpRunIds.has(x.entityId))),mykp=Boolean(other&&selfId&&runs.some(x=>x.role==='kp'&&selfPlRunIds.has(x.entityId)));
    const copl=Boolean(other&&selfId&&runs.some(x=>x.role==='pl'&&selfPlRunIds.has(x.entityId)));
    const relation=farr([mypl?'mypl':'',mykp?'mykp':'',copl?'copl':'',!(mypl||mykp||copl)?'none':''].filter(Boolean));
    const note=Boolean(t(p.profileRemark)||Object.values(object(p.notes)).some(has));
    const rated=Object.entries(object(p.scores)).some(([k,v])=>k!=='kpPlSide'&&number(v)!==null&&(!arr(settings.fields).length||arr(settings.fields).some(f=>id(f.key)===k)));
    const dataFlags=farr([has(p.contact)?'contact':'',note?'note':'',rated?'rated':''].filter(Boolean));
    const recordCount=recordIds.length,runBands=farr(recordCount?['has',...(recordCount>=2?['multi']:[]),...(recordCount>=5?['frequent']:[])]:['none']);
    const related=recordIds.map(rid=>recordsMap.get(rid)).filter(Boolean);
    const relatedText=related.flatMap(r=>[r?.moduleName,r?.tableName,r?.startDate,r?.endDate,r?.kp,r?.logUrl,r?.sharedHoNote,...arr(r?.logEntries).flatMap(e=>[e?.url,e?.label,e?.note]),...arr(r?.logUrls),...arr(r?.logLabels),...arr(r?.participantAssignments).filter(a=>id(a?.plId)===pid).flatMap(a=>[a?.pcName,a?.hoCustom,a?.hoNumber])]);
    const directText=[p.name,display(p),p.contact,p.profileRemark,p.birthDate,p.startDate,p.gender,p.usualRpLength,p.rpLengthMin,p.rpLengthMax,...Object.values(object(p.notes)),...(p.blacklist?.active?[p.blacklist.reason,...arr(p.blacklist.history).flatMap(x=>[x?.reason,x?.addedAt,x?.removedAt])]:[])];
    const directIndex=searchIndexer?String(searchIndexer(directText)):directText.map(t).join(' ');
    // 同一个 PL 的大量桌次可能重复包含日期、KP 和模组名。
    // 搜索索引只需保留每段独立文本一次；避免拼接几十万字后重复进行拼音转换。
    const uniqueRelatedText=[...new Set(relatedText.filter(v=>v!==null&&v!==undefined&&v!==false).map(t))];
    const relatedIndex=searchIndexer?String(searchIndexer(uniqueRelatedText)):uniqueRelatedText.join(' ');
    return freeze({id:pid,name:t(p.name),displayName:display(p),remark:t(p.profileRemark),blacklisted:p.blacklist?.active?'yes':'no',relation,
     recordCount,runBands,dataFlags,planCount:new Set(plans.map(x=>x.entityId)).size,contactFilled:has(p.contact)?'yes':'no',rated:rated?'yes':'no',moduleNames,directIndex,relatedIndex,updatedAt:number(p.updatedAt)});
   });
   const planRowsMap=new Map(plans.map(r=>[r.id,r])),originalPlansMap=new Map(source.plans.map(p=>[id(p.id),p]));
   const timeNumber=x=>{if(x==null||x==='')return null;const v=typeof x==='number'?x:Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(t(x))?t(x)+'T00:00:00Z':t(x));return Number.isFinite(v)?v:null};
   const extrema=(dates,mode)=>{const valid=dates.map(timeNumber).filter(Number.isFinite);return valid.length?(mode==='first'?Math.min(...valid):Math.max(...valid)):null};
   const modules=source.modules.map(m=>{
    const mids=idx.moduleRecords(m.id),own=mids.map(rid=>recordRowsMap.get(rid)).filter(Boolean),score=moduleScore(m,settings);
    const modulePlans=idx.modulePlans(m.id).map(pid=>planRowsMap.get(pid)).filter(Boolean);
    const planDates=modulePlans.flatMap(p=>arr(originalPlansMap.get(p.id)?.timeSlots).map(slot=>date(slot?.date)).filter(Boolean));
    const runDates=own.map(r=>r.startDate).filter(Boolean);
    const extra=[m.name,m.title,m.author,m.source,m.location,m.era,m.nature,m.notes,m.rules,m.players,m.duration,m.recommendedSkills,m.cardRequirements,m.recommendedOccupations,m.lostRate,m.background,m.recruitmentNotes,m.reKp];
    return freeze({id:id(m.id),name:t(m.name||m.title),author:t(m.author),era:t(m.era),location:t(m.location),hoSystem:hoStatus(m.hoSystem),recordCount:mids.length,
     kpCount:own.filter(r=>r.kpId===selfId&&Boolean(selfId)).length,plCount:own.filter(r=>Boolean(selfId)&&r.plIds.includes(selfId)).length,score,rated:score===null?'no':'yes',
     playersRange:parseRange(m.players,'players'),durationRange:parseRange(m.duration,'duration'),notes:t(m.notes),searchIndex:searchIndexer?String(searchIndexer(extra)):extra.map(t).join(' '),
     updatedAt:timeNumber(m.updatedAt),createdAt:timeNumber(m.createdAt),firstRunDate:extrema(runDates,'first'),lastRunDate:extrema(runDates,'last'),firstPlanDate:extrema(planDates,'first'),lastPlanDate:extrema(planDates,'last')});
   });
   const moduleTools=source.moduleTools.map(m=>{
    const runCount=arr(m.runs).length,plCount=number(m.plCount)??0,kpCount=number(m.kpCount)??0;
    const extra=[m.source,m.setting,m.players,m.duration,m.nature,m.notes,m.rules,m.recommendedSkills,m.cardRequirements,m.recommendedOccupations,m.lostRate,m.background,m.recruitmentNotes,m.reKp,
     ...arr(m.runs).flatMap(r=>[r.role,r.thoughts,r.notes,r.kp,r.participants,r.ho])];
    return freeze({id:id(m.id),name:t(m.title||m.name),author:t(m.author),era:t(m.era),location:t(m.location),hoSystem:hoStatus(m.hoSystem),reKp:t(m.reKp),nature:t(m.nature),plCount,kpCount,runCount,
     score:moduleScore(m,settings),playersRange:parseRange(m.players,'players'),durationRange:parseRange(m.duration,'duration'),updatedAt:number(m.updatedAt),searchExtras:farr(extra.map(t).filter(Boolean))});
   });
   return freeze({profiles:farr(profiles),pcs:farr(pcs),modules:farr(modules),plans:farr(plans),records:farr(records),moduleTools:farr(moduleTools),revision:idx.revision,diagnostics:idx.diagnostics()});
  };
  return read();
 }
 return freeze({build,schemas,parseRange,moduleScore,validLogs,version:'0.2.0'});
});
