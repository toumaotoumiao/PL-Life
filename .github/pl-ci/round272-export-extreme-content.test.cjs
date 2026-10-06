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

test('single-record cast height and drawing both wrap long PC/HO metadata',()=>{
  assert.match(html,/if\(id==="cast"\)\{let h=70;data\.cast\.forEach\(row=>\{const metaLines=row\.meta\?recordShowcaseMeasureLines/);
  assert.match(html,/function drawRecordShowcaseCast[\s\S]*?const metaLines=row\.meta\?canvasWrapLines\(ctx,row\.meta,w-62\):\[\]/);
  assert.match(html,/rowH=43\+Math\.max\(0,metaLines\.length-1\)\*13/);
  assert.doesNotMatch(html,/canvasTextFit\(ctx,row\.meta,w-60\)/);
});

test('single-record logs use the same full wrapping contract for measuring and drawing',()=>{
  assert.match(html,/recordShowcaseMeasureLines\(`\$\{index\+1\}\. \$\{row\.label\}`,w-62,"750 11\.5px/);
  assert.match(html,/const labelLines=canvasWrapLines\(ctx,`\$\{index\+1\}\. \$\{row\.label\}`,w-62\)/);
  assert.match(html,/const urlLines=row\.url\?canvasWrapLines\(ctx,row\.url,w-62\):\[\]/);
  assert.doesNotMatch(html,/canvasWrapLines\(ctx,row\.url,w-64\)\.slice\(0,2\)/);
});

test('integrated recap keeps long Log labels and URLs instead of single-line ellipsis',()=>{
  assert.match(html,/lineCount\(ctx,`Log · \$\{l\.label\}`,inner-90,'720 9\.5px/);
  assert.match(html,/for\(const line of canvasWrapLines\(ctx,`Log · \$\{l\.label\}`,w-96\)\)/);
  assert.doesNotMatch(html,/canvasTextFit\(ctx,`Log · \$\{l\.label\}`,w-92\)/);
});

test('very sparse recap and dossiers no longer keep large artificial minimum whitespace',()=>{
  assert.match(html,/const H=Math\.max\(360,146\+items\.reduce/);
  const sparse=(html.match(/H=Math\.max\(420,148\+bodyH\+46\)/g)||[]).length;
  assert.ok(sparse>=2,`expected PC/module sparse minimum twice, got ${sparse}`);
  assert.doesNotMatch(html,/const H=Math\.max\(620,146\+items\.reduce/);
});

test('continuous PC/module long image uses the same compact header as paged output',()=>{
  assert.match(html,/const longStats=kind==='pc'\?\[moduleRuleDisplay\(entity\.ruleMeta\)/);
  assert.match(html,/header\(ctx,W,t,'',`\$\{kind==='pc'\?'PC':'模组'\} · \$\{title\}`,'',longStats\)/);
  assert.doesNotMatch(html,/entity\.status&&pcStatusLabel\(entity\.status\),entity\.era,entity\.occupation,'连续长图'/);
  assert.doesNotMatch(html,/entity\.author,entity\.era,entity\.location,'连续长图'/);
});
