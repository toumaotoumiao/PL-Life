'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=html.match(/<style id="visual-comfort-pass2-v195">([\s\S]*?)<\/style>/)?.[1]||'';
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round131 main card typography, wrap and tap zones are in one scoped visual sheet',()=>{
  assert(styles,'visual polish sheet exists');
  for(const key of ['#profilesView .card-top','#profilesView .name','#profilesView .contact','#profilesView .score-badge',
     '#pcsView .pc-card-title strong','#pcsView .pc-core-stats','#pcsView .pc-core-stat span',
     '#pcsView .pc-core-stat strong','#modulesView .native-module-tags>span','#modulesView .native-module-card-head','#modulesView .native-module-card{min-height:0!important}',
     '@media(max-width:760px)','@media(max-width:360px)','--ui-list-touch:42px'])assert(styles.includes(key),`missing ${key}`);
  assert.match(styles,/#pcsView \.pc-core-stat span\{font-size:10px!important/);
  assert.match(styles,/#pcsView \.pc-core-stat strong\{font-size:14px!important/);
  assert.match(styles,/white-space:normal!important;overflow:visible!important;text-overflow:clip!important/);
  assert.match(styles,/\.native-module-tags>span\{font-size:11px!important/);
  assert.match(styles,/#profilesView \.score-badge \.score-label\{display:block!important/);
});
test('Round131 only changes presentation, keeps full module tags and all data contracts',()=>{
  assert.doesNotMatch(styles,/<(?:script|button|input|select)|\blocalStorage\b|\bindexedDB\b|addEventListener|function\s/);
  const render=(html.match(/function nativeModuleCardHTML\([\s\S]*?\/\* v8\.1\.11\.82/)||[])[0]||'';
  assert.match(render,/const metaHTML=`<div class="native-module-tags">\$\{tags\.map\(t =>/);
  assert.doesNotMatch(render,/<details class="native-module-extra-tags">/);
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
  assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
test('Round131 static and geometry tests are part of the release workflow',()=>{
  assert.match(workflow,/round131-main-list-polish\.test\.cjs/);
  assert.match(workflow,/round131-main-list-polish-browser\.cjs/);
});
