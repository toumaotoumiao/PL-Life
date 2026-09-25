'use strict';
// Browser geometry of current source CSS and actual disclosure/preset markup, no user data or site navigation.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
function pick(pattern,label){const m=source.match(pattern);assert(m,`Missing ${label}`);return m[0];}
const credit=pick(/<details class="self-intro-credit-details">[\s\S]*?<\/details>/,'credits');
const recon=pick(/<details class="stats-reconcile-panel"[\s\S]*?<\/details>/,'reconciliation');
const pref=pick(/<div aria-label="导出组合" class="export-preset-grid export-preset-grid-compact"[\s\S]*?<\/div>/,'preference presets');
const stats=pick(/<div aria-label="统计导出组合" class="export-preset-grid export-preset-grid-compact"[\s\S]*?<\/div>/,'stats presets');
const form=part=>`<div class="export-center-head"><div><strong>导出图片</strong><span>内容与版面</span></div><button class="export-center-close">×</button></div><div class="export-composer-body"><div class="export-composer-grid"><div class="export-composer-controls"><section class="export-center-section">${part}<div class="export-option-grid"><label><input type="checkbox">显示 PC</label><label><input type="checkbox">显示 HO</label></div></section></div><aside class="export-preview-pane"><div class="export-preview-head"><span>即时预览</span></div></aside></div></div>`;
const markup=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><section id="selfIntroView"><div class="view-toolbar-title">${credit}</div></section><section id="statsView">${recon}</section><div id="selfIntroExportPanel" class="export-center-panel" hidden>${form(pref)}</div><div id="statsExportPanel" class="export-center-panel" hidden>${form(stats)}</div>`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,900,390,360]){
   const page=await browser.newPage({viewport:{width,height:850}}),errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e)));
   await page.setContent(markup,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#statsReconcileBtn').isVisible(),false);
   await page.locator('#statsReconcileDetails summary').click();
   assert.equal(await page.locator('#statsReconcileBtn').isVisible(),true);
   await page.locator('.self-intro-credit-details summary').click();
   assert.equal(await page.locator('.self-intro-credit').isVisible(),true);
   for(const id of ['selfIntroExportPanel','statsExportPanel']){
    const panel=page.locator('#'+id);await panel.evaluate(el=>el.hidden=false);
    const m=await panel.evaluate(el=>{
      const bs=[...el.querySelectorAll('.export-preset-grid button')].map(x=>x.getBoundingClientRect());
      return {top:bs.map(x=>Math.round(x.top)),height:bs.map(x=>x.height),options:[...el.querySelectorAll('.export-option-grid label')].map(x=>x.getBoundingClientRect().height),close:el.querySelector('.export-center-close').getBoundingClientRect().height};
    });
    assert.equal(new Set(m.top).size,1,`${width}px ${id} must not wrap presets`);
    if(width<=760){assert(Math.min(...m.height)>=42);assert(Math.min(...m.options)>=42);assert(m.close>=40);}
    await panel.evaluate(el=>el.hidden=true);
   }
   assert.deepEqual(errors,[]);
   console.log(`Round124 Chromium ${width}px PASS`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
