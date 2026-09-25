'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const meta=html.slice(html.indexOf('const RECORD_SHOWCASE_SCOPE_META='),html.indexOf('const RECORD_SHOWCASE_DEFS=',html.indexOf('const RECORD_SHOWCASE_SCOPE_META=')));
const draw=html.slice(html.indexOf('function drawRecordShowcaseCast('),html.indexOf('function drawRecordShowcaseLogs(',html.indexOf('function drawRecordShowcaseCast(')));
test('Round144: single-record export control and canvas show the same expected title',()=>{
  assert.match(meta,/cast:\{label:"参与人数",desc:/);
  assert.doesNotMatch(meta,/参与阵容/);
  assert.doesNotMatch(draw,/参与阵容/);
  const calls=[];
  const sandbox={privacyMaskEnabled:false,recordShowcaseEffectiveNameMode:()=> 'public',drawRecordShowcasePanelBase:(...a)=>{calls.push({title:a[6],subtitle:a[7]});return 76;},canvasFillRound:()=>{},colorMixForCanvas:()=> '#fff',canvasTextFit:(ctx,s)=>s};
  vm.createContext(sandbox);vm.runInContext(draw,sandbox);
  const ctx={fillText(){},fillStyle:'',font:''},theme={accentSoft:'#eee',surface:'#fff',surface2:'#ddd',line:'#ccc',accent:'#0a0',ink:'#000',muted:'#555'};
  sandbox.drawRecordShowcaseCast(ctx,0,0,400,200,theme,{state:{showPc:true,showHo:true},cast:[{name:'KP',kind:'kp',meta:''},{name:'PL',kind:'pl',meta:'PC: someone'}]});
  assert.equal(calls.length,1);assert.equal(calls[0].title,'参与人数');
});
test('Round144: release notes and README identify current version and keep the actual v207 topic',()=>{
 const v=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.ok(v);
 const readme=fs.readFileSync(path.join(root,'README.md'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.ok(readme.startsWith(`# v${v} ·`));
 assert.match(readme,/## v8\.1\.12\.207 · 全年排期白底与分栏修复/);
 assert.ok(sw.includes('CACHE_NAME=`${CACHE_PREFIX}v'+v+'`'));
 assert.ok(html.includes(`<strong class="version-log-version">v${v}</strong>`));
});
