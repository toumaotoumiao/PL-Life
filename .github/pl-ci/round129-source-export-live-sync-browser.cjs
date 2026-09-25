'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const css=html.match(/<style id="appStyles">([\s\S]*?)<\/style>/)?.[1];
const a=html.indexOf('  const UX_EXPORT_LAYOUT_KEY='),b=html.indexOf('  function ensureExportPreviewModal()',a);
assert(css&&a>=0&&b>a);
const helper=html.slice(a,b);
const template=`<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
<div id="entityShowcaseBackdrop" style="position:static;display:block;max-width:900px;margin:16px auto;padding:12px;border:1px solid #ddd;background:white">
  <div class="export-composer-controls"><section data-export-inline-privacy-row>隐私导出：已关闭</section></div>
  <div id="entityShowcasePreview" style="width:100%;max-width:600px;height:380px;overflow:auto;padding:8px"></div>
  <button id="entityShowcaseExport" type="button">导出图片</button>
</div><script>
const APP_UI_VERSION='8.1.12.193';var uxPendingExport=null;
const savedPrefs=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>savedPrefs.get(k)||null,setItem:(k,v)=>savedPrefs.set(k,String(v))}});
function sensitiveImageExportButton(){return false;}function renderUnifiedExportStage(){}
${helper}
const preview=document.getElementById('entityShowcasePreview'),button=document.getElementById('entityShowcaseExport');
const first=document.createElement('canvas'),second=document.createElement('canvas');first.width=320;first.height=200;second.width=320;second.height=200;
for(const [canvas,body] of [[first,'#31ad79'],[second,'#4476cd']]){const c=canvas.getContext('2d');c.fillStyle='#ed4c4c';c.fillRect(0,0,320,40);c.fillStyle=body;c.fillRect(0,40,320,160);}
window.__failLong=false;
const continuous=()=>{if(window.__failLong)throw new Error('超出当前浏览器稳定导出范围');const c=document.createElement('canvas');c.width=320;c.height=360;const x=c.getContext('2d');x.fillStyle='#ed4c4c';x.fillRect(0,0,320,40);x.fillStyle='#31ad79';x.fillRect(0,40,320,160);x.fillStyle='#4476cd';x.fillRect(0,200,320,160);return c;};
const render=()=>window.PLExportLivePreview.render({stage:preview,paged:()=>[first,second],continuous,button,area:'PC 档案 → 导出角色档案'});
window.PLExportLivePreview.register('entityShowcaseBackdrop',render);render();
</script></body></html>`;
(async()=>{
const browser=await chromium.launch({headless:true});
try{
for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:750}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent(template,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#entityShowcasePreview canvas').count(),2);
 assert.equal(await page.locator('#entityShowcasePreview').getAttribute('data-export-live-mode'),'pages');
 await page.locator('#entityShowcaseBackdrop [data-export-inline-layout="long"]').click();
 await page.waitForFunction(()=>document.querySelector('#entityShowcasePreview')?.dataset.exportLiveMode==='long');
 assert.equal(await page.locator('#entityShowcasePreview canvas').count(),1);
 const pixels=await page.evaluate(()=>{const canvas=document.querySelector('#entityShowcasePreview canvas'),ctx=canvas.getContext('2d');return {height:canvas.height,top:[...ctx.getImageData(4,5,1,1).data],middle:[...ctx.getImageData(4,210,1,1).data],mode:document.querySelector('#entityShowcasePreview').dataset.exportLiveMode,disabled:document.querySelector('#entityShowcaseExport').disabled};});
 assert.equal(pixels.height,360);assert.deepEqual(pixels.top,[237,76,76,255]);assert.deepEqual(pixels.middle,[68,118,205,255]);assert.equal(pixels.mode,'long');assert.equal(pixels.disabled,false);
 await page.evaluate(()=>{window.__failLong=true;});
 await page.locator('#entityShowcaseBackdrop [data-export-inline-layout="pages"]').click();await page.waitForFunction(()=>document.querySelector('#entityShowcasePreview')?.dataset.exportLiveMode==='pages');
 assert.equal(await page.locator('#entityShowcasePreview canvas').count(),2);
 await page.locator('#entityShowcaseBackdrop [data-export-inline-layout="long"]').click();await page.waitForFunction(()=>document.querySelector('#entityShowcasePreview')?.dataset.exportLiveMode==='error');
 assert.equal(await page.locator('#entityShowcasePreview canvas').count(),0);assert.equal(await page.locator('#entityShowcaseExport').isDisabled(),true);assert.match(await page.locator('#entityShowcasePreview').innerText(),/超出当前浏览器稳定导出范围/);
 await page.locator('#entityShowcaseBackdrop [data-export-inline-layout="pages"]').click();await page.waitForFunction(()=>document.querySelector('#entityShowcasePreview')?.dataset.exportLiveMode==='pages');
 assert.equal(await page.locator('#entityShowcasePreview canvas').count(),2);assert.equal(await page.locator('#entityShowcaseExport').isDisabled(),false);
 assert.equal(await page.locator('#entityShowcaseBackdrop [data-export-inline-layout="pages"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log(`Round129 Chromium ${width}px: paged 2 → continuous 1 → error locked → paged recovered, no page errors`);
 await page.close();
}
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
