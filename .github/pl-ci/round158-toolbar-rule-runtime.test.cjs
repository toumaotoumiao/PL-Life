'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const runner=fs.readFileSync(path.join(__dirname,'round158-toolbar-rule-runtime.py'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('recap is a peer of the module create controls, not a third child in a two-column grid',()=>{
 const toolbar=html.match(/<div class="view-toolbar records-toolbar">([\s\S]*?)<div class="filter-workbench records-filter-workbench"/);assert.ok(toolbar);
 assert.match(toolbar[1],/<div class="view-toolbar-title">[\s\S]*?<\/div>\s*<button[^>]*id="recordsRecapBtn"/);
 assert.match(toolbar[1],/<div class="view-toolbar-actions records-toolbar-actions">[\s\S]*?id="newModuleNameCombobox"[\s\S]*?id="createModuleRecordBtn"/);
 assert.equal((toolbar[1].match(/id="recordsRecapBtn"/g)||[]).length,1);
 assert.match(html,/#recordsView > \.records-toolbar > #recordsRecapBtn\s*\{/);
 assert.match(html,/grid-template-areas:"recordTitle recordRecap recordCreate" "recordSearch recordSearch recordSearch"/);
 assert.match(html,/grid-template-areas:"recordTitle recordRecap" "recordCreate recordCreate" "recordSearch recordSearch"/);
});
test('rule selectors stay large, mobile PC rule is visible, plan rule popover anchored to drawer',()=>{
 assert.match(html,/#pcRuleMenu > summary\.btn\.small,[\s\S]*?#nativeModuleRuleMenu > summary\s*\{[\s\S]*?min-height:44px!important/);
 assert.match(html,/#pcEditorBackdrop \.pc-editor-head-actions/);
 assert.match(html,/#planEditorDrawer \.run-rule-menu > \.native-module-rule-popover\s*\{[\s\S]*?left:0;right:auto/);
 assert.match(html,/#planEditorDrawer \.run-rule-menu \.native-module-rule-grid\s*\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(runner,/openPcEditor/);assert.match(runner,/openPlanEditor/);assert.match(runner,/plan rule panel escaped its drawer/);
 for(const n of [320,375,390,430,768,1024,1280,1440]) assert.ok(runner.includes(String(n)));
 for(const theme of ['mist','tomato','night']) assert.ok(runner.includes(theme));
 assert.match(workflow,/Round158 actual-toolbar and rule picker visual acceptance[\s\S]*?id: round158_browser/);
 assert.match(workflow,/"Round158:\$\{\{ steps\.round158_browser\.outcome \}\}"/);
});
test('version, schema and previous release history remain consistent',()=>{
 const version=html.match(/const APP_UI_VERSION = "([0-9.]+)"/)?.[1];
 assert.match(version||'',/^8\.1\.12\.\d+$/);assert.ok(sw.includes('v'+version));
 assert.equal((html.match(new RegExp(`<strong class="version-log-version">v${version.replaceAll('.','\\.')}<\\/strong>`,'g'))||[]).length,1);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/<strong class="version-log-version">v8\.1\.12\.224<\/strong>/);
});
