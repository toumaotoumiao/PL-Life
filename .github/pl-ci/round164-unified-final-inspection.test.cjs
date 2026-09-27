'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8'),script=fs.readFileSync(path.join(__dirname,'round164-unified-final-inspection-browser.py'),'utf8');
test('all final export surfaces share one pixel-size inspection switch',()=>{
 assert.match(html,/id="uxExportPreviewSizeBtn"[^>]*aria-pressed="false"[^>]*aria-controls="uxExportPreviewStage"/);
 assert.match(html,/function syncUnifiedExportInspectionSize\(pending\)/);
 assert.match(html,/uxPendingExport=\{previewSize:uxExportPreviewSizeMode,/);
 assert.match(html,/syncUnifiedExportLayoutButtons\(pending\);syncUnifiedExportInspectionSize\(pending\)/);
 assert.match(html,/#uxExportPreviewSizeBtn\{min-height:44px!important/);
 assert.match(html,/#uxExportPreviewStage\[data-preview-size="native"\][^{]*\{[^}]*overflow:auto/);
});
test('inspection only touches preview layout; source canvas stays exporter input',()=>{
 assert.match(html,/renderUnifiedExportStage\(pending\)[\s\S]*?stage\.appendChild\(canvas\)/);
 assert.match(html,/function preparePendingExportBlobs\(pending\)\{const payload=resolveUnifiedExportPayload\(pending,false\)/);
 assert.match(html,/const previousLeft=stage\.scrollLeft,previousTop=stage\.scrollTop/);
 assert.match(html,/stage\.scrollLeft=Math\.min\(previousLeft/);
 for(const label of ['PC','模组','个人统计'])assert.ok(html.includes(label));
});
test('actual browser checks multi page, long, mobile width and canvas pixel immutability',()=>{
 for(const term of ['PLUnifiedExportPreview','fit keeps document width','native 1:1 pixels','long remains inside modal','pages retain native mode and canvases','no runtime errors'])assert.ok(script.includes(term),term);
 assert.match(workflow,/round164-unified-final-inspection-browser\.py/);
 assert.match(workflow,/Round164:\$\{\{ steps\.round164_browser\.outcome \}\}/);
});
test('version and cache remain synchronous; old version preserved',()=>{
 const v=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.equal(v,'8.1.12.231');assert.ok(sw.includes('v'+v));assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 for(const n of ['228','229'])assert.equal((html.match(new RegExp('<strong class="version-log-version">v8\\.1\\.12\\.'+n+'</strong>','g'))||[]).length,1);
});
