'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const py=fs.readFileSync(path.join(__dirname,'round156-visual-acceptance.py'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];
test('stats toolbar uses stable one-column layout with a full-width responsive filter workbench',()=>{
 assert.match(html,/#statsView>\.stats-toolbar\{display:grid!important;grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(html,/#statsView \.stats-toolbar-actions\.stats-range-workbench\{display:grid!important;grid-template-columns:minmax\(112px,130px\) repeat\(5,minmax\(0,1fr\)\)!important/);
 assert.match(html,/@media\(min-width:761px\) and \(max-width:1100px\)\{#statsView \.stats-toolbar-actions\.stats-range-workbench\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}\}/);
 assert.doesNotMatch(html,/#statsView \.stats-toolbar-actions\.stats-range-workbench\{[^}]*max-width:min\(100%,540px\)/);
 assert.match(html,/#statsView \.stats-toolbar>\.view-toolbar-title>strong\{white-space:nowrap!important/);
});
test('visual regression is a required release gate, including mobile, themes, privacy and populated pages',()=>{
 for(const v of ['profilesView','pcsView','modulesView','plansView','recordsView','selfIntroView','statsView','settingsModal'])assert(py.includes("'"+v+"'"));
 for(const w of [320,375,390,430,768,1024,1280,1440])assert(py.includes(String(w)));
 for(const t of ['mist','tomato','night'])assert(py.includes("'"+t+"'"));
 assert.match(py,/\['empty','normal','large'\]/);
 assert.match(py,/\[False,True\]/);
 assert.match(py,/screenshot\(path=/);
 assert.match(py,/statistics filter occupies <91%/);
 assert.match(workflow,/Round156 full-page visual structural acceptance[\s\S]*?id: round156_browser/);
 assert.match(workflow,/"Round156:\$\{\{ steps\.round156_browser\.outcome \}\}"/);
 assert.match(workflow,/if: always\(\)[\s\S]*?name: pl-synthetic-browser-result/);
});
test('modal and export state can hide mobile shortcut rail without ID-level opacity override',()=>{
 assert.doesNotMatch(html,/#mobileSideRail\.mobile-side-rail\s*\{[^}]*opacity:\.62!important/);
 assert.doesNotMatch(html,/#mobileSideRail\.mobile-side-rail\s*\{[^}]*opacity:\.82!important/);
 assert.doesNotMatch(html,/#mobileSideRail\.mobile-side-rail:(?:focus-within|active)[^}]*opacity:\.94!important/);
 assert.match(html,/body\.stats-export-open \.mobile-side-rail,body\.stats-export-open \.mobile-bottom-nav\{opacity:0!important;pointer-events:none!important/);
 assert.match(py,/floating rail\/nav overlays mobile export panel/);
});
test('release contract and business-data boundary preserved',()=>{
 assert.equal(sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1],version);
 assert.equal((html.match(new RegExp(`<strong class="version-log-version">v${version.replaceAll('.','\\.')}<\\/strong>`,'g'))||[]).length,1);
 assert.match(html,/<option value="">全部大类<\/option>/);
 assert.doesNotMatch(html,/<label[^>]*>玩过规则|<label[^>]*>愿带规则/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+"/);
});
