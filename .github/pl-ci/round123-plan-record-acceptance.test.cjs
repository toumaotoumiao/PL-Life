'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function between(start,end){
  const a=html.indexOf(start), b=html.indexOf(end,a+start.length);
  assert.ok(a>=0,`missing start: ${start}`);
  assert.ok(b>a,`missing end: ${end}`);
  return html.slice(a,b);
}

test('Round123 restores mobile plan action touch size and keeps a single empty action row',()=>{
  assert.match(html,/style id="formal-visual-acceptance-round3-v185"/);
  assert.match(html,/@media\(max-width:760px\)[\s\S]*?#plansView \.plan-row-action\{min-width:52px!important;min-height:42px!important/);
  assert.match(html,/empty-actions plan-record-empty-actions/);
});

test('mobile plan arrange jumps from queue to the week calendar',()=>{
  const handler=between('const pick = e.target.closest("[data-pick-plan]");','const archive = e.target.closest("[data-archive-plan-row]");');
  assert.match(handler,/setPlannerMobileSection\("calendar", \{ persist: false, scroll: false \}\)/);
  assert.match(handler,/els\.planWeek\?\.scrollIntoView\(\{ behavior: preferredScrollBehavior\(\), block: "start" \}\)/);
});

test('record first-use empty state can return directly to the module input',()=>{
  const render=between('function renderRunRecords(options = {})','function recordModuleOptionLabel');
  assert.match(render,/data-record-empty-new>＋ 新建跑团记录/);
  const click=between('els.recordsBoard.addEventListener("click", e => {','const moreTables=e.target.closest');
  assert.match(click,/data-record-empty-new/);
  assert.match(click,/els\.newModuleName\?\.scrollIntoView/);
  assert.match(click,/els\.newModuleName\?\.focus/);
});

test('record header gives full width to the table title and moves updated time to the footer',()=>{
  const card=between('function recordTableHTML(r, index, nextRecordId = "", allowCreateNext = true) {','function newModuleSuggestionRows');
  const readonly=between('function recordReadonlyBodyHTML(r) {','function recordTableHTML');
  assert.doesNotMatch(card,/table-record-head-actions/);
  assert.match(readonly,/record-updated-meta">更新 /);
  assert.match(card,/record-updated-meta">更新 /);
  assert.doesNotMatch(readonly,/记录 · \$\{escapeHTML\(String\(r\.id\)\.slice\(-6\)\)\}/);
  assert.doesNotMatch(card,/记录 · \$\{escapeHTML\(String\(r\.id\)\.slice\(-6\)\)\}/);
});

test('long plan and table names expose full native titles without changing stored data',()=>{
  const plan=between('function planListItemHTML(plan)','function renderPlannerCalendars');
  const recordTitle=between('function recordHeaderTitle(r, index)','let recordLastQueryResult');
  assert.match(plan,/class="plan-row-title" title="\$\{escapeHTML\(\[title,plan\.tableName\]/);
  assert.match(recordTitle,/class="record-title-name" title="\$\{escapeHTML\(tableName\)\}"/);
});

test('Round123 is presentation-only and preserves release history plus schema 26',()=>{
  const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  assert.match(html,/const APP_UI_VERSION = "\d+\.\d+\.\d+\.\d+";/);
  assert.match(html,/version-log-version">v8\.1\.12\.185/);
  assert.match(html,/version-log-version">v8\.1\.12\.184/);
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
});
