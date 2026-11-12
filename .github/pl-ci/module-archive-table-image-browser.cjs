'use strict';
// Isolated real Chromium acceptance for the archive-table image exporter.
// Synthetic fixtures only: never load a user's private localStorage or Excel.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function between(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+start.length);assert(i>=0&&j>i,'source section missing: '+start);return html.slice(i+start.length,j);}
const css=between('<style id="module-archive-table-image-css">','</style>');
const source=between('<script id="module-archive-table-image-v160">','</script>');
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*,*:before,*:after{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}.btn{padding:9px 12px;border-radius:8px;border:1px solid #bbb;background:#fff;color:#123;cursor:pointer}.primary{background:#305d70;color:#fff}.ux-export-preview-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0007}.stats-segmented button.active{background:#dcebf0}.export-live-preview-page{width:100%}.export-preview-empty{padding:25px}</style><style>${css}</style><button id="launch" type="button">打开图片导出</button>`;
const setup=`
let shareModeEnabled=false,privacyMaskEnabled=false;
const modules=[{id:'aa',name:'独面奈亚',ruleMeta:{label:'CoC · 第七版'},notes:'保密备注A：\u963f\u6492\u6258\u65af'.repeat(14),score:4.6,kp:2,pl:3},
{id:'bb',name:'The Very Long Module Name 混合语言测试',ruleMeta:{label:'D&D · 5e'},notes:'第二条模组长备注'.repeat(65),score:3.8,kp:1,pl:0}];
const runRecords=[];
function selfProfileId(){return'owner';}
function i18nCompareText(a,b){return String(a).localeCompare(String(b),'zh');}
function moduleQueryArchive(){return{rawRows:[modules[0]]};}
function moduleRuleDisplay(x){return x.label;}
function moduleComputedScore(m){return m.score;}
function buildNativeModuleCardIndex(rows){return new Map(rows.map(m=>[m.id,{kp:m.kp,pl:m.pl}]));}
function canvasWrapLines(ctx,text,maxWidth){const out=[];for(const p of String(text||'').split('\\n')){let line='';for(const ch of [...p]){const next=line+ch;if(line&&ctx.measureText(next).width>maxWidth){out.push(line);line=ch;}else line=next;}out.push(line);}return out;}
function createContinuousExportSurface(w,h,p=1.5){const s=Math.min(p,16384/h,Math.sqrt(67108864/(w*h)));if(s<.7)throw Error('长图过长');const canvas=document.createElement('canvas');canvas.width=Math.floor(w*s);canvas.height=Math.floor(h*s);const ctx=canvas.getContext('2d');ctx.scale(s,s);return{canvas,ctx,scale:s};}
function sensitiveImageExportButton(){return false;}
function syncDialogInert(){}function syncModalPageScrollLock(){}function registerModalSurfaceLifecycle(){}
function showContextIssue(info){window.testIssue=info;}
window.PLExportLivePreview={mode:()=> 'pages',register(){},render({stage,paged}){const canvases=paged();stage.replaceChildren(...canvases);return{ok:!!canvases.length,count:canvases.length,mode:'pages'};}};
window.PLUnifiedExportPreview=function(pages,title,filename,meta,success,options){window.exportResult={pages,title,filename,options};};
`;
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  try{
    for(const width of [320,390,768,1440]){
      const page=await browser.newPage({viewport:{width,height:830}}),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      try{
        await page.setContent(fixture,{waitUntil:'domcontentloaded'});
        await page.evaluate(code=>(0,eval)(code),setup+'\n'+source+'\nwindow.PLModuleArchiveTableExport.open();');
        const modal=page.locator('#moduleArchiveTableBackdrop'),canvas=page.locator('#moduleTablePreview canvas');
        assert(await modal.isVisible(),'modal is not visible');
        assert(await canvas.count()>=1,'preview canvas missing');
        const geometry=await page.evaluate(()=>({viewport:innerWidth,dialog:document.querySelector('.module-table-dialog').getBoundingClientRect().toJSON(),
          canvas:document.querySelector('#moduleTablePreview canvas').getBoundingClientRect().toJSON(),
          hasScroll:document.querySelector('.module-table-body').scrollHeight>document.querySelector('.module-table-body').clientHeight}));
        assert(geometry.dialog.x>=-1&&geometry.dialog.x+geometry.dialog.width<=width+1,JSON.stringify(geometry));
        // The image itself is wider than mobile; only the preview scales down.
        const pixels=await canvas.first().evaluate(c=>{const ctx=c.getContext('2d'),p=ctx.getImageData(100,200,1,1).data;return{w:c.width,h:c.height,p:[...p]};});
        assert(pixels.w>=1180&&pixels.h>350,'image resolution too small');
        await page.locator('#moduleTableScope').selectOption('all');
        const fullCount=await canvas.count();assert(fullCount>=1);
        await page.locator('#moduleTableNotes').uncheck();
        await page.locator('#moduleTableExport').click();
        const final=await page.evaluate(()=>window.exportResult?{title:window.exportResult.title,filename:window.exportResult.filename,count:window.exportResult.pages.length}:null);
        assert(final&&final.count>=1&&/模组档案/.test(final.title),JSON.stringify(final));
        assert.deepEqual(errors,[],'browser page errors');
        console.log(`Module table image ${width}px: modal, preview, range, hide notes and final handoff PASS`);
      }catch(err){
        const dest=process.env.PL_SYNTHETIC_REPORT_DIR;
        if(dest){fs.mkdirSync(dest,{recursive:true});await page.screenshot({path:path.join(dest,`module-table-image-${width}-failure.png`),fullPage:true}).catch(()=>{});}
        throw err;
      }finally{await page.close();}
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
