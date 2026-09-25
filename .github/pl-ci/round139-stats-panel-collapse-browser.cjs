'use strict';
// This test uses synthetic in-memory stats only; no user data or live site.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/ig,'');
html=html.replace(/<script\s+src="\.\/([a-zA-Z0-9_.-]+\.js)"\s*><\/script>/gi,(_,name)=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script>/gi,'<\\/script>')+'\n</script>');
const shim=`<script>(function(){const a=new Map(),b=new Map();a.set("tomato_pl_onboarding_v1","1");function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>`;
html=html.replace('<head>','<head>'+shim);
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width>1000?900:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:65000});await page.waitForTimeout(450);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  await page.evaluate(()=>{
   statsPersonalRuns=()=>[{id:'synthetic-stats-row'}];statsLastQueryResult={kpCount:0,plCount:0,personalTotal:1};
   statsPersonAggregates=()=>[];statsModuleAggregates=()=>[];statsModuleCount=()=>0;
   statsCurrentPlanSummary=()=>({total:0,scheduled:0,unscheduled:0});statsStoryYear=()=>2026;statsStoryEvents=()=>[];
   switchView('stats');renderStats();
  });
  const panels=page.locator('#statsView .stats-dashboard-grid > .stats-panel');assert.equal(await panels.count(),6,`panel count ${width}`);
  for(const id of ['calendar','timeline','people','modules','footprint','habits']){
    assert.equal(await page.locator(`[data-stats-panel-toggle="${id}"]`).getAttribute('aria-expanded'),'true',`${width} ${id} default open`);
    assert.equal(await page.locator(`[data-stats-panel="${id}"] > .stats-panel-body`).isVisible(),true,`${width} ${id} body visible`);
  }
  await page.locator('[data-stats-panel-toggle="calendar"]').click();
  assert.equal(await page.locator('[data-stats-panel-toggle="calendar"]').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('[data-stats-panel="calendar"] > .stats-panel-body').isVisible(),false);
  await page.locator('[data-stats-panel-toggle="people"]').click();
  assert.equal(await page.locator('[data-stats-panel="people"] .stats-panel-controls').isVisible(),false);
  await page.locator('[data-stats-panel-toggle="calendar"]').click();
  assert.equal(await page.locator('[data-stats-panel="calendar"] > .stats-panel-body').isVisible(),true);
  await page.evaluate(()=>{renderStats();captureCurrentViewState('stats');switchView('profiles');switchView('stats');});
  assert.equal(await page.locator('[data-stats-panel-toggle="people"]').getAttribute('aria-expanded'),'false',`${width} persisted collapse`);
  assert.equal(await page.locator('[data-stats-panel-toggle="calendar"]').getAttribute('aria-expanded'),'true',`${width} independent state`);
  assert.equal(await page.locator('[data-stats-panel="people"] .stats-panel-controls').isVisible(),false);
  await page.locator('[data-stats-panel-toggle="people"]').click();
  await page.locator('[data-stats-people-view="bar"]').click();
  assert.equal(await page.locator('[data-stats-people-view="bar"]').getAttribute('class').then(s=>s.includes('active')),true);
  assert.equal(await page.locator('[data-stats-panel-toggle="people"]').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#statsView [data-stats-panel-toggle] button').count(),0,'no nested controls');
  for(const b of await page.locator('#statsView [data-stats-panel-toggle]').all()) assert((await b.boundingBox()).height>=43,`${width} touch target`);
  assert.deepEqual(errors,[],`browser errors ${width}`);
  console.log('ROUND139_STATS_COLLAPSE',JSON.stringify({width,panels:6,independent:true,rerender:true,controls:true,errors:errors.length}));
  await page.close();
 }
 }catch(e){console.error(e.stack||e);process.exitCode=1;}finally{if(browser)await browser.close();}})();
