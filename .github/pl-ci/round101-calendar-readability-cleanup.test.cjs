'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function segment(a,b){const i=html.indexOf(a);assert(i>=0,`${a} missing`);const j=html.indexOf(b,i+a.length);assert(j>i,`${b} missing after ${a}`);return html.slice(i,j);}
function extractFunction(name){const start=html.indexOf(`function ${name}(`);assert(start>=0,`missing ${name}`);const brace=html.indexOf('{',start);let depth=0,quote='',escape=false;for(let i=brace;i<html.length;i++){const ch=html[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote){quote='';continue;}continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);}throw new Error(`unterminated ${name}`);}

test('public statistics retires PL repeat-distribution instead of replacing it with new low-value highlight cards',()=>{
  const cfg=segment('const STATS_EXPORT_SCOPE_ORDER','function defaultStatsExportState');
  assert.doesNotMatch(cfg,/repeat/);
  const render=segment('function renderStats()','\/\* ---------- PC 档案');
  assert.doesNotMatch(render,/PL 参团次数分布/);
  assert.doesNotMatch(render,/年度跑团亮点|今年结团的模组/);
});

test('full annual calendars expand all same-day module names and force statistics calendar into half-year pages',()=>{
  const live=extractFunction('statsYearCalendarHTML');
  assert.match(live,/statsCalendarDisplayItems\(rows,999\)/);
  assert.match(live,/escapeHTML\(item\.label\)/);
  assert.doesNotMatch(live,/statsCalendarShortName\(item\.label/);
  assert.doesNotMatch(live,/已归档/);
  const pages=extractFunction('statsExportPageRows');
  assert.match(pages,/\[1,2,3,4,5,6\]/);
  assert.match(pages,/\[7,8,9,10,11,12\]/);
  assert.match(pages,/hasCalendarSegments/);
  assert.match(pages,/pages\.push\(\[block\]\)/);
  assert.match(html,/function drawPlannerCompleteCalendarPage\(/);
});

test('archived public calendar/footprint entries carry no redundant 已 marker while planned entries remain distinguishable',()=>{
  const overview=extractFunction('drawPlannerYearCalendarBlock');
  const complete=extractFunction('drawPlannerCompleteCalendarPage');
  assert.doesNotMatch(overview,/已归档|fillText\([`"']计/);
  assert.doesNotMatch(complete,/已归档|计划 \+|`计划 /);
  assert.match(overview,/setLineDash\(\[3,2\]\)/);
  assert.match(complete,/setLineDash\(\[4,2\]\)/);
  const agenda=extractFunction('drawPlannerYearAgendaBlock');
  assert.match(agenda,/event\.archived\?"":"计划"/);
  assert.doesNotMatch(agenda,/event\.archived\?"已归档"/);
  const eventMeta=extractFunction('statsExportEventMeta');
  assert.doesNotMatch(eventMeta,/已归档/);
  assert.match(eventMeta,/if\(!event\.archived\)out\.push\("计划中"\)/);
});

test('planner export offers distinct overview, complete calendar and dense agenda modes',()=>{
  assert.match(html,/data-planner-year-mode="calendar"[^>]*>年度总览</);
  assert.match(html,/data-planner-year-mode="complete"[^>]*>完整年历</);
  assert.match(html,/data-planner-year-mode="agenda"[^>]*>排期清单</);
  const build=segment('function buildPlannerYearShowcaseCanvases','function statsTimelineSpanMeta');
  assert.match(build,/state\.mode==="complete"/);
  assert.match(build,/state\.mode==="agenda"/);
});

test('workflow keeps Round101 in the live release gate',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
  assert(workflow.includes('round101-calendar-readability-cleanup.test.cjs'));
});
