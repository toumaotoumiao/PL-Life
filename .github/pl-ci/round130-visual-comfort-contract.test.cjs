'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=html.match(/<style id="visual-comfort-pass1-v194">([\s\S]*?)<\/style>/)?.[1];
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round130 first visual pass is scoped to presentation and preserves old visual contract',()=>{
  assert.ok(styles,'scoped visual polish style exists');
  for(const marker of ['--ui-comfort-note:11.5px','--ui-comfort-label:12px','--ui-comfort-touch:42px','.export-center-head span','.export-center-section-head span','.export-preview-head span','.ho-export-composer.v154-overlay','.export-scope-copy strong','.export-inline-layout-copy span','.editor-subdetails-v181>summary small','.stats-footnote','.settings-purpose-heading p'])
    assert.ok(styles.includes(marker),`missing visual scope ${marker}`);
  assert.match(styles,/\.export-center-section-head span\{[^}]*overflow-wrap:anywhere/);
  assert.match(styles,/@media\(max-width:760px\)\{[\s\S]*?body\{padding-bottom:0!important\}/);
  assert.match(styles,/\.export-option-grid label,\.export-preset-grid button,\.stats-segmented button\)\{min-height:var\(--ui-comfort-touch\)!important\}/);
  assert.match(html,/style id="ui-reduction-closeout-v182"/);
  assert.match(html,/style id="formal-visual-acceptance-round4-v186"/);
  assert.match(html,/window\.PLExportLivePreview=/);
});
test('Round130 does not change data, exporter branches, schema or add new controls',()=>{
 const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
 assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 assert.match(html,/window\.PLRequireUnifiedExportPreview=function/);
 assert.match(html,/buildStatsContinuousCanvas/);
 assert.match(html,/entityContinuousLongCanvas/);
 assert.doesNotMatch(styles,/<button|<input|<select|<script|localStorage|indexedDB|function\s+|addEventListener/);
});
test('Round130 static and Chromium geometry checks stay in Actions for future releases',()=>{
 assert.match(workflow,/round130-visual-comfort-contract\.test\.cjs/);
 assert.match(workflow,/round130-visual-comfort-browser\.cjs/);
});
