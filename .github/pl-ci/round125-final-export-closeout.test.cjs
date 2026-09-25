'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
function source(name,next){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction '+next+'(',start);assert(start>=0&&end>start,`missing function ${name}`);return html.slice(start,end);}
const h=source('recordShowcaseBlockHeight','recordShowcaseLayout');
const draw=source('drawRecordShowcaseSummary','drawRecordShowcaseSchedule');
test('Round125 single-record overview dynamically accounts for all six cards in narrow half-column',()=>{
 const rects=[];
 const c={Math,recordShowcaseMeasureLines:()=>2,
 canvasFillRound(_ctx,x,y,w,h){rects.push({x,y,w,h});},
 drawRecordShowcasePanelBase(_ctx,x,y){return y+76;},
 canvasTextFit(_ctx,t){return String(t)}
 };
 vm.createContext(c);vm.runInContext(h+'\n'+draw+'\nthis.height=recordShowcaseBlockHeight;this.paint=drawRecordShowcaseSummary;',c);
 const ctx={fillStyle:'',font:'',fillText(){}};
 const theme={muted:'#777',ink:'#000',surface2:'#eee',line:'#bbb'};
 const data={role:'KP',status:'已结团',date:'2026-09-01',r:{actualDuration:'4h'},plCount:4,logs:[]};
 for(const [width,expected,columns] of [[500,284,2],[1012,218,3]]){
  rects.length=0;const measured=c.height('summary',width,data);
  assert.equal(measured,expected);
  c.paint(ctx,20,30,width,measured,theme,data);
  assert.equal(rects.length,6);
  assert.equal(new Set(rects.map(r=>r.y)).size,6/columns);
  assert(Math.max(...rects.map(r=>r.y+r.h))<=30+measured-20,'cards must retain at least 20px bottom gutter');
 }
});
test('Round125 generated preview error does not impersonate an empty record selection',()=>{
 const single=source('renderRecordShowcasePreview','clearRecordShowcasePreviewDragMarks');
 assert.match(single,/recordShowcaseRetry/);
 assert.match(single,/recordShowcasePreviewDiagnostics/);
 assert.match(single,/exportBtn\.disabled=true/);
 assert.match(single,/本桌记录和当前展示选择没有被修改/);
 assert.match(html,/if\(e\.target\.closest\("#recordShowcaseRetry"\)\)/);
 const recap=source('render','open');
 assert.match(recap,/const empty=\/当前范围没有可导出的/);
 assert.match(recap,/recordsRecapRetry/);
 assert.match(recap,/recordsRecapDiagnostics/);
 assert.match(recap,/empty\?'<strong>当前范围没有可导出的回顾内容<\/strong>':'<strong>预览生成失败/);
 assert.match(html,/if\(e\.target\.closest\('#recordsRecapRetry'\)\)/);
});
test('Round125 failed final preview keeps its settings panel available and preview focus has state',()=>{
 const single=source('openRecordShowcaseFinalPreview','recordReadonlyBodyHTML');
 assert(single.indexOf('window.PLUnifiedExportPreview(canvas,')<single.indexOf('closeRecordShowcase();return true;'));
 const recapStart=html.lastIndexOf("function finalPreview(){try{const canvases=buildCanvases()");assert(recapStart>=0);const recap=html.slice(recapStart,html.indexOf('const oldSensitive=',recapStart));
 assert(recap.indexOf('window.PLUnifiedExportPreview(canvases,')<recap.indexOf('close();return true;'));
 assert.match(html,/id="recordsRecapClose" type="button" aria-label="关闭整合回顾设置"/);
 assert.match(html,/id="recordsRecapFocus" type="button" aria-pressed="false"/);
 assert.match(html,/b\.setAttribute\('aria-pressed',focus\?'true':'false'\)/);
});
test('Round125 current version follows the service-worker cache, without pinning historical test',()=>{
 const m=html.match(/const APP_UI_VERSION = "(\d+\.\d+\.\d+\.\d+)"/);assert(m);
 const sw=fs.readFileSync(path.join(__dirname,'../../sw.js'),'utf8');
 assert(sw.includes('CACHE_NAME=`${CACHE_PREFIX}v'+m[1]+'`'));
 const old=fs.readFileSync(path.join(__dirname,'round124-preference-stats-acceptance.test.cjs'),'utf8');
 assert.doesNotMatch(old,/assert\.match\(html, \/const APP_UI_VERSION = "8/);
});
test('Round125 single-record preview failure really disables export while keeping retry and diagnostics',()=>{
 const f=source('renderRecordShowcasePreview','clearRecordShowcasePreviewDragMarks');
 const preview={innerHTML:''},button={disabled:false},diag={textContent:''};
 const r={moduleName:'测试模组'};
 const ctx={document:{getElementById:id=>({recordShowcasePreview:preview,recordShowcaseExport:button,recordShowcasePreviewDiagnostics:diag})[id]||null},
 recordShowcaseRecord:()=>r,recordShowcaseLayout:()=>{throw new Error('模拟画布失败')},recordShowcaseState:{},
 APP_UI_VERSION:'8.1.12.test',console:{error(){}}};
 vm.runInNewContext(f+'\nrenderRecordShowcasePreview();',ctx);
 assert.equal(button.disabled,true);
 assert(preview.innerHTML.includes('recordShowcaseRetry'));
 assert(preview.innerHTML.includes('本桌记录和当前展示选择没有被修改'));
 assert(diag.textContent.includes('模拟画布失败'));
});
test('Round125 failed handoff keeps both source editors open; success closes only after preview opens',async()=>{
 const single=source('openRecordShowcaseFinalPreview','recordReadonlyBodyHTML').split('let recordShowcaseEscapeBound=')[0];
 const recapStart=html.lastIndexOf('function finalPreview(){try{const canvases=buildCanvases()');
 const recap=html.slice(recapStart,html.indexOf('const oldSensitive=',recapStart));
 let closed=0,issues=[];
 const record={id:'example',moduleName:'测试模组'};
 const c={recordShowcaseRecord:()=>record,recordShowcaseState:{},buildRecordShowcaseCanvas:()=>({}),visibleRecordTableName:()=>'',
 closeRecordShowcase:()=>{closed++},showContextIssue:v=>issues.push(v),APP_UI_VERSION:'test',console:{error(){}},
 window:{PLUnifiedExportPreview:()=>{throw new Error('模拟预览无法打开')}}};
 vm.createContext(c);vm.runInContext(single,c);
 assert.equal(await vm.runInContext('openRecordShowcaseFinalPreview()',c),false);
 assert.equal(closed,0,'record editor must not be closed when final preview fails');
 assert.equal(issues.length,1);
 c.window.PLUnifiedExportPreview=()=>{};
 assert.equal(await vm.runInContext('openRecordShowcaseFinalPreview()',c),true);
 assert.equal(closed,1);
 let recapClosed=0,recapIssues=[];
 const d={buildCanvases:()=>[{}],state:{range:'all'},close:()=>{recapClosed++},showContextIssue:v=>recapIssues.push(v),APP_UI_VERSION:'test',
 window:{PLUnifiedExportPreview:()=>{throw new Error('模拟统一预览失败')}}};
 vm.createContext(d);vm.runInContext(recap,d);
 assert.equal(vm.runInContext('finalPreview()',d),false);
 assert.equal(recapClosed,0,'recap settings must remain open when handoff fails');
 assert.equal(recapIssues.length,1);
 d.window.PLUnifiedExportPreview=()=>{};
 assert.equal(vm.runInContext('finalPreview()',d),true);
 assert.equal(recapClosed,1);
});
