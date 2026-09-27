'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=html.match(/<style id="round142-export-small-viewport-v206">([\s\S]*?)<\/style>/)?.[1]||'';
const browser=fs.readFileSync(path.join(__dirname,'round134-export-visual-closeout-browser.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round142: responsive preview buttons keep at least 44px in both actual modal and bare fixtures',()=>{
 assert.match(css,/\.ux-export-preview-backdrop \.ux-export-preview-foot \.right>\.btn\{min-height:44px!important\}/);
 assert.match(browser,/id="uxExportPreviewBackdrop" class="ux-export-preview-backdrop"/);
 assert.match(browser,/buttonH>=\(width<=760\?44:40\)/);
});
test('Round142: 320px long diagnostics have own scroll limits; preview still requires visible height',()=>{
 assert.match(css,/\.ux-export-preview-backdrop \.ux-export-feedback\{max-height:min\(78px,15dvh\)!important;overflow:auto\}/);
 assert.match(css,/\.ux-export-preview-backdrop \.ux-export-preview-foot>\.muted\{max-height:min\(42px,8dvh\)!important;overflow:auto\}/);
 assert.match(browser,/v\.bodyH>=40/);
});
test('Round142: CI writes real failure screenshots and geometry before upload; later tests still run',()=>{
 for(const text of ['PL_SYNTHETIC_REPORT_DIR','-failure.json','-failure.png','JSON.stringify(details,null,2)'])assert.ok(browser.includes(text),text);
 assert.match(workflow,/id: round134_browser\n\s+continue-on-error: true/);
 assert.match(workflow,/steps\.round134_browser\.outcome/);
 assert.match(workflow,/if: always\(\)\n\s+uses: actions\/upload-artifact@v7/);
 assert.match(workflow,/Prepare browser diagnostics directory/);
 assert.match(workflow,/round134-export-visual-closeout-browser\.log/);
});
test('Round218: critical multi-rule browser tests all log and finish even when an earlier test fails',()=>{
 for(const n of [141,148,149,151]){
   assert.match(workflow,new RegExp(`id: round${n}_browser\\n\\s+continue-on-error: true`));
   assert.ok(workflow.includes(`round${n}-`),`Round${n} diagnostic log missing`);
   assert.ok(workflow.includes(`steps.round${n}_browser.outcome`),`Round${n} final status not enforced`);
 }
 assert.match(workflow,/failed=0/);
 assert.match(workflow,/exit "\$failed"/);
});
test('Round142: current version is synchronized without changing stored user schema',()=>{
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 const version=html.match(/const APP_UI_VERSION = "([^"]+)";/)?.[1];
 assert.ok(version);
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.ok(sw.includes('v'+version));
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
