'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('Round120 closeout style exists and compresses the five main mobile page headers without hiding personal pages',()=>{
  assert.match(html,/style id="ui-reduction-closeout-v182"/);
  assert.match(html,/:is\(#profilesView,#pcsView,#modulesView,#plansView,#recordsView\)>\.view-toolbar \.view-toolbar-title>span\{display:none!important\}/);
  assert.doesNotMatch(html,/:is\([^}]*#selfIntroView[^}]*\)>\.view-toolbar \.view-toolbar-title>span\{display:none!important\}/);
  assert.doesNotMatch(html,/:is\([^}]*#statsView[^}]*\)>\.view-toolbar \.view-toolbar-title>span\{display:none!important\}/);
});

test('empty states are reduced instead of returning to large placeholder cards',()=>{
  assert.match(html,/\.empty,\.stats-empty,\.intro-empty,\.plan-editor-empty,\.participant-empty-panel,\.global-search-empty\{min-height:108px!important;[\s\S]*?border-left:0!important;[\s\S]*?background:transparent!important\}/);
  assert.match(html,/\.ho-organizer-empty\{min-height:150px!important;[\s\S]*?border-radius:0!important;[\s\S]*?background:transparent!important\}/);
  assert.doesNotMatch(html,/ui-reduction-closeout-v182[\s\S]*?\.empty[^}]*border:1px dashed/);
});

test('destructive actions stay semantically red without permanent filled warning backgrounds',()=>{
  assert.match(html,/\.btn\.danger,\.btn\.danger-soft,\.profile-rail-btn\.danger,button\.ux-action-danger,\.mobile-sheet-danger\{[\s\S]*?background:transparent!important;[\s\S]*?color:var\(--t-danger\)!important/);
  assert.match(html,/\.btn\.danger:hover:not\(:disabled\)[\s\S]*?background:color-mix\(in srgb,var\(--t-danger-soft\) 72%,var\(--t-surface\)\)!important/);
});

test('PC editor shell uses the same lightweight modal and tab language',()=>{
  assert.match(html,/\.pc-editor\{border-radius:var\(--ds-radius-float\)!important;[\s\S]*?box-shadow:var\(--ds-shadow-float\)!important\}/);
  assert.match(html,/\.pc-editor-tabs\{[\s\S]*?background:transparent!important\}/);
  assert.match(html,/\.pc-editor-tabs button\.active::after\{content:"";[\s\S]*?height:2px;[\s\S]*?background:var\(--t-accent\)\}/);
});

test('mobile close controls and small modal actions keep adequate touch targets',()=>{
  assert.match(html,/@media\(max-width:760px\)[\s\S]*?\.close,\.icon-close,\.export-center-close\{width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important/);
  assert.match(html,/:is\(\.modal,\.pc-editor,\.native-module-editor,\.plan-editor-drawer,\.settings-modal,\.mobile-page-sheet\) \.btn\.small\{min-height:40px!important\}/);
});

test('Round120 remains presentation-only and release/schema contracts are intact',()=>{
  const guard=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
  assert.match(html,/version-log-version">v8\.1\.12\.182/);
  assert.match(html,/version-log-version">v8\.1\.12\.181/);
});
