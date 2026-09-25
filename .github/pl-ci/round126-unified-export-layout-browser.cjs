'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const css=source.match(/<style id="appStyles">([\s\S]*?)<\/style>/)?.[1];assert(css);
const a=source.indexOf('  const UX_EXPORT_LAYOUT_KEY='),b=source.indexOf('  function ensureExportPreviewModal()',a);assert(a>=0&&b>a);
const helpers=source.slice(a,b);
const markup=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>
<div id="selfIntroExportPanel" class="export-center-panel" style="width:min(400px,100%)"><div class="export-composer-controls"><section data-export-inline-privacy-row>隐私开关</section><section class="export-center-section"><strong>信息密度</strong></section></div></div>
<button id="statsExportBtn">打开统计导出</button>
<div id="uxExportPreviewBackdrop" class="ux-export-preview-backdrop" hidden><section class="ux-export-preview-modal"><div class="ux-export-preview-body"><section class="ux-export-preview-layout"><div class="stats-segmented"><button data-ux-export-layout="pages">自动分页</button><button data-ux-export-layout="long">单张长图</button></div><div id="uxExportPreviewLayoutHint"></div></section><div id="uxExportPreviewStage" class="ux-export-preview-stage"></div></div><footer class="ux-export-preview-foot"><span id="uxExportPreviewFootHint"></span><div class="right"><button id="uxExportPreviewZip">下载 ZIP</button><button id="uxExportPreviewDownload">导出图片</button></div></footer></section></div>
<script>var uxPendingExport=null;const testPrefs=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>testPrefs.get(k)||null,setItem:(k,v)=>testPrefs.set(k,String(v))}});function sensitiveImageExportButton(btn){return btn?.id==='statsExportBtn';}${helpers}\nwindow.__exportTest={renderUnifiedExportStage,storedUnifiedExportLayout};</script>`;
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [1440,390,360]){
  const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent(markup,{waitUntil:'domcontentloaded'});
  const row=page.locator('#selfIntroExportPanel [data-export-inline-layout-row]');assert.equal(await row.count(),1);
  assert.equal(await page.locator('#selfIntroExportPanel [data-export-inline-privacy-row] + [data-export-inline-layout-row]').count(),1);
  await page.locator('#selfIntroExportPanel [data-export-inline-layout="long"]').click();
  assert.equal(await page.locator('#selfIntroExportPanel [data-export-inline-layout="long"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate('window.__exportTest.storedUnifiedExportLayout()'),'long');
  await page.evaluate(()=>{const n=document.createElement('div');n.id='recordShowcaseBackdrop';n.innerHTML='<div class="export-composer-controls"><section data-export-inline-privacy-row>隐私</section></div>';document.body.append(n);});
  assert.equal(await page.locator('#recordShowcaseBackdrop [data-export-inline-layout-row]').count(),1);
  const geom=await row.evaluate(el=>({buttons:[...el.querySelectorAll('button')].map(b=>({h:b.getBoundingClientRect().height,t:Math.round(b.getBoundingClientRect().top)})),overflow:el.scrollWidth>el.clientWidth}));
  assert.equal(new Set(geom.buttons.map(b=>b.t)).size,1);assert(!geom.overflow);
  if(width<=760)assert(Math.min(...geom.buttons.map(b=>b.h))>=42);
  const result=await page.evaluate(()=>{
    const p1=document.createElement('canvas');p1.width=100;p1.height=120;let c=p1.getContext('2d');c.fillStyle='black';c.fillRect(0,0,100,120);
    const p2=document.createElement('canvas');p2.width=200;p2.height=140;c=p2.getContext('2d');c.fillStyle='white';c.fillRect(0,0,200,140);
    const pending={sourceCanvases:[p1,p2],filenames:['recap_1-2.png','recap_2-2.png'],filename:'recap.png',exportLayout:'long',longCanvas:null};
    window.__exportTest.renderUnifiedExportStage(pending);
    const out=document.querySelector('#uxExportPreviewStage canvas'),ctx=out.getContext('2d');
    const long={width:out.width,height:out.height,top:[...ctx.getImageData(65,30,1,1).data],bottom:[...ctx.getImageData(65,160,1,1).data],disabled:document.getElementById('uxExportPreviewDownload').disabled,zipHidden:document.getElementById('uxExportPreviewZip').hidden};
    pending.exportLayout='pages';window.__exportTest.renderUnifiedExportStage(pending);
    return{long,post:{pages:document.querySelectorAll('#uxExportPreviewStage canvas').length,zipHidden:document.getElementById('uxExportPreviewZip').hidden}};
  });
  assert.equal(result.long.width,200);assert.equal(result.long.height,260);
  assert.deepEqual(result.long.top,[0,0,0,255]);assert.deepEqual(result.long.bottom,[255,255,255,255]);
  assert.equal(result.long.disabled,false);assert.equal(result.long.zipHidden,true);
  assert.deepEqual(result.post,{pages:2,zipHidden:false});assert.deepEqual(errors,[]);
  console.log(`Round126 Chromium ${width}px PASS: source selector / dynamic modal / full-length PNG / paged fallback`);
  await page.close();
 }
}finally{await browser.close();}})().catch(err=>{console.error(err);process.exitCode=1;});
