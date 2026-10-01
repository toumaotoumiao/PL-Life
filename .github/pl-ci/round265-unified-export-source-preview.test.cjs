const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const panels=[
  'selfIntroExportPanel','statsExportPanel','plannerYearShowcasePanel',
  'recordShowcaseBackdrop','entityShowcaseBackdrop','recordsRecapBackdrop','hoExportComposerPanel'
];
const stages=[
  'selfIntroExportPreviewStage','statsExportPreviewStage','plannerYearShowcasePreview',
  'recordShowcasePreview','entityShowcasePreview','recordsRecapPreview','hoExportComposerPreview'
];

test('all seven primary image-export surfaces are registered with the same capability contract',()=>{
  assert.match(html,/const UX_EXPORT_SOURCE_PANELS=\["selfIntroExportPanel","statsExportPanel","plannerYearShowcasePanel","recordShowcaseBackdrop","entityShowcaseBackdrop","recordsRecapBackdrop","hoExportComposerPanel"\]/);
  for(const id of panels)assert.match(html,new RegExp(`${id}`));
  for(const id of stages)assert.match(html,new RegExp(`${id}`));
  assert.match(html,/privacy:true,\s*layout:true,\s*livePreview:true,\s*sourceInspection:true,\s*finalPreview:"PLUnifiedExportPreview"/s);
  assert.match(html,/window\.PLImageExportCapabilities=UX_IMAGE_EXPORT_CAPABILITIES/);
});

test('source preview inspection is generic, touch-sized and does not duplicate the existing statistics control',()=>{
  assert.match(html,/dataset\.exportInlinePreviewSize="1"/);
  assert.match(html,/button\.className="btn small export-source-preview-size-btn"/);
  assert.match(html,/panelId!=="statsExportPanel"/);
  assert.match(html,/id="statsExportSizeBtn"/);
  assert.match(html,/\.export-preview-head \.btn\.export-source-preview-size-btn\{min-height:44px!important;height:auto!important/);
  assert.match(html,/stage\.dataset\.previewSize=stage\.dataset\.previewSize==="native"\?"fit":"native"/);
  assert.match(html,/native\?"适应宽度":"原尺寸查看"/);
});

test('native inspection stays inside the preview stage and preserves canvas pixels',()=>{
  assert.match(html,/\.export-preview-stage\[data-preview-size="native"\]\{place-items:start;justify-items:start;overflow:auto;overscroll-behavior:contain\}/);
  assert.match(html,/--export-native-page-width/);
  assert.match(html,/Number\(canvas\.width\)/);
  assert.match(html,/\.export-preview-canvas-surface canvas\{width:100%!important;max-width:none!important;height:auto!important\}/);
  assert.match(html,/if\(typeof syncSourceExportPreviewInspection==="function"\)syncSourceExportPreviewInspection\(stage\)/);
});

test('asynchronous export dialogs receive the same controls after creation or reopening',()=>{
  assert.match(html,/const exportLayoutObserver=new MutationObserver/);
  assert.match(html,/syncInlineExportLayoutControls\(\);syncInlineExportPreviewSizeControls\(\)/);
  assert.match(html,/window\.PLSourceExportInspection=Object\.freeze/);
});

test('unified final preview keeps its independent native-size inspection',()=>{
  assert.match(html,/id="uxExportPreviewSizeBtn"/);
  assert.match(html,/function syncUnifiedExportInspectionSize\(pending\)/);
  assert.match(html,/uxExportPreviewSizeMode=uxExportPreviewSizeMode==="native"\?"fit":"native"/);
});
