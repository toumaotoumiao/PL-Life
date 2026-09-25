'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('integrated recap desktop composer gives the 1080px preview enough room',()=>{
  assert.match(html,/\.records-recap-modal\{[^}]*width:min\(1540px,calc\(100vw - 24px\)\)/);
  assert.match(html,/grid-template-columns:minmax\(300px,340px\) minmax\(0,1fr\)/);
  assert.match(html,/\.records-recap-preview-pane\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(html,/\.records-recap-preview-page\{[^}]*max-width:1080px/);
  assert.match(html,/\.records-recap-preview-page canvas\{[^}]*width:min\(100%,1080px\)/);
});

test('real-time recap preview now shows all pages in a continuous scroll stack',()=>{
  assert(html.includes('id="recordsRecapPageIndicator"'),'recordsRecapPageIndicator missing');
  assert.doesNotMatch(html,/id="recordsRecapPrev"|id="recordsRecapNext"/);
  assert.match(html,/function renderPreviewPages\(\)[\s\S]*?PLExportLivePreview\.render\(\{stage:preview,paged:\(\)=>previewCanvases,continuous:\(\)=>buildContinuousRecapCanvas\(\)/);
  assert.match(html,/if\(indicator\)indicator\.textContent=result\.ok\?/);
  assert.match(html,/previewCanvases=canvases;const live=renderPreviewPages\(\);/);
});

test('recap preview has a focus mode and old compact default migrates to standard',()=>{
  assert(html.includes('id="recordsRecapFocus"'));
  assert.match(html,/\.records-recap-modal\.preview-focus \.export-composer-controls\{display:none\}/);
  assert.match(html,/layoutVersion:2[\s\S]*?density:'standard'/);
  assert.match(html,/Number\(src\.layoutVersion\|\|0\)<2&&x\.density==='compact'\)x\.density='standard'/);
});

test('final export still contains all generated recap pages and remains read-only',()=>{
  assert.match(html,/function finalPreview\(\)[\s\S]*?const canvases=buildCanvases\(\)[\s\S]*?PLUnifiedExportPreview\(canvases/);
  const block=html.slice(html.indexOf("const PREF='tomato_pl_records_recap_pref_v1'"),html.indexOf('window.PLRecordsRecapOpen=open;')+40);
  assert(!/runRecords\s*=|\.push\([^\n]*runRecords|localStorage\.setItem\([^,]*trpg_pl_profile_archive_v1/.test(block),'recap composer must not mutate archive data');
});
