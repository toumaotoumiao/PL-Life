'use strict';
// Uses fresh, empty, isolated Chromium storage only. Never reads user browser profiles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {prepareSyntheticOrigin}=require('./synthetic-browser-origin.cjs');

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  try{
    for(const width of [768,1024,1440]){
      const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      try{
        const origin=await prepareSyntheticOrigin(page);
        await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
        const welcome=page.locator('#skipOnboardingBtn');
        if(await welcome.isVisible())await welcome.click();
        await page.locator('#modulesViewBtn').click();
        const menu=page.locator('#moduleToolbarMore');
        const open=()=>page.locator('#moduleToolbarMore > summary').click();
        await open();assert.equal(await menu.evaluate(el=>el.open),true);
        await page.locator('[data-module-tool="rating"]').click();
        assert.equal(await page.locator('#settingsModal').isVisible(),true,`rating settings not opened at ${width}`);
        assert.equal(await page.locator('#moduleRatingSettingsDetails').evaluate(el=>el.open),true);
        await page.locator('#closeSettingsBtn').click();
        await open();await page.locator('[data-module-tool="batch"]').click();
        assert.equal(await page.locator('#moduleBatchBar').isVisible(),true,'batch toolbar did not appear');
        await page.locator('#moduleBatchDoneBtn').click();
        await open();await page.locator('[data-module-tool="backup"]').click();
        assert.equal(await page.locator('#settingsModal').isVisible(),true,'backup settings not opened');
        await page.locator('#closeSettingsBtn').click();
        await open();await page.locator('#moduleNativeSearch').click();
        assert.equal(await menu.evaluate(el=>el.open),false,'click outside did not close menu');
        await open();await page.locator('[data-module-tool="image-export"]').click();
        assert.equal(await page.locator('#moduleArchiveTableBackdrop').isVisible(),true,'image-export did not open');
        await page.locator('#moduleTableClose').click();
        await open();
        const [chooser]=await Promise.all([
          page.waitForEvent('filechooser',{timeout:10000}),
          page.locator('[data-module-tool="excel-import"]').click()
        ]);
        assert.equal(chooser.isMultiple(),false,'module Excel import should select one file');
        console.log(`Stage161 ${width}px: rating, batch, backup, outside-close, image export and Excel import file chooser PASS`);
        assert.equal(errors.length,0,`unexpected page errors: ${errors.slice(0,3)}`);
      }catch(err){
        const dir=process.env.PL_SYNTHETIC_REPORT_DIR;
        if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`stage161-module-toolbar-${width}-failed.png`),fullPage:true}).catch(()=>{});}
        throw err;
      }finally{await page.close();}
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
