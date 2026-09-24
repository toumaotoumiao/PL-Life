'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function segment(startMarker,endMarker,from=0){
  const start=html.indexOf(startMarker,from);assert(start>=0,`${startMarker} missing`);
  const end=html.indexOf(endMarker,start+startMarker.length);assert(end>start,`${endMarker} missing after ${startMarker}`);
  return html.slice(start,end);
}

test('all public image flows keep a mandatory unified final-preview route',()=>{
  const preference=segment('async function exportSelfIntroImage(','function selfIntroExportPresetKey');
  const weekly=segment('async function exportWeeklyAvailabilityImage()','function introScale(');
  assert(preference.includes('PLRequireUnifiedExportPreview'));
  assert(weekly.includes('PLRequireUnifiedExportPreview'));
  assert(!preference.includes('downloadBlobFile('));
  assert(!weekly.includes('downloadBlobFile('));
  assert.doesNotMatch(html,/requestImageFileDownload|reportImageFileDownloadFailure/);
  for(const marker of [
    'openPlannerYearShowcasePreview',
    'openRecordShowcaseFinalPreview',
    'exportStatsImage=async function',
    'exportHoOrganizerImage=async function',
    'async function finalPreview()'
  ]){
    const i=html.indexOf(marker);assert(i>=0,`${marker} missing`);
    const tail=html.slice(i,i+14000);
    assert(/PLUnifiedExportPreview|openUnifiedExportPreview|PLRequireUnifiedExportPreview/.test(tail),`${marker} bypasses unified preview`);
  }
  assert(html.includes('window.PLRequireUnifiedExportPreview=function'));
});

test('retired PC public HTML package and simple-card actions stay retired',()=>{
  for(const marker of [
    'data-pc-export-full',
    'data-pc-export-package',
    'data-pc-export-card',
    'async function exportPcFullArchive(',
    'async function exportPcArchivePackage(',
    'baseExportPcSimpleCard'
  ]) assert(!html.includes(marker),`${marker} must not return as a public/dead route`);
  assert.match(html,/exportPcSimpleCard=async function\([\s\S]*?PLPCShowcaseOpenDraft/);
  assert(html.includes('function buildPcFullArchiveHtml(pc)'),'technical/batch archive builder should remain available internally');
  assert.match(html,/async function batchExportPcs\([\s\S]*?buildPcFullArchiveHtml/,'batch archival may keep the technical HTML artifact');
});

test('PC/module public wording is export-oriented rather than a competing showcase product',()=>{
  assert(html.includes('<strong id="entityShowcaseTitle">档案导出</strong>'));
  assert(html.includes('<strong>导出页面</strong>'));
  assert(!html.includes('<strong id="entityShowcaseTitle">档案展示</strong>'));
  assert.match(html,/title:'档案导出预览未生成'/);
  assert.match(html,/area:mode==='pc'\?'PC 档案 → 导出档案':'模组档案 → 导出档案'/);
});

test('technical file exports remain separate from public image-preview convergence',()=>{
  assert(html.includes('id="exportBtn"'),'complete backup export remains a file workflow');
  assert(html.includes('id="pcFooterExportExcelBtn"'),'CoC7 Excel export remains independent');
  assert(html.includes('data-pc-batch-export'),'PC batch archive remains a technical archive workflow');
  assert(html.includes('data-weekly-compare-export'),'availability JSON interchange remains a data workflow');
});


test('workflow keeps Round100 in the live release gate',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
  assert(workflow.includes('round100-public-image-export-convergence.test.cjs'));
});
