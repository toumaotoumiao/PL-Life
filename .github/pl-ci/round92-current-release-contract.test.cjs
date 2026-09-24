'use strict';
// Current-release contract: version-agnostic checks that must remain true for every release.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function currentVersion(){const m=html.match(/const APP_UI_VERSION = "([0-9.]+)";/);assert(m,'APP_UI_VERSION missing');return m[1];}
function capture(label,re){const m=html.match(re);assert(m,`${label} missing`);return m[1];}

test('current release version is identical across visible runtime labels and service worker',()=>{
 const v=currentVersion();
 const fields=[
  ['data health',/id="appVersionHealthValue">v([0-9.]+)</],
  ['settings summary',/id="versionUpdateSummary">v([0-9.]+)/],
  ['page runtime',/id="versionRuntimeDetails"><span>页面版本：v([0-9.]+)/],
  ['footer compact',/class="footer-meta-inline">当前版本 v([0-9.]+)/],
  ['footer detail',/class="footer-meta">版本：v([0-9.]+)　·　更新时间：/],
  ['first release note',/id="releaseNotesBox"><div class="version-log-item"><strong class="version-log-version">v([0-9.]+)</]
 ];
 for(const [label,re] of fields)assert.equal(capture(label,re),v,`${label} drifted from APP_UI_VERSION`);
 assert(sw.includes('CACHE_NAME=`${CACHE_PREFIX}v'+v+'`'),'service worker cache version drifted');
});

test('current showcase foundations are loaded and cached as the same application shell',()=>{
 for(const file of ['run-event.js','showcase-core.js','stats-query-bridge.js']){
  assert(html.includes(`<script src="./${file}"></script>`),`${file} must be loaded by index.html`);
  assert(sw.includes(`"./${file}"`),`${file} must be cached by the service worker`);
  assert(fs.existsSync(path.join(root,file)),`${file} must exist in repository root`);
 }
});

test('all current public showcase flows converge on the unified final preview',()=>{
 const contracts=[
  ['year calendar','openPlannerYearShowcasePreview'],
  ['single record','openRecordShowcaseFinalPreview'],
  ['personal preference','exportSelfIntroImage'],
  ['weekly availability','async function exportWeeklyAvailabilityImage'],
  ['statistics','exportStatsImage=async function'],
  ['organizer','exportHoOrganizerImage=async function'],
  ['PC/module dossier','async function finalPreview()']
 ];
 for(const [label,marker] of contracts){
  const i=html.indexOf(marker);assert(i>=0,`${label} entrypoint missing`);
  const tail=html.slice(i,i+12000);
  assert(/(?:PLRequireUnifiedExportPreview|PLUnifiedExportPreview|openUnifiedExportPreview)/.test(tail),`${label} must use unified final preview`);
 }
 assert.match(html,/exportPcSimpleCard=async function\([\s\S]*?PLPCShowcaseOpenDraft/,'legacy PC card calls must route into the unified dossier composer');
 assert(html.includes('window.PLUnifiedExportPreview=openUnifiedExportPreview'));
 assert(html.includes('window.PLRequireUnifiedExportPreview=function'));
});

test('multi-page image export keeps ZIP fallback and PNG compatibility conversion',()=>{
 assert(html.includes('id="uxExportPreviewZip"'));
 assert.match(html,/async function exportPendingAsZip\([\s\S]*?pcMakeZipEntries/);
 assert.match(html,/async function preparePendingExportBlobs\([\s\S]*?canvasToPngBlobCompat\(canvas\)/);
 assert.match(html,/浏览器只接受了 \$\{accepted\}\/\$\{blobs\.length\} 个下载请求/);
});

test('CI tests and workflows are part of the release contract rather than version-specific user data',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert(workflow.includes('round92-current-release-contract.test.cjs'));
 assert(!html.includes('.github/pl-ci/round92-current-release-contract.test.cjs'),'CI implementation must not be shipped into page markup');
});
