const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('source dialog is not dismissed when a control rerenders its own element before document click bubbles',()=>{
 assert.match(html,/composedPath\(\)\.includes\(document\.getElementById\("statsExportCenter"\)\)/);
 assert.match(html,/data-stats-export-move/);
});
test('multipage and continuous canvas previews both receive actual draggable block overlays',()=>{
 assert.match(html,/function decorateStatsPreviewPages\(layout,pages,mode\)/);
 assert.match(html,/if\(result\?\.ok\)decorateStatsPreviewPages\(layout,pages,previewMode\)/);
 assert.match(html,/statsExportPageRows\(layout\)/);
 assert.match(html,/handle\.dataset\.statsPreviewDragHandle=item\.id/);
});
test('restore panel scroll after state changes and keep release/cache matching',()=>{
 assert.match(html,/previousPanelScroll=panel\?\.scrollTop\|\|0/);
 assert.match(html,/panel\.scrollTop=previousPanelScroll/);
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)"/)[1];
 assert.ok(sw.includes(`v${version}`));
 assert.ok(fs.existsSync(path.join(root,'.github/pl-ci/round159-stats-export-interaction-browser.py')));
});
