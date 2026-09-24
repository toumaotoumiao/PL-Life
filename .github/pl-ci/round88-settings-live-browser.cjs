'use strict';
// Synthetic-only acceptance: no personal account, browser profile, or real user backups.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shell=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const match=shell.match(/const APP_SHELL\s*=\s*\[([^\]]+)\]/);
if(!match)throw Error('App shell file list unavailable');
const allowed=new Set([...match[1].matchAll(/["']\.\/([^"']+)["']/g)].map(row=>row[1]));allowed.add('sw.js');
const mime=name=>name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8';
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
 if(!allowed.has(name)||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime(name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(root,name)));
});
const sections=['overview','appearance','rating','behavior','data','migration','version','advanced'];
(async()=>{
 let browser,activePage=null,activeWidth=0,stage='initialization';const failures=[];let checks=0;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  browser=await chromium.launch({headless:true});
  for(const width of [375,768,1212]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   const page=await context.newPage();activePage=page;activeWidth=width;stage='load';const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e)));
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>typeof openSettings==='function'&&typeof activateSettingsPanel==='function',null,{timeout:60000});
   // On a fresh origin the first-run dialog appears asynchronously (450 ms
   // after startup). Check it after the delay, then dismiss through its real
   // UI. Otherwise the guide can intercept clicks on Settings tabs.
   await page.waitForTimeout(850);
   stage='dismiss first-use guide';
   if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
   // Wait for the dismissal history transaction to settle. A pending
   // history.back from the guide must never close the next modal.
   await page.waitForFunction(()=>document.getElementById('onboardingBackdrop')?.hidden===true && history.state?.modal!=='onboardingBackdrop',null,{timeout:7000});
   stage='open settings';
   const opening=await page.evaluate(()=>{
     const returned=openSettings();
     return {returned,settingsHidden:document.getElementById('settingsModal').hidden,
       overlayOpen:document.getElementById('overlay').classList.contains('open'),
       onboardingHidden:document.getElementById('onboardingBackdrop').hidden,
       historyModal:history.state?.modal||'',shareMode:shareModeEnabled};
   });
   if(opening.settingsHidden||!opening.overlayOpen||!opening.onboardingHidden)
     throw Error('Settings failed to open immediately: '+JSON.stringify(opening));
   // Catch a delayed popstate, delayed first-run timer or a brief modal
   // flash; checking only the immediate state misses the actual regression.
   await page.waitForTimeout(800);
   const stable=await page.evaluate(()=>({settingsHidden:document.getElementById('settingsModal').hidden,
     overlayOpen:document.getElementById('overlay').classList.contains('open'),
     onboardingHidden:document.getElementById('onboardingBackdrop').hidden,
     historyModal:history.state?.modal||'',shareMode:shareModeEnabled}));
   if(stable.settingsHidden||!stable.overlayOpen||!stable.onboardingHidden)
     throw Error('Settings did not remain open after startup transition: '+JSON.stringify({opening,stable}));
   for(const name of sections){
    stage='settings section '+name;
    const sectionButton=page.locator(`#settingsModal .settings-nav [data-settings-target="${name}"]`);
    // Every button must be really actionable. Do not force clicks or suppress
    // a blocking overlay: such a regression should fail with a diagnosis.
    if(await page.locator('#onboardingBackdrop').isVisible())throw Error('onboarding unexpectedly covers Settings section '+name);
    await sectionButton.click();
    const result=await page.evaluate(name=>{
      const m=document.getElementById('settingsModal'),panel=m.querySelector(`[data-settings-panel="${name}"]`);
      const active=[...m.querySelectorAll('[data-settings-panel]')].filter(x=>!x.hidden);
      const nav=m.querySelector('.settings-nav'),r=nav.getBoundingClientRect();
      const main=m.querySelector('.settings-main'),content=main.getBoundingClientRect();
      const errors=[];
      if(active.length!==1||active[0]!==panel)errors.push('tab switching leaves multiple panels visible');
      if(nav.scrollWidth>nav.clientWidth+3)errors.push('settings nav clipped horizontally');
      if(innerWidth>=761){
       if(r.width<200)errors.push('desktop nav is too narrow ('+Math.round(r.width)+'px)');
       if(r.right>content.left+2)errors.push('settings navigation overlaps main content');
       if(content.width<400)errors.push('settings content is too narrow ('+Math.round(content.width)+'px)');
      }
      if(m.scrollWidth>m.clientWidth+5)errors.push('settings modal overflows horizontally');
      if(name==='data'){
       const buttons=['exportBtn','importBtn'].map(id=>m.querySelector('#'+id));
       for(const btn of buttons){const b=btn.getBoundingClientRect();if(b.width<120||b.height<40||b.right>innerWidth+2)errors.push(btn.id+' is clipped or unreachable');}
       const inp=m.querySelector('#importFile');for(const ext of ['.zip','.json','.html','.plbackup','.plmove'])if(!inp.accept.includes(ext))errors.push('file selector missing '+ext);
      }
      if(name==='version'&&!m.querySelector('#releaseNotesBox'))errors.push('version history missing');
      return errors;
    },name);
    checks++; failures.push(...result.map(error=>({width,name,error})));
   }
   await page.locator('#settingsModal .settings-nav [data-settings-target="data"]').click();
   const chooser=page.waitForEvent('filechooser',{timeout:10000});
   await page.locator('#importBtn').click();const native=await chooser;
   if(!native||!native.element)failures.push({width,name:'data',error:'native import file chooser missing'});
   checks++;
   if(errors.length)failures.push({width,name:'runtime',error:errors.slice(0,3).join(' | ')});
   await context.close();activePage=null;
  }
  // Also exercise the genuine first-visit race: open Settings while the
  // onboarding timer may still be pending. The delayed guide must not steal
  // focus from a user-initiated modal or intercept any settings controls.
  {
   const context=await browser.newContext({viewport:{width:375,height:900},serviceWorkers:'block'});
   const page=await context.newPage();activePage=page;activeWidth=375;stage='first-run interaction';
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load',timeout:60000});
   await page.waitForFunction(()=>typeof openSettings==='function'&&typeof maybeShowOnboarding==='function',null,{timeout:60000});
   await page.evaluate(()=>openSettings());
   await page.waitForTimeout(900);
   if(await page.locator('#onboardingBackdrop').isVisible())
    failures.push({width:375,name:'first-run',error:'delayed onboarding covered the user-opened Settings'});
   await page.locator('#settingsModal .settings-nav [data-settings-target="data"]').click();
   if(!await page.locator('#settingsModal [data-settings-panel="data"]').isVisible())
    failures.push({width:375,name:'first-run',error:'Settings became unreachable during onboarding race'});
   checks++;
   await context.close();activePage=null;
  }
  const audit={version:(source.match(/const APP_UI_VERSION = "([0-9.]+)"/)||[])[1],checks,failures};
  console.log('SETTINGS_LIVE_AUDIT',JSON.stringify(audit));
  if(failures.length){
   const target=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'pl-synthetic-report');
   fs.mkdirSync(target,{recursive:true});
   fs.writeFileSync(path.join(target,'settings-layout-audit.json'),JSON.stringify(audit,null,2));
   process.exitCode=1;
  }
 }catch(e){
   console.error('SETTINGS_LIVE_FAIL',String(e.stack||e),'stage='+stage,'width='+activeWidth);
   // Diagnostics are strictly limited to the synthetic 127.0.0.1 origin;
   // never capture the user's actual website, archive, or personal data.
   if(activePage && /^http:\/\/127\.0\.0\.1:\d+\//.test(activePage.url())){
     try{
       const state=await activePage.evaluate(()=>{
         const get=id=>{const el=document.getElementById(id);return el?{hidden:el.hidden,
           inert:el.inert,display:getComputedStyle(el).display,rects:el.getClientRects().length,
           className:el.className}:null};
         return {url:location.pathname,version:typeof APP_UI_VERSION==='string'?APP_UI_VERSION:'unknown',
           settings:get('settingsModal'),overlay:get('overlay'),onboarding:get('onboardingBackdrop'),
           modalHistory:history.state?.modal||'',shareMode:typeof shareModeEnabled!=='undefined'&&shareModeEnabled,
           openSettingsType:typeof openSettings,activePanel:typeof activeSettingsPanel==='string'?activeSettingsPanel:'unknown',
           startupError:document.getElementById('compatStartupError')?.textContent?.slice(0,350)||''};
       });
       console.error('SETTINGS_LIVE_DIAGNOSTICS',JSON.stringify({stage,width:activeWidth,state}));
       const target=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'pl-synthetic-report');
       fs.mkdirSync(target,{recursive:true});
       fs.writeFileSync(path.join(target,'settings-failure-diagnostics.json'),JSON.stringify({stage,width:activeWidth,state},null,2));
       await activePage.screenshot({path:path.join(target,'settings-failure-synthetic.png'),fullPage:false,timeout:4000});
     }catch(diagnosticError){console.error('SETTINGS_DIAGNOSTIC_UNAVAILABLE',String(diagnosticError));}
   }
   process.exitCode=1;
 }
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
