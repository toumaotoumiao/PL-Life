'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('legacy privacy preflight re-entry machinery is retired',()=>{
  assert.doesNotMatch(html,/const PRIVACY_EXPORT_ACK_KEY=/);
  assert.doesNotMatch(html,/function sensitiveExportResumeRef\(/);
  assert.doesNotMatch(html,/privacyExportBypassOnce/);
  assert.doesNotMatch(html,/appSelect\("当前展示图片可能包含人物姓名/);
});

test('sensitive export panels receive the shared inline privacy control',()=>{
  assert.match(html,/const SENSITIVE_EXPORT_FINAL_SELECTOR=/);
  for(const id of ['statsExportNowBtn','selfIntroExportNowBtn','plannerYearShowcaseNow','hoExportComposerNow','recordShowcaseExport','recordsRecapExport','entityShowcaseExport']) assert.match(html,new RegExp('#'+id));
  assert.match(html,/function syncInlineExportPrivacyControls\(/);
  assert.match(html,/data-export-inline-privacy-toggle/);
});

test('privacy changes immediately refresh current export previews',()=>{
  assert.match(html,/function refreshSensitiveExportPreviewsForPrivacy\(/);
  for(const fn of ['renderSelfIntroExportCenter','renderStatsExportCenter','renderPlannerYearShowcasePanel','renderRecordShowcaseComposer','renderHoOrganizerExportComposer']) assert.match(html,new RegExp(fn+'\\(\\)'));
  assert.match(html,/pl:export-privacy-changed/);
});
