'use strict';
// Stage165: real Chromium rendering over the full user-required viewport set.
// Uses a fresh synthetic origin and no user archives or device storage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {prepareSyntheticOrigin}=require('./synthetic-browser-origin.cjs');

const widths=[320,375,390,430,768,1024,1280,1440];
const themes=['mist','tomato','night'];
const tabs=[
  ['profilesViewBtn','PL'],['pcsViewBtn','PC'],['modulesViewBtn','模组'],
  ['plansViewBtn','计划'],['recordsViewBtn','记录'],
  ['selfIntroViewBtn','偏好'],['statsViewBtn','统计']
];
const results=[];

async function geometry(page,selector){
  return page.locator(selector).first().evaluate(el=>{
    const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
    return {x:rect.x,right:rect.right,width:rect.width,scrollWidth:el.scrollWidth,
      clientWidth:el.clientWidth,overflowWrap:style.overflowWrap,whiteSpace:style.whiteSpace};
  });
}

async function main(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],
    ...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  try{
    for(const width of widths){
      const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
      const errors=[];page.on('pageerror',error=>errors.push(String(error)));
      try{
        const origin=await prepareSyntheticOrigin(page);
        await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
        const skip=page.locator('#skipOnboardingBtn');if(await skip.isVisible())await skip.click();
        await page.locator('#pcsViewBtn').waitFor({state:'attached',timeout:20000});

        for(const theme of themes){
          await page.evaluate(t=>{document.documentElement.setAttribute('data-theme',t);},theme);
          for(const [button,label] of tabs){
            await page.evaluate(id=>document.getElementById(id)?.click(),button);
            const result=await page.evaluate(()=>({
              viewport:innerWidth,rootWidth:document.documentElement.scrollWidth,
              bodyWidth:document.body.scrollWidth,
              actionCount:[...document.querySelectorAll('button')]
                .filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden').length
            }));
            assert(result.actionCount>0,`${width}/${theme}/${label}: no visible actions`);
            assert(result.rootWidth<=width+16,`${width}/${theme}/${label}: horizontal page overflow ${JSON.stringify(result)}`);
            results.push({width,theme,section:label,...result,result:'PASS'});
          }
        }

        await page.evaluate(()=>document.getElementById('settingsBtn')?.click());
        await page.locator('#settingsModal').waitFor({state:'visible',timeout:10000});
        await page.evaluate(()=>document.querySelector('[data-settings-target="data"]')?.click());
        const modal=await geometry(page,'#settingsModal');
        assert(modal.x>=-3 && modal.right<=width+3,`${width}: settings modal outside viewport ${JSON.stringify(modal)}`);
        const help=page.locator('#settingsModal .settings-action-description').first();
        if(await help.count()){
          const h=await help.evaluate(el=>{
            const style=getComputedStyle(el);return {wrap:style.overflowWrap,whiteSpace:style.whiteSpace};
          });
          assert(['anywhere','break-word'].includes(h.wrap),`${width}: settings description cannot wrap`);
          assert.equal(h.whiteSpace,'normal',`${width}: settings description forced onto a line`);
        }
        const close=page.locator('#closeSettingsBtn');
        const closeRect=await geometry(page,'#closeSettingsBtn');
        assert(closeRect.width>=24 && closeRect.right<=width+3,`${width}: settings close control covered or clipped`);
        await close.click();
        assert.equal(await page.locator('#settingsModal').isVisible(),false,`${width}: settings did not close`);

        // Privacy toggle must leave the ordinary, isolated synthetic page interactive.
        const privacyBefore=await page.locator('#privacyMaskBtn').getAttribute('aria-pressed');
        await page.evaluate(()=>document.getElementById('privacyMaskBtn')?.click());
        const privacyAfter=await page.locator('#privacyMaskBtn').getAttribute('aria-pressed');
        assert.notEqual(privacyBefore,privacyAfter,`${width}: privacy button state did not change`);
        await page.evaluate(()=>document.getElementById('pcsViewBtn')?.click());
        assert.equal(errors.length,0,`${width}: page errors: ${errors.slice(0,3).join(' | ')}`);
        console.log(`Stage165 ${width}px: 7 pages × 3 themes, settings and privacy PASS`);

        // Advanced tools preserve a readable entry and an explicit return action.
        await page.goto(origin+'/module-tools.html',{waitUntil:'domcontentloaded',timeout:60000});
        await page.locator('.notice-compact > summary').click();
        const back=page.locator('.aux-back-home').first();
        assert(await back.isVisible(),`${width}: missing advanced-tools return`);
        const backRect=await geometry(page,'.aux-back-home');
        assert(backRect.right<=width+4,`${width}: advanced-tools back button outside viewport`);
        const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
        assert(pageWidth<=width+16,`${width}: advanced-tools horizontal overflow ${pageWidth}`);
        assert(await page.locator('.notice-body').isVisible(),`${width}: advanced-tools instructions did not expand`);
        assert((await page.locator('.notice-body').innerText()).includes('导出模组 Excel 和完整备份'));
        results.push({width,section:'advanced',result:'PASS'});
      }catch(error){
        const directory=process.env.PL_SYNTHETIC_REPORT_DIR;
        if(directory){
          fs.mkdirSync(directory,{recursive:true});
          await page.screenshot({path:path.join(directory,`stage165-responsive-${width}-failed.png`),fullPage:true}).catch(()=>{});
        }
        throw error;
      }finally{await page.close();}
    }
  }finally{await browser.close();}
  const directory=process.env.PL_SYNTHETIC_REPORT_DIR;
  if(directory){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'stage165-responsive-copy.json'),JSON.stringify({version:'8.1.12.343',synthetic:true,results},null,2));}
  console.log('Stage165 rendered combinations:',results.length);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
