'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');
const render=(html.match(/function nativeModuleCardHTML\([\s\S]*?\/\* v8\.1\.11\.82/)||[])[0]||'';

test('module card renders every nonempty metadata tag without another fold',()=>{
  assert(render,'native module renderer exists');
  assert.match(render,/const tags = \[/);
  assert.match(render,/\]\.filter\(Boolean\)/);
  assert.match(render,/const metaHTML=`<div class="native-module-tags">\$\{tags\.map\(t =>/);
  assert.doesNotMatch(render,/<details class="native-module-extra-tags">/);
  assert.doesNotMatch(render,/更多资料 ·/);
  assert.match(render,/escapeHTML\(t\)/);
});
test('compact row remains short, without affecting card metadata',()=>{
  assert.match(render,/native-module-row-tags">\$\{tags\.slice\(0, 3\)/);
  assert.match(html,/\.native-module-tags\{display:flex;gap:5px;flex-wrap:wrap;/);
  assert.match(html,/#modulesView \.native-module-tags>span\{max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere\}/);
});
test('note is still optional and expandable; archive schema remains intact',()=>{
  assert.match(render,/const noteHTML=noteText\?`<details class="native-module-note">/);
  assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
  const guard=fs.readFileSync(path.join(__dirname,'../..','data-migration-guard.js'),'utf8');
  assert.match(guard,/MAX_SCHEMA\s*=\s*26/);
});

test('execute module-card renderer: four extra tags are visible without opening details',()=>{
  const snippet=render.replace(/\/\* v8\.1\.11\.82[\s\S]*$/,'');
  const escapeHTML=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ctx={moduleBatchSelectedIds:new Set(),moduleBatchMode:false,
    moduleSideStats:()=>({kp:2,pl:3}),moduleRunCount:()=>5,
    moduleComputedScore:()=>null,moduleLastRunDate:()=>'',modulesByNormalizedName:()=>[{}],
    escapeHTML,compactRecordDate:value=>value};
  vm.runInNewContext(snippet+'\nthis.render=nativeModuleCardHTML;',ctx);
  const record={id:'demo',name:'测试模组',author:'测试作者',location:'日本',era:'现代',players:'1人',hoSystem:'has',duration:'4-6小时',nature:'文字团',reKp:'是',notes:''};
  const card=ctx.render(record,false),compact=ctx.render(record,true);
  for(const value of ['地点 日本','时代 现代','1人','有 HO','4-6小时','文字团','愿意再带']){
    assert(card.includes('>'+value+'</span>'),`card should show ${value}`);
  }
  assert(!card.includes('更多资料'));
  assert(!card.includes('native-module-extra-tags'));
  assert.equal((card.match(/<span class="(?:ho-tag)?">/g)||[]).length,7);
  assert.equal((compact.match(/class="native-module-row-tags"/g)||[]).length,1);
  const compactTags=(compact.match(/class="native-module-row-tags">([\s\S]*?)<\/div>/)||[])[1]||'';
  assert.equal((compactTags.match(/<span>/g)||[]).length,3);
  const withEmpty=ctx.render({...record,location:'',era:'',duration:'',nature:'',reKp:'',players:''},false);
  assert(!withEmpty.includes('地点 '));
  assert(!withEmpty.includes('时代 '));
});
