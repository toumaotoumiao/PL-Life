'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('public image export no longer blocks entry with a privacy dialog',()=>{
  assert.doesNotMatch(html,/const PRIVACY_EXPORT_ACK_KEY=/);
  assert.doesNotMatch(html,/privacyExportBypassOnce/);
  assert.doesNotMatch(html,/appSelect\("当前展示图片可能包含人物姓名/);
  assert.match(html,/不再在进入导出面板前弹阻断式隐私询问/);
});

test('all current public image composers share an inline privacy switch',()=>{
  const m=html.match(/const SENSITIVE_EXPORT_FINAL_SELECTOR="([^"]+)"/);
  assert(m,'missing final export selector');
  for(const id of ['statsExportNowBtn','selfIntroExportNowBtn','plannerYearShowcaseNow','hoExportComposerNow','recordShowcaseExport','recordsRecapExport','entityShowcaseExport']) assert(m[1].includes('#'+id),id+' missing');
  assert.match(html,/export-inline-privacy-row/);
  assert.match(html,/data-export-inline-privacy-toggle/);
  assert.match(html,/隐私导出已开启/);
  assert.match(html,/隐私导出已关闭/);
});

test('inline privacy changes are display-only and redraw open previews',()=>{
  assert.match(html,/setPrivacyMaskExplicit\(Boolean\(input\.checked\)\)/);
  assert.match(html,/refreshSensitiveExportPreviewsForPrivacy\(\)/);
  assert.match(html,/pl:export-privacy-changed/);
  assert.doesNotMatch(html,/data-export-inline-privacy-toggle[\s\S]{0,800}saveState\(/);
});

test('entity dossier and integrated recap listen for privacy redraws',()=>{
  assert.match(html,/pl:export-privacy-changed'[\s\S]{0,220}entityShowcaseBackdrop/);
  assert.match(html,/pl:export-privacy-changed'[\s\S]{0,220}recordsRecapBackdrop/);
});
