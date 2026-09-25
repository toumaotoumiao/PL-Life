'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('Round121 removes dead single-language UI while keeping language plumbing intact',()=>{
  assert.match(html,/style id="formal-visual-acceptance-round1-v183"/);
  assert.match(html,/<label class="locale-setting-row" hidden>/);
  assert.doesNotMatch(html,/<div class="locale-foundation-note">/);
  assert.match(html,/id="interfaceLanguageSetting"/);
  assert.match(html,/id="runI18nAuditBtn"/);
});

test('settings rows keep readable hierarchy and mobile touch size',()=>{
  assert.match(html,/\.behavior-setting-list strong,\.behavior-setting-action strong,\.settings-callout strong\{font-size:11\.5px!important/);
  assert.match(html,/\.behavior-setting-list small,\.behavior-setting-action small,\.settings-callout span\{font-size:10\.5px!important/);
  assert.match(html,/@media\(max-width:760px\)[\s\S]*?\.behavior-setting-list label,\.behavior-setting-action\{min-height:52px!important/);
  assert.match(html,/跑团记录默认打开方式/);
});

test('clear-history action uses danger semantics and rapid-click guard',()=>{
  assert.match(html,/class="btn small danger-soft" id="clearRevisionHistoryBtn"/);
  assert.match(html,/antiRapidClickSelector\s*=\s*['"][^'"]*#clearRevisionHistoryBtn/);
  assert.match(html,/\.btn\.danger:focus-visible,\.btn\.danger-soft:focus-visible[\s\S]*?background:color-mix\(in srgb,var\(--t-danger-soft\) 72%,var\(--t-surface\)\)!important/);
});

test('privacy and share actions expose pressed state consistently',()=>{
  assert.match(html,/aria-label="开启隐私遮罩" aria-pressed="false"[^>]*data-mobile-privacy/);
  assert.match(html,/aria-label="开启分享模式" aria-pressed="false"[^>]*data-mobile-share/);
  assert.match(html,/data-mobile-share[\s\S]{0,2200}?setAttribute\("aria-pressed", shareModeEnabled \? "true" : "false"\)/);
  assert.match(html,/btn\.setAttribute\("aria-label", shareModeEnabled \? "退出分享模式" : "开启分享模式"\)/);
  assert.match(html,/data-mobile-share[\s\S]{0,2400}?setAttribute\("aria-label", shareModeEnabled \? "退出分享模式" : "开启分享模式"\)/);
});

test('preference cards follow the reduced 10px no-shadow visual language',()=>{
  assert.match(html,/\.intro-scale,\.intro-module-chip\{border-radius:var\(--ui-v182-radius\)!important;box-shadow:none!important\}/);
  assert.match(html,/\.intro-scale:hover\{box-shadow:none!important\}/);
  assert.match(html,/\.intro-module-chip\{background:var\(--t-surface-2\)!important\}/);
  assert.match(html,/\.intro-module-chip strong\{font-size:11\.5px!important\}/);
});

test('Round121 is presentation and interaction polish only',()=>{
  const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
  assert.match(html,/version-log-version">v8\.1\.12\.183/);
  assert.match(html,/version-log-version">v8\.1\.12\.182/);
});
