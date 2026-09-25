'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('Round137: layout owns the statistics-data function and prevents undeclared global data lookup',()=>{
 const layout=html.match(/function statsExportLayout\(state=statsExportState\)\{([\s\S]*?)\n\}\nfunction drawStatsExportHeader/);assert(layout,'missing stats export layout');
 assert.match(layout[1],/function statsExportData\(rawState=statsExportState\)\{/);
 assert.match(layout[1],/const normalized=normalizeStatsExportState\(state\),data=statsExportData\(normalized\)/);
 assert.doesNotMatch(html.slice(0,html.indexOf('function statsExportLayout(')),/^function statsExportData\(/m);
});
test('Round137: a source-layout failure is localized and cannot leave a stale export enabled',()=>{
 const src=html.match(/function renderStatsExportCenter\(\)\{try\{[\s\S]*?\n  \}\}\nfunction positionStatsExportPanel/);assert(src,'export settings must catch runtime failures');
 assert.match(src[0],/button\.disabled=true/);assert.match(src[0],/stage\.replaceChildren\(\)/);assert.match(src[0],/PLExportLivePreview\.error/);
 assert.match(src[0],/尚未下载图片/);
});
test('Round137: index, SW and public version metadata agree without binding CI to one version',()=>{
 const app=html.match(/const APP_UI_VERSION = "([0-9.]+)";/)?.[1],cache=sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([0-9.]+)`/)?.[1];
 assert(app&&cache&&app===cache,'program and installed offline cache mismatch');
 assert(html.includes(`id="settingsOverviewVersion">v${app}`),'Settings must display runtime version');
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
test('Round137: the real browser flow is wired into CI',()=>{
 const ci=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(ci,/round137-stats-preview-runtime\.test\.cjs/);
 assert.match(ci,/round137-stats-preview-runtime-browser\.cjs/);
});
