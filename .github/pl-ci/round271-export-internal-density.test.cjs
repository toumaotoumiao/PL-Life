'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8'));
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('current version assets agree dynamically',()=>{
  const m=html.match(/const APP_UI_VERSION = "([0-9.]+)";/);
  assert.ok(m,'APP_UI_VERSION missing');
  const version=m[1],stage=Number(status.current.stage);
  assert.equal(status.current.appVersion,version);
  assert.equal(manifest.appVersion,version);
  assert.ok(sw.includes(`v${version}`),`service worker cache must include v${version}`);
  assert.ok(Number.isInteger(stage)&&stage>0,'current stage must be a positive integer');
  assert.ok(manifest.generatedOrInternalRootPrefixesForbidden.includes(`STAGE${stage}_`),`release manifest must exclude STAGE${stage}_ internal files`);
});

test('planner removes duplicate eyebrow and old reserved header gap',()=>{
  assert.match(html,/const headerH=146,heights=months\.map/);
  assert.match(html,/eyebrow:'',title:`\$\{data\.year\} 全年排期`/);
  assert.match(html,/headerH=146,maxDim=9000/);
  assert.doesNotMatch(html,/headerH=164/);
});

test('PC and module dossiers use content-driven minimum heights and compact headers',()=>{
  assert.match(html,/H=Math\.max\(420,148\+bodyH\+46\)/);
  assert.match(html,/`PC · \$\{pc\.name\|\|'未命名 PC'\}`/);
  assert.match(html,/`模组 · \$\{m\.name\|\|'未命名模组'\}`/);
  assert.doesNotMatch(html,/pages.length>1\?`第 \${pageIndex\+1}\/\${pages.length} 张`:state.density===/);
  assert.doesNotMatch(html,/参与人已纳入/);
});

test('single-record final image removes settings prose and reserves matching compact geometry',()=>{
  assert.match(html,/headerBottom=154/);
  assert.match(html,/if\(id==="summary"\)return w<720\?264:198/);
  assert.match(html,/drawRecordShowcasePanelBase\(ctx,x,y,w,h,theme,"本桌概览",""\)/);
  assert.match(html,/drawRecordShowcasePanelBase\(ctx,x,y,w,h,theme,"Log \/ 网页",""\)/);
  assert.doesNotMatch(html,/本桌核心信息；公开字段由左侧选项控制。/);
  assert.doesNotMatch(html,/显示已记录的 Log 名称与网址；公开前请确认链接内容。/);
});

test('PL/KP organizer measurements match compact card drawing',()=>{
  assert.match(html,/const h = 58;/);
  assert.match(html,/const headH = 58, pad = 8, gap = 6, entryH = 66/);
  assert.match(html,/const headH = 58, pad = 8, gap = 6, entryH = 62/);
  assert.match(html,/model\.kind==='kp'.*?58\+16\+rows\*62.*?:58/s);
  assert.match(html,/model\.entries\.length\?\(16\+rows\*66.*?\):48/s);
  assert.doesNotMatch(html,/subtitle: "HO 分组"/);
});

test('integrated recap density controls real row height and inter-card gap',()=>{
  assert.match(html,/let h=compact\?58:relaxed\?84:70/);
  assert.match(html,/Math\.max\(compact\?66:relaxed\?90:80,h\)/);
  assert.match(html,/rowGap=state\.density==='compact'\?9:state\.density==='relaxed'\?14:11/);
  assert.doesNotMatch(html,/state\.range==='filtered'\?'当前筛选':state\.range==='all'\?'全部记录'/);
});
