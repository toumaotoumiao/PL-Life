'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extractFunction(name){
  const start=html.indexOf(`function ${name}(`);assert(start>=0,`missing ${name}`);
  const brace=html.indexOf('{',start);let depth=0,quote='',escape=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote){quote='';continue;}continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('live annual calendar uses semantic role backgrounds instead of K/P glyphs in every event',()=>{
  const fn=extractFunction('statsYearCalendarHTML');
  assert.match(fn,/role-\$\{escapeHTML\(item\.roleKey/);
  assert.doesNotMatch(fn,/<b>\$\{escapeHTML\(item\.role/);
  assert.match(fn,/class="kp"><\/i>我做 KP/);
  assert.match(fn,/class="pl"><\/i>我做 PL/);
  assert.match(html,/\.stats-day-event\.role-kp[^{]*\{/);
  assert.match(html,/\.stats-day-event\.role-pl[^{]*\{/);
  assert.match(html,/\.stats-day-event\.role-both[^{]*\{/);
});

test('calendar grouping carries semantic role keys and merges mixed identities without rendering letters',()=>{
  const src=[extractFunction('statsCalendarRoleKey'),extractFunction('statsCalendarMergeRole'),extractFunction('statsCalendarDisplayItems')].join('\n');
  const context={Map,Set,String,Boolean,Math};vm.createContext(context);vm.runInContext(src,context);
  const rows=[
    {runId:'a',moduleName:'甲',roles:{kp:true,pl:false},archived:true},
    {runId:'b',moduleName:'乙',roles:{kp:false,pl:true},archived:true},
    {runId:'c',moduleName:'丙',roles:{kp:true,pl:true},archived:false},
    {runId:'d',moduleName:'丁',roles:{kp:true,pl:false},archived:true},
    {runId:'d',moduleName:'丁',roles:{kp:false,pl:true},archived:true}
  ];
  const out=context.statsCalendarDisplayItems(rows,99);
  assert.deepEqual(Array.from(out.all,row=>row.roleKey),['kp','pl','both','both']);
});

test('statistics and planner canvas calendars spend date-cell width on module names, not identity/status letters',()=>{
  const stats=extractFunction('drawStatsStoryCalendar');
  const overview=extractFunction('drawPlannerYearCalendarBlock');
  const complete=extractFunction('drawPlannerCompleteCalendarPage');
  assert.match(stats,/drawCalendarCanvasItem\(ctx,item/);
  assert.match(complete,/drawCalendarCanvasItem\(ctx,item/);
  assert.doesNotMatch(stats,/prefix=item\.role|fillText\([^\n]*\bK\b|fillText\([^\n]*\bP\b/);
  assert.doesNotMatch(overview,/plannerCalendarStatusCode|fillText\([^\n]*[`"']计/);
  assert.doesNotMatch(complete,/`计划 \$\{item\.label|\$\{item\.role/);
});

test('role colors are theme semantic, mixed-role is dual-color, and plans remain dashed/weakened',()=>{
  const palette=extractFunction('calendarCanvasRolePalette');
  const item=html.slice(html.indexOf('function drawCalendarCanvasItem('),html.indexOf('function drawStatsStoryCalendar('));
  assert.match(html,/--t-role-kp:/);
  assert.match(html,/--t-role-pl:/);
  assert.match(palette,/statsExportRoleColors\(theme\)/);
  assert.match(palette,/key==="both"\?colorMixForCanvas\(colors\.kp,colors\.pl/);
  assert.match(item,/setLineDash\(\[3,2\]\)/);
  assert.match(item,/if\(plan\)[\s\S]*?globalAlpha=\.84/);
});

test('dense textual agenda keeps explicit KP/PL identity and Round105 is wired into GitHub Actions',()=>{
  const agenda=extractFunction('drawPlannerYearAgendaBlock');
  assert.match(agenda,/statsEventRoleLabel\(event\)/);
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
  assert(workflow.includes('round105-calendar-role-color-contract.test.cjs'));
});
