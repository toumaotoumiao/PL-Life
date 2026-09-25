'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const head=source.slice(0,source.indexOf('</head>'));
const css=[...head.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
assert(css.includes('visual-comfort-pass1-v194')||source.includes('visual-comfort-pass1-v194'));
const markup=`<!doctype html><html lang="zh-CN" data-theme="normal"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
<main class="shell" style="min-height:0">
<section class="export-center-panel" style="position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:min(900px,100%)!important;max-width:100%!important;max-height:none!important;overflow:visible!important;margin:0 auto">
 <header class="export-center-head"><div><strong>角色档案导出预览</strong><span>选择展示页面、顺序与公开细节；右侧同步预览当前画面。</span></div><button class="export-center-close" type="button">×</button></header>
 <div class="export-composer-body"><div class="export-composer-grid"><div class="export-composer-controls">
  <section class="export-center-section"><div class="export-center-section-head"><strong>导出页面</strong><span>这段说明文字比较长，应该换行而不是和标题挤压或超出控件。</span></div><div class="export-option-grid"><label><input type="checkbox" checked>显示 PC</label><label><input type="checkbox" checked>显示 HO</label></div></section>
  <section class="export-center-section"><div class="export-center-section-head"><strong>导出方案</strong><span>只影响本次导出</span></div><div class="stats-segmented"><button type="button">简版</button><button type="button" class="active">标准</button><button type="button">完整</button></div></section>
 </div><aside class="export-preview-pane"><div class="export-preview-head"><div><strong>实时预览</strong><span>随设置同步更新，内容可连续滚动查看。</span></div></div><div class="export-preview-stage" style="min-height:150px">预览示意</div></aside></div></div>
 <footer class="export-center-foot"><button class="btn small">恢复默认</button><button class="btn primary">导出图片</button></footer>
</section>
<div class="ux-export-preview-layout" style="max-width:900px;margin:12px auto"><div class="ux-export-preview-layout-head"><strong>导出形式</strong><span>与信息密度独立，可随时切换。</span></div><div class="stats-segmented"><button type="button">自动分页</button><button type="button" class="active">单张长图</button></div><div class="ux-export-preview-layout-hint">长图不出现重复页头。</div></div>
<details class="editor-subdetails-v181"><summary><span>补充资料</span><small>已有资料自动展开</small></summary></details>
<footer class="site-footer">页面底部信息</footer>
</main></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [1440,900,390,320]){
   const page=await browser.newPage({viewport:{width,height:820}}),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   await page.setContent(markup,{waitUntil:'domcontentloaded'});
   const result=await page.evaluate(()=>{
     const sample=s=>{const e=document.querySelector(s);const c=getComputedStyle(e);return {font:parseFloat(c.fontSize),height:e.getBoundingClientRect().height,width:e.clientWidth,scrollWidth:e.scrollWidth};};
     return {head:sample('.export-center-head span'),section:sample('.export-center-section-head span'),preview:sample('.export-preview-head span'),choice:sample('.export-option-grid label'),mode:sample('.export-center-panel .stats-segmented button'),finalMode:sample('.ux-export-preview-layout .stats-segmented button'),finalHint:sample('.ux-export-preview-layout-head span'),summary:sample('.editor-subdetails-v181>summary small'),bodyBottom:parseFloat(getComputedStyle(document.body).paddingBottom),shellBottom:parseFloat(getComputedStyle(document.querySelector('.shell')).paddingBottom),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   for(const key of ['head','section','preview','finalHint','summary'])assert(result[key].font>=11.4,`${width}px ${key}: font ${result[key].font}px`);
   assert(result.section.scrollWidth<=result.section.width+2,`${width}px export helper is clipped or overflows`);
   if(width<=760){for(const key of ['choice','mode','finalMode'])assert(result[key].height>=41.5,`${width}px ${key}: touch height ${result[key].height}`);assert.equal(result.bodyBottom,0);assert(result.shellBottom>=88,`${width}px shell bottom navigation safe area lost`);}
   assert(result.overflow<=1,`${width}px page horizontal overflow ${result.overflow}px`);
   assert.deepEqual(errors,[]);
   console.log(`Round130 Chromium ${width}px PASS: readable export labels, touch geometry, single bottom inset, zero horizontal overflow`);
   await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
