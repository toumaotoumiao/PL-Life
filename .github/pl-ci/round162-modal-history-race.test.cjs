'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8'),browser=fs.readFileSync(path.join(__dirname,'round162-modal-history-race-browser.py'),'utf8');
test('programmatic modal cleanup cannot close the next editor on delayed popstate',()=>{
 assert.match(html,/let pendingInternalModalHistoryBack = 0;/);
 assert.match(html,/if \(pendingInternalModalHistoryBack > 0\) \{/);
 assert.match(html,/pendingInternalModalHistoryBack--;/);
 assert.match(html,/if \(stillOpen\) restorePoppedSurfaceGuard\(stillOpen\);/);
 assert.match(html,/if \(successor && successor !== id\) \{/);
});
test('browser contract recreates queued Back and checks PC and plan plus real Back',()=>{
 for(const term of ['closePcEditor({force:true})','closePlanEditor()','openPcEditor("audit-pc-b")','openPlanEditor("audit-plan-b")','real browser Back dismisses PC editor','real browser Back dismisses plan editor','delayed cleanup does not dismiss next PC editor'])assert.ok(browser.includes(term),term);
 assert.match(workflow,/round162-modal-history-race-browser.py/);
 assert.match(workflow,/Round162:\$\{\{ steps\.round162_browser\.outcome \}\}/);
});
test('release version, schema, and CoC7 rule gate still present',()=>{
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.match(version,/^\d+(?:\.\d+){3}$/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/function syncPcExcelExportUi\(/);
});
