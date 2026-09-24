/* PL收集梦想生活 · 用户展示导出编排核心 v1.3.0
   负责模块选择、排序、整行/半栏、列位置与分页规划；具体画布渲染由各展示页面提供。 */
(function(root,factory){
  'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else if(root)root.PLShowcaseCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';const text=v=>String(v==null?'':v).trim();
  function ids(defs){return (Array.isArray(defs)?defs:[]).map(x=>text(x&&x.id)).filter(Boolean);}
  function defaultState(defs){const list=ids(defs),widths={},columns={};(defs||[]).forEach(d=>{const id=text(d&&d.id);if(!id)return;widths[id]=d&&d.defaultWidth==='half'?'half':'full';if(d&&(d.defaultColumn==='left'||d.defaultColumn==='right'))columns[id]=d.defaultColumn;});return {selected:[...list],order:[...list],widths,columns};}
  function normalizeState(raw,defs){
    const allowed=ids(defs),set=new Set(allowed),def=defaultState(defs),src=raw&&typeof raw==='object'?raw:{};
    const selected=Array.isArray(src.selected)?src.selected.map(text).filter(id=>set.has(id)):def.selected;
    const orderRaw=Array.isArray(src.order)?src.order.map(text).filter(id=>set.has(id)):def.order;
    const order=[...new Set([...orderRaw,...allowed.filter(id=>!orderRaw.includes(id))])],widths=Object.assign({},def.widths),columns={};
    allowed.forEach(id=>{if(src.widths&&['full','half'].includes(src.widths[id]))widths[id]=src.widths[id];if(src.columns&&['left','right'].includes(src.columns[id]))columns[id]=src.columns[id];else if(def.columns[id])columns[id]=def.columns[id];});
    return {selected:[...new Set(selected)],order,widths,columns};
  }
  function compactColumns(state,defs){
    const next=normalizeState(state,defs),heights={left:0,right:0};
    next.order.filter(id=>next.selected.includes(id)).forEach(id=>{if(next.widths[id]==='full'){delete next.columns[id];heights.left=Math.max(heights.left,heights.right)+1;heights.right=heights.left;return;}const col=heights.left<=heights.right?'left':'right';next.columns[id]=col;heights[col]+=1;});
    return next;
  }
  function layoutRows(state,defs){
    const s=normalizeState(state,defs),rows=[],pending={left:null,right:null};
    const flush=()=>{if(pending.left||pending.right){rows.push({kind:'half',left:pending.left,right:pending.right});pending.left=null;pending.right=null;}};
    s.order.filter(id=>s.selected.includes(id)).forEach(id=>{if(s.widths[id]==='full'){flush();rows.push({kind:'full',id});return;}let col=s.columns[id];if(col!=='left'&&col!=='right')col=pending.left?'right':'left';if(pending[col])flush();pending[col]=id;if(pending.left&&pending.right)flush();});flush();return rows;
  }
  function place(state,defs,{sourceId,targetId='',after=false,column='auto',append=false}={}){
    const next=normalizeState(state,defs),source=text(sourceId),target=text(targetId),order=[...next.order],sourceIndex=order.indexOf(source);
    if(sourceIndex<0)return next;
    order.splice(sourceIndex,1);
    if(append||!target||source===target)order.push(source);
    else{let targetIndex=order.indexOf(target);if(targetIndex<0)order.push(source);else{if(after)targetIndex+=1;order.splice(Math.max(0,Math.min(order.length,targetIndex)),0,source);}}
    next.order=order;
    if(next.widths[source]==='half'&&(column==='left'||column==='right'))next.columns[source]=column;
    else if(next.widths[source]==='full')delete next.columns[source];
    return next;
  }
  function normalizeDensity(value){return ['compact','standard','relaxed'].includes(value)?value:'standard';}
  function densityProfile(value){const mode=normalizeDensity(value);if(mode==='compact')return {mode,gap:12,pad:24,pageHeight:3200,fontScale:.94};if(mode==='relaxed')return {mode,gap:28,pad:42,pageHeight:2600,fontScale:1.06};return {mode,gap:20,pad:34,pageHeight:2800,fontScale:1};}

  function packFreeLanes(items,{laneCount=3,startY=0,gap=0}={}){
    const lanes=Math.max(1,Math.floor(Number(laneCount)||1)),heights=Array(lanes).fill(Number(startY)||0),placements=[];
    (Array.isArray(items)?items:[]).forEach(raw=>{const span=Math.max(1,Math.min(lanes,Math.floor(Number(raw&&raw.span)||1))),maxLane=Math.max(0,lanes-span),lane=Math.max(0,Math.min(maxLane,Math.floor(Number(raw&&raw.lane)||0))),height=Math.max(0,Number(raw&&raw.height)||0),y=Math.max(...heights.slice(lane,lane+span)),next=y+height+(Number(gap)||0),item=Object.assign({},raw,{lane,span,y,height});placements.push(item);for(let i=lane;i<lane+span;i++)heights[i]=next;});
    return {placements,heights};
  }
  function insertIntoFreeLane(order,layout,{sourceId,targetId='',targetLane=0,after=false,laneCount=3}={}){
    const source=text(sourceId),target=text(targetId),nextOrder=(Array.isArray(order)?order.map(text):[]).filter(Boolean),nextLayout=Object.assign({},layout||{});if(!source||!nextOrder.includes(source))return {order:nextOrder,layout:nextLayout};
    const current=Object.assign({lane:0,span:1,locked:false},nextLayout[source]||{}),lanes=Math.max(1,Math.floor(Number(laneCount)||1)),span=Math.max(1,Math.min(lanes,Math.floor(Number(current.span)||1)));current.span=span;current.lane=Math.max(0,Math.min(lanes-span,Math.floor(Number(targetLane)||0)));nextLayout[source]=current;
    const stripped=nextOrder.filter(id=>id!==source);if(target&&stripped.includes(target)){let idx=stripped.indexOf(target)+(after?1:0);stripped.splice(idx,0,source);}else{const same=stripped.filter(id=>{const spec=nextLayout[id]||{};return Math.floor(Number(spec.lane)||0)===current.lane;}),last=same[same.length-1],idx=last?stripped.indexOf(last)+1:stripped.length;stripped.splice(idx,0,source);}return {order:stripped,layout:nextLayout};
  }
  function planPages(blocks,{pageHeight=1600,top=0,bottom=0,gap=18,minFirstBlock=0}={}){
    const limit=Math.max(1,Number(pageHeight)||1600),usable=Math.max(1,limit-(Number(top)||0)-(Number(bottom)||0)),pages=[];let page=[],used=0;
    (Array.isArray(blocks)?blocks:[]).forEach((block,index)=>{const h=Math.max(0,Number(block&&block.height)||0),extra=page.length?(Number(gap)||0):0;if(page.length&&used+extra+h>usable&&(used>=minFirstBlock||index>0)){pages.push(page);page=[];used=0;}page.push(block);used+=(page.length>1?(Number(gap)||0):0)+h;});if(page.length)pages.push(page);return pages;
  }
  return {defaultState,normalizeState,compactColumns,layoutRows,place,normalizeDensity,densityProfile,packFreeLanes,insertIntoFreeLane,planPages};
});
