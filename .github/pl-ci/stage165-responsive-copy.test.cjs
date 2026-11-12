'use strict';
// Stage165 tests only source and synthetic-browser contract. No user files are read.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html');
const tools=read('module-tools.html');
const browser=read('.github/pl-ci/stage165-responsive-copy-browser.cjs');
const workflow=read('.github/workflows/pl-browser-synthetic.yml');

test('advanced tools explain available actions in one complete sentence',()=>{
  assert(tools.includes('编辑模组资料、评分和招募信息，导出模组 Excel 和完整备份。跑团记录请在主页面管理。'));
  assert(!tools.includes('跑团记录请在主页面管理。<b>完整备份</b>。'));
});
test('advanced tools keep concrete, direct local-data risk warning',()=>{
  assert(tools.includes('清理网站数据、更换设备或使用隐私模式可能导致数据丢失。请定期导出完整备份。'));
});
test('settings, editor, export and status descriptions may wrap',()=>{
  const block=html.match(/<style id="stage165-responsive-copy-flow">([\s\S]*?)<\/style>/)?.[1];
  assert(block,'missing dedicated responsive copy stylesheet');
  for(const selector of ['.settings-modal','.pc-editor','.plan-editor-drawer','.native-module-editor','.module-advanced-shell','.export-center-panel','.settings-action-description','.status-warning-text'])
    assert(block.includes(selector),`missing ${selector}`);
  assert(block.includes('overflow-wrap:anywhere;white-space:normal'));
  assert(block.includes('.native-module-editor-head #nativeModuleEditorTitle'));
  assert(block.includes('@media(max-width:430px)'));
});
test('synthetic Chromium acceptance tests all eight widths and three themes',()=>{
  for(const width of [320,375,390,430,768,1024,1280,1440])assert(browser.includes(String(width)));
  for(const theme of ['mist','tomato','night'])assert(browser.includes(`'${theme}'`));
  for(const tab of ['profilesViewBtn','pcsViewBtn','modulesViewBtn','plansViewBtn','recordsViewBtn','selfIntroViewBtn','statsViewBtn'])assert(browser.includes(tab));
});
test('browser acceptance covers settings close, privacy, advanced tools, and errors',()=>{
  for(const marker of ['closeSettingsBtn','privacyMaskBtn','module-tools.html','pageerror','horizontal page overflow'])
    assert(browser.includes(marker),`missing ${marker}`);
});
test('new Chromium job is part of CI fail gate',()=>{
  assert(workflow.includes('node --test .github/pl-ci/stage165-responsive-copy.test.cjs'));
  assert(workflow.includes('node .github/pl-ci/stage165-responsive-copy-browser.cjs'));
  assert(workflow.includes('steps.responsive_copy_browser.outcome'));
});
test('browser script isolates synthetic data and reports anonymous metrics',()=>{
  assert(browser.includes('prepareSyntheticOrigin'));
  assert(browser.includes('PL_SYNTHETIC_REPORT_DIR'));
  assert(!browser.includes('localStorage.getItem('));
});
