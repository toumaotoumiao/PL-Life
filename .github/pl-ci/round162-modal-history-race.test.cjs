'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8'),browser=fs.readFileSync(path.join(__dirname,'round162-modal-history-race-browser.py'),'utf8');
test('programmatic close reuses a modal history slot instead of queuing Back',()=>{
 assert.match(html,/let modalHistorySlotIdle = false;/);
 assert.match(html,/modalHistorySlotIdle && !state\.modal/);
 const block=html.slice(html.indexOf('function consumeSurfaceHistory(id) {'),html.indexOf('const modalSurfaceLifecycleObserved'));
 assert.match(block,/history\.replaceState\(/);
 assert.doesNotMatch(block,/history\.back\s*\(/);
 assert.match(html,/An obsolete modal marker is not permission to traverse again/);
});
test('browser contract recreates queued Back and checks PC and plan plus real Back',()=>{
 for(const term of ['closePcEditor({force:true})','closePlanEditor()','openPcEditor("audit-pc-b")','openPlanEditor("audit-plan-b")','real browser Back dismisses PC editor','real browser Back dismisses plan editor','delayed cleanup does not dismiss next PC editor','no delayed programmatic Back while switching PC editors','no delayed programmatic Back while switching plan editors'])assert.ok(browser.includes(term),term);
 assert.match(workflow,/round162-modal-history-race-browser.py/);
 assert.match(workflow,/Round162:\$\{\{ steps\.round162_browser\.outcome \}\}/);
});
test('real Chromium history test navigates to the actual served app and reports history state on failure',()=>{
 assert.match(browser,/page\.goto\(origin\+'\/index\.html'/);
 assert.match(browser,/prepare_synthetic_origin\(page,bootstrap=False\)/);
 assert.match(browser,/page\.wait_for_function\(/);
 assert.match(browser,/historyLength:history\.length/);
 assert.match(browser,/modalGuardCreated:history\.state\?\.modalGuardCreated===true/);
 assert.doesNotMatch(browser,/page\.set_content\(/);
});
test('release version, schema, and CoC7 rule gate still present',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.match(version,/^\d+(?:\.\d+){3}$/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/function syncPcExcelExportUi\(/);
});
