'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=html.match(/<style id="real-page-acceptance-v199">([\s\S]*?)<\/style>/)?.[1]||'';
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round135: mobile module and record search bars have one actual grid row',()=>{
 assert(css);
 assert.match(css,/#modulesView \.module-native-controls>\.filter-primary-row,/);
 assert.match(css,/#recordsView \.records-filter-workbench>\.filter-primary-row\{/);
 assert.match(css,/grid-template-areas:none!important/);
 assert.match(css,/grid-template-rows:minmax\(44px,auto\)!important/);
 for(const token of ['grid-column:1!important','grid-column:2!important','grid-column:3!important','data-filter-toggle="modules"','data-filter-toggle="records"','.module-mobile-more-btn','.mobile-page-tools-btn'])assert(css.includes(token),token);
});
test('Round135: record counts and context return remain available',()=>{
 assert.match(html,/count\.id = "recordsSearchCount"/);
 assert.match(html,/id="moduleRecordReturnBtnV129"/);
 assert.match(html,/id="moduleFilterSummary"/);
 assert.doesNotMatch(css,/display:none!important|visibility:hidden!important/);
});
test('Round135: Settings overview version uses live release instead of stale fixed number',()=>{
 assert.match(html,/id="settingsOverviewVersion">v8\.1\.12\.\d+<\/strong>/);
 assert.match(html,/versionEl\.textContent = `v\$\{APP_UI_VERSION\}`/);
 assert.doesNotMatch(html,/id="settingsOverviewVersion">v8\.1\.12\.110/);
});
test('Round135: visual release contract remains data-safe and CI-wired',()=>{
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
 assert.match(workflow,/round135-real-page-acceptance\.test\.cjs/);
 assert.match(workflow,/round135-real-page-acceptance-browser\.cjs/);
});
