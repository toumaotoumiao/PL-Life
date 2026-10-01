"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const runner=fs.readFileSync(path.join(__dirname,'round157-runtime-visual.py'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('year calendar remains readable with 57 real-rendered events and full-name access',()=>{
 assert.match(html,/\.stats-year-calendar\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/\.stats-day-event em\{[^}]*-webkit-line-clamp:2/);
 assert.match(html,/\.stats-day\.calendar-v2\.has-run:focus \.stats-day-event em/);
 assert.match(html,/title="\$\{escapeHTML\(item\.label\)\}"/);
 assert.match(html,/tabindex="0" aria-label=/);
 assert.match(html,/stats-month-mobile-events/);
 assert.match(html,/stats-month-mobile-event[\s\S]*stats-mobile-event-name/);
 assert.match(runner,/mobile month list lacks readable full names/);
});
test('run complete actual JS with synthetic data rather than CSS-only fixture',()=>{
 for(const name of ['normalizeRichModule','normalizePcArchive','normalizeRunRecord','normalizeRunPlan','switchView','toggleStatsExportCenter','openSettings'])assert(runner.includes(name));
 for(const id of [320,375,390,430,768,1024,1280,1440])assert(runner.includes(String(id)));
 for(const item of ["'mist'","'tomato'","'night'","'stats'","'pcs'","'modules'","'plans'","'records'"])assert(runner.includes(item));
 assert.match(runner,/seed\['records'\]==57/);assert.match(runner,/longestEvent/);assert.match(runner,/page\.screenshot/);
 assert.match(runner,/in-memory synthetic data|memory-mocked|in-memory storage mock/i);
 assert.match(workflow,/Round157 real application renderer visual acceptance[\s\S]*id: round157_browser/);
 assert.match(workflow,/"Round157:\$\{\{ steps\.round157_browser\.outcome \}\}"/);
});
test('release metadata and current schema compatible',()=>{
 const version=html.match(/const APP_UI_VERSION = "([0-9.]+)"/)?.[1];
 assert.match(version||'',/^8\.1\.12\.\d+$/);assert.ok(sw.includes('v'+version));assert.equal((html.match(new RegExp(`<strong class=\"version-log-version\">v${version.replaceAll('.','\\.')}<\/strong>`,'g'))||[]).length,1);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});

test('Round237 split visual runs require an explicit complete version-consistent matrix',()=>{const merger=fs.readFileSync(path.join(__dirname,'round237-visual-matrix-merge.py'),'utf8');assert.match(runner,/PL_VISUAL_WIDTHS/);assert.match(merger,/visual matrix incomplete or mixed application versions/);assert.match(merger,/referenced screenshot missing/);assert.match(workflow,/round237-visual-matrix-merge-test\.py/);});
