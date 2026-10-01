"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../.."),html=fs.readFileSync(path.join(root,"index.html"),"utf8"),sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),ci=fs.readFileSync(path.join(root,".github/workflows/pl-browser-synthetic.yml"),"utf8"),runner=fs.readFileSync(path.join(__dirname,"round161-stats-preview-inspection-browser.py"),"utf8");
test("statistics image inspection has an accessible native-size switch",()=>{
 assert.match(html,/id="statsExportSizeBtn"[^>]*aria-pressed="false"[^>]*aria-controls="statsExportPreviewStage"/);
 assert.match(html,/function syncStatsPreviewSize\(\)/);
 assert.match(html,/dataset\.previewSize==="native"/);
 assert.match(html,/#statsExportPanel #statsExportSizeBtn\{min-height:44px!important/);
});
test("source preview can grow internally without viewport overflow or losing drag geometry",()=>{
 assert.match(html,/#statsExportPreviewStage\[data-preview-size="native"\]\{[^}]*overflow:auto/);
 assert.match(html,/--stats-native-page-width/);
 assert.match(html,/stage\.scrollLeft=Math\.min\(previousStageX/);
 assert.match(html,/syncStatsPreviewSize\(\);if\(panel\)panel\.scrollTop/);
});
test("real browser checks source and final image drawing with isolated data",()=>{
 for(const term of ["drawStatsStoryBlock","await exportStatsImage()","setPrivacyMaskExplicit(true)","masked long source/final geometry"]){
  assert.ok(runner.includes(term),term);
 }
 assert.match(runner,/source==final/);assert.match(runner,/native view scrolls internally not document/);
 assert.match(ci,/Round161 statistics source and final image geometry acceptance/);
 assert.match(ci,/round161-stats-preview-inspection-browser.py/);
 assert.match(ci,/Round161:\$\{\{ steps\.round161_browser\.outcome \}\}/);
});
test("current release and cache aligned; previous version remains one history entry",()=>{
 const v=html.match(/const APP_UI_VERSION = "([\d.]+)";/)[1];assert.match(v,/^\d+(?:\.\d+){3}$/);assert.ok(sw.includes("v"+v));
 for(const r of ["227","228"])assert.equal((html.match(new RegExp('<strong class="version-log-version">v8\\.1\\.12\\.'+r+'</strong>','g'))||[]).length,1);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
