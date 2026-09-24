'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('function pcFullArchiveBlocks(pc,state,innerWidth=976)');
const end=html.indexOf('async function buildPcPages',start);
assert(start>0&&end>start,'PC complete archive block not found');
const block=html.slice(start,end);

test('PC background is one semantic section without repeated continuation panels',()=>{
  assert.match(block,/add\('背景故事',contentH,/);
  assert.doesNotMatch(block,/背景故事（续）/);
  assert.match(block,/const items=bgRows\.map[\s\S]*?halfLines\.length>metrics\.longThreshold/);
  assert.match(block,/return\{label,value,span:2,lines:fullLines\}/);
});

test('complete archive long-text sections measure all wrapped lines instead of fixed truncation caps',()=>{
  assert.match(block,/pcArchiveTextLines\(measure,String\(value\|\|''\),Math\.max\(60,maxW\),999,font\)/);
  assert.doesNotMatch(block,/Math\.min\(dense\?7:10/);
  assert.doesNotMatch(block,/Math\.min\(dense\?8:11/);
  assert.match(block,/const noteLines=linesFor\(pc\.notes,contentW\)/);
});

test('complete archive block height includes panel header, content padding and measured body height',()=>{
  assert.match(block,/const add=\(title,contentH,draw,subtitle=''\)=>\{const headerH=subtitle\?72:58;blocks\.push\(\{title,h:headerH\+metrics\.top\+Math\.max\(0,contentH\)\+metrics\.bottom/);
  assert.match(block,/rows\*metrics\.fieldH\+\(rows-1\)\*gap/);
  assert.match(block,/rows\*cellH\+\(rows-1\)\*gap/);
  assert.doesNotMatch(block,/add\('角色资料',dense\?180:210/);
  assert.doesNotMatch(block,/add\('CoC7 数值',dense\?210:240/);
});

test('renderer applies content offset and isolates canvas state for every archive block',()=>{
  assert.match(block,/b\.draw\(ctx,x\+18,by\+\(b\.contentTop\|\|0\),w-36\)/);
  assert.match(block,/ctx\.save\(\);ctx\.textAlign='left';ctx\.textBaseline='alphabetic';ctx\.lineWidth=1;/);
  assert.match(block,/ctx\.restore\(\);y\+=b\.h\+14/);
});

test('inventory and assets use measured card height and single-item full width',()=>{
  assert.match(block,/cols=twoTexts\.length===1\?1:2/);
  assert.match(block,/prepared=twoTexts\.map\(\(\[k,v\]\)=>\(\{k,lines:linesFor\(v,cw-22\)\}\)\)/);
  assert.match(block,/cardH=Math\.max[\s\S]*prepared\.map\(p=>36\+Math\.max\(1,p\.lines\.length\)\*metrics\.lineH\+12\)/);
});
