'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const site=fs.existsSync(path.join(root,'site/index.html'))?path.join(root,'site'):root;
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const css=html.match(/<style id="round78-interface-reachability">([\s\S]*?)<\/style>/)?.[1];
test('mobile contract is a single identifiable CSS scope',()=>{assert(css);assert.equal(html.split('id="round78-interface-reachability"').length,2);});
test('all seven primary page regions have a fixed-rail safe gutter',()=>{
  assert.match(css,/#profilesView,#pcsView,#modulesView,#plansView,#recordsView,#selfIntroView,#statsView/);
  assert.match(css,/padding-right:var\(--mobile-rail-safe\)!important/);
  for(const id of ['profilesView','pcsView','modulesView','plansView','recordsView','selfIntroView','statsView'])assert.match(html,new RegExp('id="'+id+'"'));
});
test('preferences actual export button is visible in mobile browse and edit',()=>{
  assert.match(html,/id="selfIntroExportBtn"/);
  assert.match(css,/#selfIntroView \.self-intro-toolbar \.self-intro-export-center\s*\{/);
  assert.match(css,/#selfIntroView \.self-intro-toolbar #selfIntroExportBtn\s*\{/);
  assert.match(html,/selfIntroExport.*addEventListener\("click"/);
  assert.match(css,/#selfIntroView #selfIntroExportPanel:not\(\[hidden\]\)/);
});
test('statistics actual image export remains mobile-visible',()=>{
  assert.match(html,/id="statsExportBtn"/);
  assert.match(css,/#statsView \.stats-toolbar-actions>#statsExportBtn/);
  assert.match(html,/els\.statsExport\).*addEventListener\("click"/);
});
test('legacy mobile sheet cannot substitute absent export functions',()=>{
  const portion=html.match(/if\(kind==="selfIntro"\)\{([\s\S]*?)if\(kind==="stats"\)/)?.[1]||'';
  assert(!portion.includes('data-mobile-proxy-click="selfIntroExportBtn"'));
  assert.match(css,/#selfIntroView \.self-intro-toolbar #selfIntroExportBtn/);
});
test('fixed shortcuts have accessible hit areas and cannot intercept export panel',()=>{
  assert.match(css,/min-width:44px!important;max-width:44px!important/);
  assert.match(css,/body\.self-intro-export-open #mobileSideRail/);
  assert.match(css,/body\.mobile-page-sheet-open #mobileSideRail/);
});
test('desktop filters and statistics do not inherit stretched grid rows',()=>{
  assert.match(css,/@media \(min-width:761px\)/);
  assert.match(css,/grid-auto-rows:min-content!important/);
  assert.match(css,/#statsView>\.stats-toolbar \{min-height:0!important;height:auto!important/);
});
test('site and worker release identity is in sync',()=>{
  const version=html.match(/const APP_UI_VERSION = "([0-9.]+)";/)?.[1];
  assert(version,'application version must exist');
  assert(fs.readFileSync(path.join(site,'sw.js'),'utf8').includes('v'+version));
});

test('module and record management retain their only mobile action entry',()=>{
  for(const [view,kind] of [['modulesView','moduleTools'],['recordsView','records']]){
    assert.match(html,new RegExp('data-mobile-page-sheet="'+kind+'"'));
    assert(css.includes('#'+view+' .'+(view==='modulesView'?'module-native-controls':'records-filter-workbench')+' .filter-primary-row>[data-mobile-page-sheet="'+kind+'"]'));
  }
});

test('module filter spans entire phone width; sort remains reachable in mobile sheet',()=>{
  assert.match(css,/#modulesView \.module-native-controls \{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css,/#modulesView \.module-native-controls>\.filter-status-row/);
  assert.match(css,/#modulesView \.module-native-controls \.filter-primary-row>#moduleNativeSort/);
  assert.match(html,/mobileProxySelect\("moduleNativeSort","排序"\)/);
});

test('public image exports expose inline privacy controls without a blocking preflight',()=>{
  assert.match(html,/sensitiveImageExportButton\(btn\)/);
  assert.match(html,/SENSITIVE_EXPORT_FINAL_SELECTOR/);
  assert.match(html,/data-export-inline-privacy-toggle/);
  assert.match(html,/隐私导出/);
  assert.doesNotMatch(html,/const PRIVACY_EXPORT_ACK_KEY=/);
  assert.doesNotMatch(html,/privacyExportBypassOnce/);
  assert.doesNotMatch(html,/appSelect\("当前展示图片可能包含人物姓名/);
});
