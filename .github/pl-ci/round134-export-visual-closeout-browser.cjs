'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const long='长图片名称ExampleEnglishName0123456789'.repeat(8);
const head=`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>`;
const final=`${head}<div id="uxExportPreviewBackdrop" class="ux-export-preview-backdrop"><section class="ux-export-preview-modal is-multi-page"><header class="ux-export-preview-head"><div class="ux-export-preview-copy"><strong>${long} · 导出预览</strong><span>确认内容与版面，长名称完整可查看 ${long}</span></div><button class="icon-close">×</button></header><div class="ux-export-preview-body"><section class="ux-export-preview-layout"><div class="ux-export-preview-layout-head"><strong>导出形式</strong><span>独立于信息密度</span></div><div class="stats-segmented"><button>自动分页</button><button>单张长图</button></div><div class="ux-export-preview-layout-hint">${long}</div></section><div class="ux-export-preview-stage is-multipage"><div class="ux-export-preview-page"><span class="ux-export-preview-page-label">第 1 / 2 张</span><canvas width="1080" height="1400"></canvas></div><div class="ux-export-preview-page"><span class="ux-export-preview-page-label">第 2 / 2 张</span><canvas width="1080" height="1400"></canvas></div></div></div><div class="ux-export-preview-statebar is-public"><strong>隐私导出已关闭</strong><span>${long}</span></div><div class="ux-export-feedback"><span>「角色档案」导出失败，预览仍在，可重试。</span><details open><summary>技术详情（可复制）</summary><pre>${long.repeat(12)}</pre></details></div><footer class="ux-export-preview-foot"><span class="muted">${long}</span><div class="right"><button class="btn">返回调整</button><button class="btn">下载 ZIP</button><button class="btn primary">逐张 PNG</button></div></footer></section></div></body></html>`;
const gallery=`${head}<div class="ux-export-preview-backdrop"><section class="entity-showcase-modal"><header class="export-center-head"><div><strong>图库精选</strong><span>完整文件名</span></div><button class="export-center-close">×</button></header><div class="entity-showcase-body"><div class="export-composer-grid"><div class="export-composer-controls"><section class="export-center-section"><div id="entityGalleryChoiceList" class="entity-gallery-choice-list">${Array.from({length:3},()=>`<label class="entity-gallery-choice"><div class="entity-gallery-thumb">图片</div><div class="entity-gallery-choice-copy"><strong>${long}</strong><small>图片描述</small></div></label>`).join('')}</div></section></div><aside class="export-preview-pane"><div class="export-preview-head"><strong>实时预览</strong></div><div class="export-preview-stage"><div class="export-preview-empty">${long}</div></div></aside></div></div><footer class="export-center-foot"><button class="btn">恢复默认</button><button class="btn primary">导出图片</button></footer></section></div></body></html>`;
const reportDir=process.env.PL_SYNTHETIC_REPORT_DIR||null;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
 try{
  for(const [width,height] of [[1440,900],[900,740],[390,844],[320,568]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];
   let details={viewport:{width,height}};
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.setContent(final);
    const v=await page.evaluate(()=>{
     const q=s=>document.querySelector(s),r=s=>q(s).getBoundingClientRect(),size=s=>parseFloat(getComputedStyle(q(s)).fontSize),m=r('.ux-export-preview-modal'),f=r('.ux-export-preview-foot'),x=r('.ux-export-feedback');
     return{overflow:document.documentElement.scrollWidth-innerWidth,modalOver:q('.ux-export-preview-modal').scrollWidth-q('.ux-export-preview-modal').clientWidth,modalTop:m.top,modalBottom:m.bottom,footBottom:f.bottom,bodyH:r('.ux-export-preview-body').height,feedbackH:x.height,feedbackMax:parseFloat(getComputedStyle(q('.ux-export-feedback')).maxHeight),headFont:size('.ux-export-preview-copy span'),hintFont:size('.ux-export-preview-layout-hint'),privacyFont:size('.ux-export-preview-statebar span'),labelFont:size('.ux-export-preview-page-label'),stageBorder:getComputedStyle(q('.ux-export-preview-stage')).borderTopStyle,buttonH:r('.ux-export-preview-foot .btn').height};
    });
    details.finalPreview=v;
    assert(v.overflow<=1&&v.modalOver<=1,`${width}: horizontal overflow ${JSON.stringify(v)}`);
    assert(v.modalTop>=-1&&v.modalBottom<=height+1&&v.footBottom<=height+1&&v.bodyH>=40,`${width}: preview or footer squeezed ${JSON.stringify(v)}`);
    assert(v.feedbackH<=v.feedbackMax+2&&v.stageBorder==='solid',`${width}: feedback/stage ${JSON.stringify(v)}`);
    assert(v.headFont>=11.5&&v.hintFont>=11.5&&v.privacyFont>=11.5&&v.labelFont>=11.5,`${width}: unreadable type ${JSON.stringify(v)}`);
    assert(v.buttonH>=(width<=760?44:40),`${width}: undersized action ${JSON.stringify(v)}`);
    await page.setContent(gallery);
    const g=await page.evaluate(()=>{
     const q=s=>document.querySelector(s),name=q('.entity-gallery-choice-copy strong');
     return{overflow:document.documentElement.scrollWidth-innerWidth,nowrap:getComputedStyle(name).whiteSpace,font:parseFloat(getComputedStyle(name).fontSize),emptyFont:parseFloat(getComputedStyle(q('.export-preview-empty')).fontSize),cardOver:q('.entity-gallery-choice').scrollWidth-q('.entity-gallery-choice').clientWidth};
    });
    details.gallery=g;
    assert(g.overflow<=1&&g.cardOver<=1&&g.nowrap==='normal'&&g.font>=11.5&&g.emptyFont>=11.5,`${width}: gallery text ${JSON.stringify(g)}`);
    assert.equal(errors.length,0,`${width}: page errors`);
    console.log(`${width}x${height}: final preview, errors and gallery layout pass`);
   }catch(err){
    details.error=String(err?.stack||err);
    details.pageErrors=errors;
    if(reportDir){
     fs.mkdirSync(reportDir,{recursive:true});
     const stem=`round134-${width}x${height}`;
     fs.writeFileSync(path.join(reportDir,`${stem}-failure.json`),JSON.stringify(details,null,2));
     try{await page.screenshot({path:path.join(reportDir,`${stem}-failure.png`),fullPage:false});}catch(screenshotError){console.warn('Round134 screenshot failed',String(screenshotError));}
    }
    throw err;
   }finally{await page.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
