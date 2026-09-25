'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=html.match(/<style id="visual-comfort-pass3-v196">([\s\S]*?)<\/style>/)?.[1]||'';
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round132 scoped plan/calendar readability and safe unschedule touch zone',()=>{
 assert(css,'third visual comfort sheet exists');
 for(const token of ['#plansView .plan-row-title','#plansView .plan-row-meta','#plansView .week-board .calendar-event-name','#plansView .week-board .calendar-event-remove','#plansView .week-board .calendar-event-meta>span','@media(max-width:760px)'])assert(css.includes(token),`missing ${token}`);
 assert.match(css,/\.calendar-event\{padding:7px 35px 7px 8px!important/);
 assert.match(css,/\.calendar-event-remove\{[^}]*width:28px!important;height:28px!important/);
 assert.match(css,/\.calendar-event-remove\{[^}]*width:30px!important;height:30px!important/);
 assert.match(css,/\.plan-row-action\{min-height:42px!important/);
 assert.match(css, /\.calendar-event-remove\{position:relative!important;top:auto!important;right:auto!important/);
});
test('Round132 record Log, long-note and mobile read/edit layout',()=>{
 for(const token of ['#recordsView .record-view-summary','#recordsView .record-view-fact strong','#recordsView .record-view-log-note','#recordsView .record-view-log-links a','#recordsView .record-view-extra p','#recordsView .multi-log-row','#recordsView .multi-log-remove','#recordsView .table-record-collapse-strip'])assert(css.includes(token),`missing ${token}`);
 assert.match(css,/\.record-view-extra p\{[^}]*white-space:pre-wrap!important;overflow-wrap:anywhere!important/);
 assert.match(css,/\.record-view-summary\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.multi-log-remove\{grid-column:3;grid-row:1\/3;[^}]*width:42px!important/);
 assert.doesNotMatch(css,/<(?:script|button|input|select)|\blocalStorage\b|\bindexedDB\b|addEventListener|function\s/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
test('Round132 static and browser checks ship in release CI, not tied to a historical app version',()=>{
 assert.match(workflow,/round132-plan-record-visual\.test\.cjs/);
 assert.match(workflow,/round132-plan-record-visual-browser\.cjs/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
});
