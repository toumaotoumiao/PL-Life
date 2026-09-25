'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const slice=html.slice(html.indexOf('function plannerAgendaColumnHeight('),html.indexOf('function buildPlannerYearContinuousCanvas('));
assert.ok(slice.startsWith('function plannerAgendaColumnHeight('),'source exists');
function exercise(months){
 const calls={panel:[],labels:[],rects:[]},ctx={fillText:(str,x,y)=>calls.labels.push([String(str),x,y]),fillRect(){},save(){},restore(){},measureText:()=>({width:40}),setLineDash(){},beginPath(){},fill(){},stroke(){},getImageData(){return {data:[255,255,255,255]}},textAlign:'left'};
 const sandbox={defaultPlannerYearShowcaseState:()=>({showPc:false,showHo:false,showExactTime:false}),privacyMaskEnabled:false,drawStatsStoryPanelBase:(_c,x,y,w,h)=>{calls.panel.push({x,y,w,h});return y+82;},canvasFillRound:(_c,x,y,w,h)=>{calls.rects.push({x,y,w,h});},canvasTextFit:(_ctx,s)=>s,statsEventRoleLabel:()=> 'PL'};
 vm.createContext(sandbox);vm.runInContext(slice,sandbox);
 const events=months.flatMap(([m,count])=>Array.from({length:count},(_,i)=>({date:`2026-${String(m).padStart(2,'0')}-${String(i%28+1).padStart(2,'0')}`,moduleName:`模组 ${m}`,tableName:'',archived:true})));
 const data={events,state:{showPc:false,showHo:false,showExactTime:false}},layout=sandbox.plannerAgendaLayout(data,1532),bottom=sandbox.drawPlannerYearAgendaBlock(ctx,34,180,1532,{ink:'#000',muted:'#888',surface2:'#eee',line:'#ddd'},data);
 return {calls,layout,bottom,events};
}
test('Round143: lower-half-only months fill both columns without an empty first column',()=>{
 const {layout,calls}=exercise([[7,11],[8,11],[9,11],[10,11],[11,11],[12,11]]);
 assert.equal(layout.cols,2);assert.equal(layout.left[0],7);assert.ok(layout.right.length>0);
 const heads=calls.labels.filter(([s])=>/月 · \d+ 场/.test(s));assert.equal(heads.length,6);
 assert.ok(heads.some(([,x])=>x<700),'left populated');assert.ok(heads.some(([,x])=>x>700),'right populated');
});
test('Round143: one populated month gets full width and never floats on right',()=>{
 const {layout,calls}=exercise([[12,18]]);assert.equal(layout.cols,1);assert.equal(layout.right.length,0);assert.ok(layout.colW>1400);
 assert.ok(calls.labels.some(([s,x])=>s.startsWith('12 月 ·')&&x<100));
});
test('Round143: panel background height is measured from rendered rows; no 1800px fixed filler or clipped ending',()=>{
 for(const months of [[[7,11],[8,11],[9,11],[10,11],[11,11],[12,11]],[[1,1]],[[12,150]]]){
  const {layout,calls,bottom}=exercise(months);assert.equal(calls.panel.length,1);assert.equal(calls.panel[0].h,layout.panelH);
  assert.equal(bottom,180+layout.panelH);assert.ok(layout.panelH>=102);
  const rows=calls.rects.filter(x=>x.h===layout.rowH-3);assert.equal(rows.length,months.reduce((n,[,c])=>n+c,0));
  assert.ok(rows.every(row=>row.y+row.h < bottom),'all row cards inside background panel');
 }
 assert.doesNotMatch(slice,/drawStatsStoryPanelBase\(ctx,x,y,w,1800/);
 assert.match(html,/const agenda=plannerAgendaLayout\(data,innerW\);return\[create\(agenda\.panelH\+18/);
});
test('Round143: continuous and paged preview share agenda layout and common white panel background',()=>{
 assert.match(html,/function buildPlannerYearContinuousCanvas[\s\S]*?if\(state\.mode!=='complete'\)return buildPlannerYearShowcaseCanvases\(state\)\[0\]/);
 assert.match(html,/<style id="round143-planner-agenda-continuity">/);
 assert.match(html,/#plannerYearShowcasePanel>\.export-composer-body\{min-height:0;overflow:auto;background:var\(--t-surface\)/);
 assert.match(html,/#plannerYearShowcasePanel \.planner-year-preview-stage\{[^}]*background:var\(--t-surface\)!important/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
});
