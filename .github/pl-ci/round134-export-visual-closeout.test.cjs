'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=(html.match(/<style id="visual-comfort-pass5-v198">([\s\S]*?)<\/style>/)?.[1]||"")+"\n"+(html.match(/<style id="real-page-acceptance-v199">([\s\S]*?)<\/style>/)?.[1]||"");
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round134: final preview has readable headers, state, labels and no dashed upload-like outline',()=>{
 assert(css,'fifth-pass scoped CSS must exist');
 for(const token of ['.ux-export-preview-copy span','.ux-export-preview-statebar span','.ux-export-preview-layout-hint','.ux-export-preview-page-label','.export-live-preview-page-label','.records-recap-preview-page>span'])assert(css.includes(token),token);
 assert.match(css,/\.ux-export-preview-stage\{[^}]*border:1px solid var\(--t-line,#d9dfd9\)!important/);
 assert.match(css,/--ui-export-read:11\.5px/);
});
test('Round134: failure diagnostics are bounded without hiding preview/footer or dropping text',()=>{
 assert.match(css,/\.ux-export-feedback\{[^}]*max-height:min\(180px,26dvh\);overflow:auto/);
 assert.match(css,/\.ux-export-preview-copy\{[^}]*overflow-y:auto/);
 assert.match(css,/\.ux-export-preview-statebar\{[^}]*overflow:auto/);
 assert.match(css,/#uxExportPreviewBackdrop \.ux-export-preview-foot \.right>\.btn\{min-height:44px!important/);
 assert.match(css,/\.ux-export-preview-foot>\.muted\{[^}]*overflow:auto/);
});
test('Round134: PC gallery names and export empty states keep all readable content',()=>{
 for(const token of ['.entity-gallery-choice-copy strong','.entity-gallery-choice-copy small','.entity-gallery-choice>span','.export-preview-empty','.export-live-preview-error'])assert(css.includes(token),token);
 assert.match(css,/\.entity-gallery-choice-copy strong\{font-size:11\.5px!important/);
 assert.match(css,/\#entityGalleryChoiceList\.entity-gallery-choice-list\{grid-template-columns:1fr!important;?\}/);
 assert.doesNotMatch(css,/text-overflow:ellipsis|display:none!important/);
});
test('Round134: visual-only scope, existing export paths, CI, schema remain unchanged',()=>{
 assert.doesNotMatch(css,/<(?:button|script|input|select)|localStorage|indexedDB|addEventListener|function\s/);
 assert.match(html,/window\.PLUnifiedExportPreview=openUnifiedExportPreview/);
 assert.match(html,/window\.PLExportLivePreview=/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
 assert.match(workflow,/round134-export-visual-closeout\.test\.cjs/);
 assert.match(workflow,/round134-export-visual-closeout-browser\.cjs/);
});
