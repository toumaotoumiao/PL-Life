'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extractFunction(name){
  const start=html.indexOf(`function ${name}(`); assert.ok(start>=0,`missing ${name}`);
  const brace=html.indexOf('{',start); let depth=0,quote='',escape=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){ if(escape){escape=false;continue;} if(ch==='\\'){escape=true;continue;} if(ch===quote){quote='';continue;} continue; }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++; else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('personal statistics calendar exposes every module label instead of dot-only or truncated cells',()=>{
  const fn=extractFunction('statsYearCalendarHTML');
  assert.match(fn,/statsCalendarDisplayItems\(rows,999\)/);
  assert.match(fn,/stats-day-event/);
  assert.match(fn,/escapeHTML\(item\.label\)/);
  assert.doesNotMatch(fn,/statsCalendarShortName\(item\.label/,'live annual calendar should not shorten module names');
  assert.doesNotMatch(fn,/stats-day-dot/,'year review calendar must not fall back to unexplained dot-only cells');
  assert.doesNotMatch(fn,/另 \$\{display\.extra\} 桌/,'complete calendar should not hide extra same-day runs behind +N');
  assert.match(html,/我的跑团回顾年历/);
});

test('calendar display grouping keeps table identity and can report multiple runs on one day',()=>{
  const src=[extractFunction('statsCalendarRoleKey'),extractFunction('statsCalendarMergeRole'),extractFunction('statsCalendarShortName'),extractFunction('statsCalendarDisplayItems')].join('\n');
  const context={Map,Set,String,Boolean,Math}; vm.createContext(context); vm.runInContext(src,context);
  const rows=[
    {runId:'a',moduleName:'克拉布湖水怪',roles:{kp:true,pl:false},archived:true},
    {runId:'a',moduleName:'克拉布湖水怪',roles:{kp:true,pl:false},archived:true},
    {runId:'b',moduleName:'伥渡',roles:{kp:false,pl:true},archived:false},
    {runId:'c',moduleName:'第三个模组',roles:{kp:true,pl:true},archived:true}
  ];
  const out=context.statsCalendarDisplayItems(rows,2);
  assert.equal(out.all.length,3);
  assert.equal(out.items[0].count,2);
  assert.equal(out.items[0].roleKey,'kp');
  assert.equal(out.items[1].roleKey,'pl');
  assert.equal(out.extra,1);
});

test('planner annual export has separate overview, complete-calendar and agenda purposes',()=>{
  assert.match(html,/>全年排期图</);
  assert.match(html,/>年度总览</);
  assert.match(html,/>完整年历</);
  assert.match(html,/>排期清单</);
  assert.match(html,/function buildPlannerYearShowcaseCanvases\(/);
  assert.match(html,/function drawPlannerCompleteCalendarPage\(/);
  assert.match(html,/function drawPlannerYearAgendaBlock\(/);
  const start=html.indexOf('async function openPlannerYearShowcasePreview()');
  const end=html.indexOf('let selfIntroDraft = null;',start);
  assert.ok(start>=0&&end>start,'planner preview function section missing');
  const open=html.slice(start,end);
  assert.match(open,/buildPlannerYearShowcaseCanvases\(plannerYearShowcaseState\)/);
  assert.doesNotMatch(open,/buildStatsExportCanvases/,'planner annual export must not reuse the personal-statistics canvas pipeline');
  assert.match(open,/排期／执行视角，不等同于个人统计年度回顾/);
});

test('legacy timeline preference migrates to agenda and complete calendar is accepted',()=>{
  const normalizer=extractFunction('normalizePlannerYearShowcaseState');
  const context={}; vm.createContext(context); vm.runInContext(normalizer,context);
  assert.equal(context.normalizePlannerYearShowcaseState({mode:'timeline'}).mode,'agenda');
  assert.equal(context.normalizePlannerYearShowcaseState({mode:'calendar'}).mode,'calendar');
  assert.equal(context.normalizePlannerYearShowcaseState({mode:'complete'}).mode,'complete');
  assert.match(html,/async function exportCurrentYearCalendarImage\(\)\{return openPlannerYearShowcasePreview\(\);\}/);
  assert.match(html,/exportCurrentYearCalendarImage=async function\(\)\{return openPlannerYearShowcasePreview\(\);\}/);
});
