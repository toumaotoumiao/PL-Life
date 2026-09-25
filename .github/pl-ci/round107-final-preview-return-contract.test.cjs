'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');

test('final export preview states the privacy snapshot before download',()=>{
  assert.match(html,/id="uxExportPreviewPrivacyState"[^>]*role="status"/);
  assert.match(html,/privacyEnabled=Boolean\(privacyMaskEnabled\)/);
  assert.match(html,/uxPendingExport=\{sourceCanvases:canvases,canvases,filenames,filename:Array\.isArray\(filename\)\?filenames\[0\]:filename,title,success,returnToEditor,privacyEnabled,/);
  assert.match(html,/exportLayout:storedUnifiedExportLayout\(\)/);
  assert.match(html,/<strong>隐私导出已开启<\/strong>/);
  assert.match(html,/<strong>隐私导出已关闭<\/strong>/);
  assert.match(html,/人物匿名；日期与时段以当前选择为准/);
});

test('cancel becomes return-to-editor while close and backdrop remain plain dismiss actions',()=>{
  assert.match(html,/function openUnifiedExportPreview\(canvasOrCanvases,title,filename,meta,success,options=\{\}\)/);
  assert.match(html,/returnToEditor=typeof options\?\.returnToEditor==="function"\?options\.returnToEditor:null/);
  assert.match(html,/cancel\.textContent=returnToEditor\?"返回调整":"关闭预览"/);
  assert.match(html,/uxExportPreviewCancel"\)\.addEventListener\("click",function\(\)\{const back=uxPendingExport\?\.returnToEditor;close\(\);if\(typeof back==="function"\)setTimeout/);
  assert.match(html,/uxExportPreviewClose"\)\.addEventListener\("click",close\)/);
  assert.match(html,/if\(e\.target===wrap\)close\(\)/);
});

test('all principal image composers register a return path to the source editor',()=>{
  const required=[
    /window\.PLUnifiedExportPreview\(canvases,`\$\{year\} \$\{mode\} · 导出预览`[\s\S]{0,800}returnToEditor:\(\)=>togglePlannerYearShowcasePanel\(true\)/,
    /详细时段 · 导出预览[\s\S]{0,500}returnToEditor:\(\)=>\{const w=document\.getElementById\("weeklyAvailabilityBackdrop"\)/,
    /个人偏好 · 导出预览[\s\S]{0,400}returnToEditor:\(\)=>toggleSelfIntroExportCenter\(true\)/,
    /个人统计 · 导出预览[\s\S]{0,400}returnToEditor:\(\)=>toggleStatsExportCenter\(true\)/,
    /跑团整理 · 导出预览[\s\S]{0,500}returnToEditor:\(\)=>toggleHoOrganizerExportComposer\(true\)/,
    /单桌跑团回顾 · 导出预览[\s\S]{0,500}returnToEditor:\(\)=>openRecordShowcase\(r\.id\)/,
    /档案图片已导出'[\s\S]{0,260}returnToEditor:\(\)=>returnMode==='pc'\?openPc\(returnId,returnPcOverride\):openMod\(returnId\)/,
    /跑团记录 · 整合回顾 · 导出预览[\s\S]{0,400}returnToEditor:\(\)=>open\(\)/
  ];
  for(const re of required) assert.match(html,re);
});

test('mobile final preview uses two actions for one page and three for multi-page',()=>{
  assert.match(html,/\.ux-export-preview-foot \.right\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html,/\.ux-export-preview-modal\.is-single-page \.ux-export-preview-foot \.right\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(html,/modal\.classList\.toggle\("is-single-page",!renderedMulti\)/);
  assert.match(html,/modal\.classList\.toggle\("is-multi-page",renderedMulti\)/);
});

test('Round107 final-preview contract is part of GitHub Actions',()=>{
  assert.match(workflow,/round107-final-preview-return-contract\.test\.cjs/);
});
