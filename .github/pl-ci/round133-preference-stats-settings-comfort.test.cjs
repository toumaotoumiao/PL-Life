'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=html.match(/<style id="visual-comfort-pass4-v197">([\s\S]*?)<\/style>/)?.[1]||'';
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round133: preferences retain exposed options with readable scale labels and preserved choices',()=>{
 assert(css,'fourth visual comfort sheet exists');
 for(const token of ['#selfIntroView .self-intro-section-head','#selfIntroView .intro-chip span','#selfIntroView .intro-scale-head strong','#selfIntroView .intro-scale-labels','#selfIntroView .self-intro-summary-scales b','#selfIntroView .intro-toggle-all'])assert(css.includes(token),token);
 assert.match(css,/\.intro-scale-step\{width:40px!important;height:40px!important/);
 assert.match(css,/\.intro-chip span[^}]*font-size:11\.5px!important/);
});
test('Round133: stats long labels, table type and mobile actions stay readable',()=>{
 for(const token of ['#statsView .stats-ranking-row','#statsView .stats-rank-name','#statsView .stats-bar-label','#statsView .stats-table th','#statsView .stats-panel-controls','#statsView .stats-segmented button'])assert(css.includes(token),token);
 assert.match(css,/\.stats-rank-name,#statsView \.stats-bar-label\{[^}]*white-space:normal!important;overflow:visible!important/);
 assert.match(css,/\.stats-table th,#statsView \.stats-table td\{font-size:11\.5px!important/);
 assert.match(css,/\.stats-panel-controls \.stats-segmented button\{min-height:42px!important/);
});
test('Round133: compact settings preserve status labels and long descriptions, with CI and unchanged schema',()=>{
 for(const token of ['#settingsModal .settings-overview-grid button>span','#settingsModal .settings-overview-grid button>strong','#settingsModal .settings-overview-grid button>small','#settingsModal .friendly-data-head strong','@media(max-width:360px)'])assert(css.includes(token),token);
 assert.match(css,/\.settings-overview-grid button>small\{font-size:11px!important;line-height:1\.5!important/);
 assert.match(css,/\.settings-nav button\{min-height:44px!important/);
 assert.doesNotMatch(css,/<(?:script|button|input|select)|\blocalStorage\b|\bindexedDB\b|addEventListener|function\s/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
 assert.match(workflow,/round133-preference-stats-settings-comfort\.test\.cjs/);
 assert.match(workflow,/round133-preference-stats-settings-browser\.cjs/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
});
