'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../..');
const base=fs.existsSync(path.join(dir,'index.html'))?dir:path.join(dir,'site');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const css=html.match(/<style id="v81277-layout-flow-and-control-access">([\s\S]*?)<\/style>/)?.[1];
test('position relative workbenches explicitly reset sticky top for both PL and PC',()=>{
 assert(css);
 assert.match(css,/#profilesView > \.profiles-search-toolbar/);
 assert.match(css,/#pcsView > \.pc-search-toolbar/);
 assert.match(css,/position:relative!important;\s*top:auto!important;\s*bottom:auto!important/);
});
test('module nested filter row owns columns rather than a single cell of outer grid',()=>{
 assert.match(css,/#modulesView \.module-native-controls\s*\{\s*grid-template-columns:minmax\(0,1fr\)!important/);
 for(const token of ['#moduleNativeSort','module-layout-switch','data-filter-toggle="modules"'])assert(css.includes(token));
});
test('tablet preserves PL and PC layout toggles and PC bulk action',()=>{
 assert.match(css,/@media \(min-width:761px\) and \(max-width:1070px\)/);
 for(const token of ['#pcLayoutSwitch','#pcBatchToggleBtn','.profile-layout-switch','.module-layout-switch'])assert(css.includes(token));
});
test('mobile keeps its independent sticky filter sheet and sorting access',()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(html,/data-pc-draft-layout="compact"/);
 assert.match(html,/data-pl-draft-layout="compact"/);
});
test('page and service worker versions match',()=>{
 const version=html.match(/const APP_UI_VERSION = "([0-9.]+)"/)?.[1];
 assert.match(version||'',/^\d+\.\d+\.\d+\.\d+$/);
 assert(fs.readFileSync(path.join(base,'sw.js'),'utf8').includes(`v${version}`));
});
