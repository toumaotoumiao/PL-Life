'use strict';
// Synthetic PNG canvas tests only. No personal files or remote websites.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const site=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(site,'sw.js'),'utf8');
const start=html.indexOf('async function canvasToPngBlobCompat(canvas) {');
const end=html.indexOf('async function exportSelfIntroImage(',start);
assert(start>0&&end>start,'PNG helper must appear before preference image export');
const helper=html.slice(start,end);
function run(canvas){
  const ctx={Blob,Uint8Array,atob,console:{warn:()=>{}}};
  return vm.runInNewContext(helper+'\ncanvasToPngBlobCompat(canvas)',{...ctx,canvas},{timeout:3000});
}
const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
test('native canvas PNG blob is returned unchanged',async()=>{
 const png=new Blob([Buffer.from([1,2,3])],{type:'image/png'});
 const result=await run({width:100,height:100,toBlob(cb,mime){assert.equal(mime,'image/png');cb(png)},toDataURL(){throw Error('fallback should not run')}});
 assert.strictEqual(result,png);
});
test('older mobile browser without toBlob falls back to PNG data URL',async()=>{
 const result=await run({width:10,height:10,toDataURL:mime=>{assert.equal(mime,'image/png');return tiny;}});
 assert.equal(result.type,'image/png');assert.equal(result.size,Buffer.from(tiny.split(",")[1],"base64").length);assert.equal(Buffer.from(await result.arrayBuffer()).toString('hex').slice(0,16),'89504e470d0a1a0a');
});
test('null native blob attempts fallback, not a false successful download',async()=>{
 const result=await run({width:10,height:10,toBlob(cb){cb(null)},toDataURL(){return tiny}});
 assert.equal(result.type,'image/png');assert(result.size>0);
});
test('native toBlob synchronous exception attempts fallback',async()=>{
 const result=await run({width:10,height:10,toBlob(){throw Error('broken mobile canvas')},toDataURL(){return tiny}});
 assert(result.size>0);
});
test('failed or empty PNG fails clearly rather than initiating an empty download',async()=>{
 await assert.rejects(run({width:10,height:10,toDataURL(){return 'data:,'}}),/未返回有效图像/);
 await assert.rejects(run({width:0,height:10,toDataURL(){return tiny}}),/画布无效/);
 await assert.rejects(run({width:10,height:10}),/不支持 PNG/);
});
test('base64 compatibility path decodes large data in bounded chunks',async()=>{
 const raw=Buffer.alloc(70000,0x41),url='data:image/png;base64,'+raw.toString('base64');
 const result=await run({width:5,height:5,toDataURL(){return url}});
 assert.equal(result.size,raw.length);assert.deepEqual(Buffer.from(await result.arrayBuffer()),raw);
});
test('public image exports route through the PNG compatibility helper or unified final preview',()=>{
 assert.match(html,/async function preparePendingExportBlobs\([\s\S]*?canvasToPngBlobCompat\(canvas\)/);
 const previewContracts=[
  ['个人偏好',/async function exportSelfIntroImage\([\s\S]*?PLRequireUnifiedExportPreview/],
  ['详细时段',/async function exportWeeklyAvailabilityImage\([\s\S]*?PLRequireUnifiedExportPreview/],
  ['个人统计',/exportStatsImage=async function\(\)[\s\S]*?openUnifiedExportPreview/],
  ['跑团整理',/exportHoOrganizerImage=async function\([\s\S]*?openUnifiedExportPreview/],
  ['单桌回顾',/async function openRecordShowcaseFinalPreview\([\s\S]*?PLUnifiedExportPreview/],
  ['全年年历',/async function openPlannerYearShowcasePreview\([\s\S]*?PLUnifiedExportPreview/],
  ['PC／模组档案',/async function finalPreview\(\)[\s\S]*?PLUnifiedExportPreview/]
 ];
 for(const [label,re] of previewContracts)assert.match(html,re,`${label} 必须进入统一最终预览`);
 assert.match(html,/exportPcSimpleCard=async function\([\s\S]*?PLPCShowcaseOpenDraft/,'旧 PC 简卡兼容入口只能转到统一角色档案导出');
 assert.doesNotMatch(html,/requestImageFileDownload|reportImageFileDownloadFailure/,'公众图片不应保留绕过最终预览的直接下载兜底');
 assert.match(html,/id="uxExportPreviewZip"/);
 assert.match(html,/async function exportPendingAsZip\([\s\S]*?pcMakeZipEntries/);
});
test('current visible version labels, release note and offline cache derive from APP_UI_VERSION',()=>{
 const version=html.match(/const APP_UI_VERSION = "([0-9.]+)";/)?.[1];assert(version);
 assert(sw.includes('v'+version));
 const contracts=[
  ['数据健康版本',/id="appVersionHealthValue">v([0-9.]+)</],
  ['版本摘要',/id="versionUpdateSummary">v([0-9.]+)/],
  ['页面版本',/id="versionRuntimeDetails"><span>页面版本：v([0-9.]+)/],
  ['页脚摘要',/class="footer-meta-inline">当前版本 v([0-9.]+)/],
  ['页脚详情',/class="footer-meta">版本：v([0-9.]+)　·　更新时间：/],
  ['首条版本记录',/id="releaseNotesBox"><div class="version-log-item"><strong class="version-log-version">v([0-9.]+)</]
 ];
 for(const [label,re] of contracts){const found=html.match(re)?.[1];assert.equal(found,version,`${label} 应与 APP_UI_VERSION 一致`);}
});
