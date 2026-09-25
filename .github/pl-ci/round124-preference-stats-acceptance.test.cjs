'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function part(begin,end){const i=html.indexOf(begin);assert(i>=0,`missing ${begin}`);const j=html.indexOf(end,i+begin.length);assert(j>i,`missing ${end}`);return html.slice(i,j);}
const rules=part('<style id="formal-visual-acceptance-round4-v186">','</style>');
test('Round124 retains complete original preference credits behind a direct disclosure control',()=>{
 const block=part('<details class="self-intro-credit-details">','</details>');
 assert.match(block,/<summary>参考来源<\/summary>/);
 assert.match(block,/@云染、@冒冒、@江鸿、@削面及匿名或是不知名作者/);
 assert.match(block,/如有遗漏，欢迎补充来源信息/);
 assert.doesNotMatch(block, /\sopen(?:\s|=|>)/);
});
test('statistics source reconciliation is opt-in, read-only, and still exposes its existing action/results IDs',()=>{
 const block=part('<details class="stats-reconcile-panel"','</details>');
 assert.match(block, /<summary class="stats-reconcile-summary">/);
 const summary=block.split('</summary>')[0];
 assert.doesNotMatch(summary,/<button/,'nested summary action must remain separate');
 assert.match(block, /id="statsReconcileBtn"/);
 assert.match(block, /id="statsReconcileResults"/);
 assert.match(html, /function runStatsReconciliation\(\)/);
 assert.doesNotMatch(block, /\sopen(?:\s|=|>)/);
});
test('both three-choice mobile presets use one row and preserve real touch targets',()=>{
 assert.match(rules, /@media\(max-width:760px\)/);
 assert.match(rules, /:is\(#selfIntroExportPanel,#statsExportPanel\) \.export-preset-grid-compact\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}/);
 assert.match(rules, /:is\(#selfIntroExportPanel,#statsExportPanel\) \.export-preset-grid button\{min-height:42px!important/);
 assert.match(rules, /:is\(#selfIntroExportPanel,#statsExportPanel\) \.export-option-grid label\{min-height:42px!important\}/);
});
test('disclosure and export readability do not reduce mobile close, option or summary targets',()=>{
 assert.match(rules, /\.self-intro-credit-details>summary\{min-height:40px/);
 assert.match(rules, /\.stats-reconcile-summary\{min-height:44px/);
 assert.match(rules, /\.export-center-close\{width:40px!important;height:40px!important/);
 assert.match(rules, /\.export-preview-head span,[\s\S]*?font-size:10\.5px!important/);
});
test('Round123 historic release remains guarded without pinning the live version',()=>{
 const old=fs.readFileSync(path.join(root,'.github/pl-ci/round123-plan-record-acceptance.test.cjs'),'utf8');
 assert.doesNotMatch(old, /APP_UI_VERSION = "8\\\.1\\\.12\\\.185"/);
 assert.match(old, /version-log-version">v8\\\.1\\\.12\\\.185/);
 const version=html.match(/const APP_UI_VERSION = "(\d+\.\d+\.\d+\.\d+)"/);
 assert(version,'current version declaration missing');
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert(sw.includes('CACHE_NAME=`${CACHE_PREFIX}v'+version[1]+'`'),'service worker must share current version');
 assert.match(html,/version-log-version">v8\.1\.12\.186/,'historic release note must remain');
});
