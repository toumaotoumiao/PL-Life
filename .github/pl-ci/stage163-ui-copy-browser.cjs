'use strict';
// Synthetic empty data only. Validates rendered wording and narrow-screen readability.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {prepareSyntheticOrigin}=require('./synthetic-browser-origin.cjs');
const phrase='点击下方按钮新建 PC，或将 CoC 七版 Excel 角色卡拖入此处导入。';

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  try{
    for(const width of [320,390,768,1024,1440]){
      const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      try{
        const origin=await prepareSyntheticOrigin(page);
        await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
        const welcome=page.locator('#skipOnboardingBtn');
        if(await welcome.isVisible())await welcome.click();
        await page.evaluate(()=>document.getElementById('pcsViewBtn')?.click());
        await page.getByText(phrase,{exact:true}).first().waitFor({state:'visible',timeout:20000});
        const empty=page.locator('#pcGrid .empty').first();
        assert.equal(await empty.locator('span').innerText(),phrase);
        assert.equal(await empty.locator('[data-pc-empty-new]').count(),1);
        const layout=await empty.evaluate(el=>{
          const r=el.getBoundingClientRect(),t=el.querySelector('span').getBoundingClientRect();
          return {width:window.innerWidth,right:r.right,textRight:t.right,textScroll:el.querySelector('span').scrollWidth,textClient:el.querySelector('span').clientWidth};
        });
        assert(layout.right<=layout.width+2,`${width}px PC empty state extends offscreen: ${JSON.stringify(layout)}`);
        assert(layout.textScroll<=layout.textClient+3,`${width}px PC help has horizontal overflow: ${JSON.stringify(layout)}`);
        await page.evaluate(()=>document.getElementById('settingsBtn')?.click());
        await page.locator('#settingsModal').waitFor({state:'visible',timeout:10000});
        await page.evaluate(()=>document.querySelector('[data-settings-target="data"]')?.click());
        const backup=await page.locator('#settingsModal').innerText();
        assert(backup.includes('自动备份'),'backup settings missing');
        assert(backup.includes('电脑每天更新一份备份')||backup.includes('完整备份包含档案'),'concise backup help missing');
        assert(!backup.includes('默认每 30 分钟；'),'outdated punctuation remains');
        assert.equal(errors.length,0,`page errors: ${errors.slice(0,3)}`);
        console.log(`Stage163 ${width}px: PC empty action + settings copy/overflow PASS`);
      }catch(error){
        const dir=process.env.PL_SYNTHETIC_REPORT_DIR;
        if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`stage163-copy-${width}-failed.png`),fullPage:true}).catch(()=>{});}
        throw error;
      }finally{await page.close();}
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
