'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function sliceBetween(a,b){
  const i=html.indexOf(a);assert(i>=0,`missing ${a}`);
  const j=html.indexOf(b,i+1);assert(j>i,`missing ${b}`);
  return html.slice(i,j);
}

test('integrated module dossier measures real wrapped text before assigning panel height',()=>{
  const body=sliceBetween('function moduleCompleteBlocks(m,state,continuous=false){','function moduleCompleteCanvases(m,state){');
  assert.match(body,/pcArchiveTextLines\(measure,String\(text\|\|''\),contentW,999,bodyFont\)/);
  assert.match(body,/headerH\+top\+Math\.max\(0,contentH\)\+bottom/);
  assert.match(body,/contentTop:top,gapAfter:metrics\.blockGap/);
  assert.doesNotMatch(body,/Math\.ceil\(String\(text\)\.length\//,'long text must not estimate line count from character count');
});

test('all integrated module blocks reserve top, bottom and inter-block whitespace',()=>{
  const body=sliceBetween('function moduleCompleteBlocks(m,state,continuous=false){','async function buildModulePages(m,state){');
  for(const token of [
    'compact:{top:8,bottom:12,blockGap:14',
    'standard:{top:10,bottom:14,blockGap:16',
    'relaxed:{top:12,bottom:16,blockGap:18',
    "add('模组资料',contentH",
    "add(title,contentH",
    "add('个人评分',contentH",
    "add(start?'桌次历史（续）':'桌次历史',contentH"
  ]) assert.ok(body.includes(token),`missing spacing contract: ${token}`);
  assert.match(body,/b\.draw\(ctx,x\+18,by\+\(b\.contentTop\|\|0\),w-36\)/);
  assert.match(body,/y\+=b\.h\+\(i<group\.length-1\?\(b\.gapAfter\|\|14\):0\)/);
  assert.match(body,/ctx\.save\(\)[\s\S]*?b\.draw\([\s\S]*?ctx\.restore\(\)/);
});

test('standalone recruitment page shares measured blocks with continuous export and sizes canvas dynamically',()=>{
  const blocks=sliceBetween('function moduleRecruitBlocks(m){','function moduleRecruitCanvas(m){');
  const body=sliceBetween('function moduleRecruitCanvas(m){','function moduleRatingCanvas(m){');
  assert.match(blocks,/pcArchiveTextLines\(measure,String\(value\),968,10,font\)/);
  assert.match(blocks,/h:58\+topPad\+safeLines\.length\*lineH\+bottomPad/);
  assert.match(body,/blocks=moduleRecruitBlocks\(m\)/);
  assert.match(body,/const H=Math\.max\(760,190\+bodyH\+48\)/);
  assert.doesNotMatch(body,/H=1180/,'recruitment canvas must not stay at a fixed height');
});

test('PC complete archive keeps its existing measured top/bottom spacing model',()=>{
  const body=sliceBetween('function pcFullArchiveBlocks(pc,state,innerWidth=976){','function pcFullArchiveImageCanvases(pc,state){');
  assert.match(body,/headerH\+metrics\.top\+Math\.max\(0,contentH\)\+metrics\.bottom/);
  assert.match(body,/contentTop:metrics\.top/);
});
