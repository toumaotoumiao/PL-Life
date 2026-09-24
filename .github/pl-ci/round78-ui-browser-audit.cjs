'use strict';
// Browser-only, local ephemeral origin and EMPTY profile. No production URLs or personal data.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const site=fs.existsSync(path.join(root,'index.html'))?root:path.join(root,'site');
const output=path.resolve(process.env.RUNNER_TEMP||path.join(root,'.github/pl-ci'),'pl-synthetic-report');
fs.mkdirSync(output,{recursive:true});
const allow=new Set(fs.readdirSync(site).filter(f=>fs.statSync(path.join(site,f)).isFile()));
const mime=f=>f.endsWith('.js')?'text/javascript; charset=utf-8':f.endsWith('.json')?'application/json; charset=utf-8':f.endsWith('.webmanifest')?'application/manifest+json':f.endsWith('.png')?'image/png':'text/html; charset=utf-8';
const server=http.createServer((req,res)=>{
  const uri=new URL(req.url,'http://127.0.0.1');const name=uri.pathname.slice(1)||'index.html';
  if(!['GET','HEAD'].includes(req.method)||!allow.has(name)||name.includes('/')||name.includes('\\')){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime(name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else res.end(fs.readFileSync(path.join(site,name)));
});
const viewButtons={profiles:'profilesViewBtn',pcs:'pcsViewBtn',modules:'modulesViewBtn',plans:'plansViewBtn',records:'recordsViewBtn',selfIntro:'selfIntroViewBtn',stats:'statsViewBtn'};
const results=[];let browser;

async function verifyInlineExportPrivacy(page){
  await page.waitForFunction(()=>document.getElementById('selfIntroExportPanel')?.hidden===false,null,{timeout:8000});
  const dialog=page.locator('#actionDialogBackdrop');
  if(await dialog.isVisible()) throw new Error('privacy-preflight-unexpectedly-blocking');
  const toggle=page.locator('#selfIntroExportPanel [data-export-inline-privacy-toggle]');
  const switchLabel=page.locator('#selfIntroExportPanel .export-inline-privacy-switch');
  if(!await toggle.isVisible()||!await switchLabel.isVisible()) throw new Error('privacy-inline-control-missing');
  const before=await toggle.isChecked();
  await switchLabel.click({timeout:5000});
  const after=await toggle.isChecked();
  if(before===after) throw new Error('privacy-inline-control-did-not-toggle');
  await switchLabel.click({timeout:5000});
  if(await toggle.isChecked()!==before) throw new Error('privacy-inline-control-did-not-restore');
  return {shown:true,toggled:true};
}
async function inspect(page,view,width){
  const data=await page.evaluate(view=>{
    const root=document.getElementById(view+'View');
    const box=selector=>{
      const el=document.querySelector(selector);if(!el)return {exists:false};
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      const shown=!!(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&!el.hidden);
      return {exists:true,shown,x:Math.round(r.x),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)};
    };
    const bar=box('#'+view+'View .view-toolbar');
    const rail=box('#mobileSideRail');
    const controls={};
    if(view==='selfIntro'){
      controls.edit=box('#selfIntroModeBtn');controls.export=box('#selfIntroExportBtn');
    } else if(view==='stats'){
      controls.range=box('#statsView .stats-toolbar-actions>.mobile-page-tools-btn');
      controls.export=box('#statsExportBtn');
    } else if(view==='pcs') controls.filter=box('#pcsView [data-filter-toggle="pcs"]');
    else if(view==='profiles')controls.filter=box('#profilesView [data-filter-toggle="profiles"]');
    else if(view==='modules'){controls.filter=box('#modulesView [data-filter-toggle="modules"]');controls.more=box('#modulesView [data-mobile-page-sheet="moduleTools"]');}
    else if(view==='records'){controls.filter=box('#recordsView [data-filter-toggle="records"]');controls.more=box('#recordsView [data-mobile-page-sheet="records"]');}
    const filter=box('#'+view+'View .filter-workbench');
    return {active:root&&!root.hidden,toolbar:bar,filter,rail,controls,bodyScrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
  },view);
  const failed=[];if(!data.active)failed.push('view-not-active');
  if(view==='selfIntro'&&(!data.controls.edit.shown||!data.controls.export.shown))failed.push('preference-export-or-edit-inaccessible');
  if(view==='stats'&&(!data.controls.export.shown||(width<=760&&!data.controls.range.shown)))failed.push('statistics-export-or-filter-inaccessible');
  if(['profiles','pcs','modules','records'].includes(view)&&!data.controls.filter.shown)failed.push(view+'-filter-inaccessible');
  if(width<=760&&['modules','records'].includes(view)&&!data.controls.more.shown)failed.push(view+'-mobile-more-inaccessible');
  if(width<=760&&data.rail.shown&&data.toolbar.exists&&data.toolbar.shown&&data.toolbar.right>data.rail.x+3)failed.push('toolbar-overlaps-floating-rail');
  if(width<=760&&data.bodyScrollWidth>width+10)failed.push('unexpected-page-horizontal-overflow');
  if(width>=1100&&data.filter.shown&&data.filter.height>210)failed.push('desktop-filter-overexpanded');
  if(width>=1100&&view==='stats'&&data.toolbar.height>260)failed.push('statistics-toolbar-overexpanded');
  return {view,...data,failed};
}
(async()=>{
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url='http://127.0.0.1:'+server.address().port+'/index.html';
    browser=await chromium.launch({headless:true});
    for(const width of [375,430,768,1280]){
      const context=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,160)));
      await page.goto(url,{waitUntil:'load',timeout:60000});
      // The onboarding modal is delayed ~450ms; snapshots of the modal do NOT prove that
      // buttons in the underlying page are accessible. Dismiss it using the real UI,
      // only in this synthetic throwaway browser context. Never touch real user storage.
      await page.waitForTimeout(850);
      if(await page.locator('#onboardingBackdrop').isVisible()) {
        await page.locator('#onboardingLaterBtn').click({timeout:8000});
      }
      if(await page.locator('#onboardingBackdrop').isVisible()) {
        results.push({width,view:'onboarding',failed:['onboarding-still-blocks-page']});
        await context.close();continue;
      }
      for(const [view,button] of Object.entries(viewButtons)){
        // Real user navigation. The previous audit programmatically clicked DESKTOP
        // buttons even when they were hidden on mobile, missing hit-target/overlay bugs.
        const selector=width<=760
          ? (view==='pcs'?'#profilesView .mobile-person-switch [data-view-target="pcs"]':`#mobileBottomNav [data-view-target="${view}"]`)
          : `#${button}`;
        try{
          await page.locator(selector).click({timeout:10000});
          await page.waitForFunction(id=>document.getElementById(id)&&!document.getElementById(id).hidden,view+'View',{timeout:10000});
        }catch(e){
          const diagnostic=await page.evaluate(()=>({
            visibleViews:Object.entries({profiles:'profilesView',pcs:'pcsView',modules:'modulesView',plans:'plansView',records:'recordsView',selfIntro:'selfIntroView',stats:'statsView'}).filter(([,id])=>document.getElementById(id)?.hidden===false).map(([view])=>view),
            blockingModal:['onboardingBackdrop','mobilePageSheetBackdrop','pcEditorBackdrop','actionDialogBackdrop'].filter(id=>document.getElementById(id)?.hidden===false),
            activeNav:[...document.querySelectorAll('#mobileBottomNav .active')].map(el=>el.dataset.viewTarget),
            navigationTarget:document.querySelector('#mobileBottomNav [data-view-target="modules"]')?.outerHTML.slice(0,220)||null
          })).catch(err=>({diagnosticError:String(err.message)}));
          const record={width,view,selector,diagnostic,error:String(e.message).slice(0,480),pageErrors:errors.slice(-5),failed:['physical-view-switch-failed']};
          try{await page.screenshot({path:path.join(output,`ui-failure-${width}-${view}.png`),fullPage:false,timeout:5000});}catch(err){record.screenshotError=String(err.message).slice(0,120);}
          results.push(record);continue;
        }
        const record=await inspect(page,view,width);
        if(view==='pcs' && record.controls.filter.shown){
          // Test the actual wired filter action, not merely its geometric presence.
          await page.locator('#pcsView [data-filter-toggle="pcs"]').click({timeout:5000});
          try{
            await page.waitForFunction(()=>innerWidth<=760
              ?document.getElementById('mobilePageSheetBackdrop')?.hidden===false
              :document.getElementById('pcFilterPanel')?.hidden===false,null,{timeout:4000});
            if(width<=760){
              await page.locator('[data-mobile-page-sheet-close]').click({timeout:5000});
              await page.waitForFunction(()=>document.getElementById('mobilePageSheetBackdrop')?.hidden===true,null,{timeout:5000});
            } else {
              await page.locator('#pcsView [data-filter-toggle="pcs"]').click({timeout:5000});
            }
          }catch(e){record.failed.push('pcs-filter-does-not-open');}
        }
        if(view==='selfIntro'){
          await page.locator('#selfIntroExportBtn').click({timeout:8000});
          try{
            record.privacyPreflight=await verifyInlineExportPrivacy(page);
            await page.waitForFunction(()=>document.getElementById('selfIntroExportPanel')?.hidden===false,null,{timeout:8000});
            const panel=await page.evaluate(()=>{const r=document.getElementById('selfIntroExportPanel').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:innerWidth,height:innerHeight};});
            record.exportPanel=panel;
            if(panel.left<0||panel.right>width+3||panel.top<0||panel.bottom>823)record.failed.push('export-panel-outside-viewport');
          }catch(e){
            record.exportFlowError=String(e.message).slice(0,240);
            record.failed.push('preference-export-flow-will-not-complete');
          }
          if(await page.locator('#actionDialogBackdrop').isVisible()){
            record.failed.push('privacy-inline-control-left-blocking-page');
            await page.locator('#actionDialogCancel').click({timeout:5000}).catch(()=>{});
          }
          if(await page.locator('#selfIntroExportPanel').isVisible()) await page.locator('#selfIntroExportPanelClose').click({timeout:5000});
        }
        if(width===375&&['profiles','selfIntro','stats','records'].includes(view)){
          try{await page.screenshot({path:path.join(output,`ui-${width}-${view}.png`),fullPage:false});}catch(e){record.screenshotError=String(e.message).slice(0,120);}
        }
        results.push({width,...record});
      }
      if(errors.length)results.push({width,view:'runtime',warnings:errors.slice(0,3)});
      await context.close();
    }
    const failures=results.filter(r=>r.failed&&r.failed.length);
    const report={format:'pl-mobile-ui-synthetic-audit-v2',siteVersion:(fs.readFileSync(path.join(site,'index.html'),'utf8').match(/const APP_UI_VERSION = "([^"]+)"/)||[])[1],scope:'fresh-empty-storage-local-only',widths:[375,430,768,1280],views:Object.keys(viewButtons),checks:results,failed:failures.length};
    fs.writeFileSync(path.join(output,'ui-audit-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log('UI_AUDIT',report.siteVersion,'views',results.filter(r=>r.failed).length,'failures',failures.length);
    if(failures.length){for(const failure of failures)console.error('UI_FAIL',failure.width,failure.view,failure.failed.join(','));process.exitCode=1;}
  }catch(err){console.error('UI_AUDIT_RUN_FAILED',String(err.stack||err).slice(0,600));process.exitCode=1;}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
