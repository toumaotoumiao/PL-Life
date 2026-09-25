'use strict';
// Synthetic in-memory runs only. No production or user archives.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/ig,'');
html=html.replace(/<script\s+src="\.\/([a-zA-Z0-9_.-]+\.js)"\s*><\/script>/gi,(_,name)=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script>/gi,'<\\/script>')+'\n</script>');
const shim=`<script>(function(){const a=new Map(),b=new Map();a.set('tomato_pl_onboarding_v1','1');function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>`;
html=html.replace('<head>','<head>'+shim);
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width>1000?900:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:65000});await page.waitForTimeout(450);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  await page.evaluate(()=>{
   const makeRole=i=>({kp:i<12||i>=24,pl:i>=12}),runs=Array.from({length:32},(_,i)=>({id:'test-'+i,moduleName:'synthetic-module-'+i,roles:makeRole(i),startDate:'2026-01-01'}));
   const events=Array.from({length:60},(_,i)=>({eventId:'evt-'+i,runId:'test-'+i,date:'2026-09-'+String(i%28+1).padStart(2,'0'),startTime:'19:00',moduleName:'synthetic-module-'+i,tableName:'',roles:{kp:i<20||i>=40,pl:i>=20},archived:true,daypart:'evening'}));
   statsPersonalRuns=()=>runs;statsLastQueryResult={kpCount:20,plCount:20,personalTotal:32};statsRunRoles=run=>run.roles;
   statsStoryYear=()=>2026;statsStoryEvents=()=>events;
   statsPersonAggregates=rows=>rows.map((r,i)=>({name:'person-'+r.id,profileId:'',together:1,ledByMe:r.roles.kp?1:0,ledMe:r.roles.pl?1:0,coPl:r.roles.pl?1:0,lastDate:'2026-09-01'}));
   statsModuleAggregates=rows=>rows.map((r,i)=>({name:r.moduleName,moduleId:String(i),total:1,kp:r.roles.kp?1:0,pl:r.roles.pl?1:0,plAppearances:1,uniquePl:new Set(['a']),uniqueKp:new Set(['b']),lastDate:'2026-09-01'}));
   statsModuleCount=(rows,key)=>rows.filter(r=>r[key]>0).length;
   statsCurrentPlanSummary=()=>({total:0,scheduled:0,unscheduled:0});
   window.PLRunEvents.runSpans=evts=>evts.map(e=>({moduleName:e.moduleName,tableName:'',start:e.date,end:e.date,roles:e.roles,archived:true,sessions:1,events:[e]}));
   window.PLRunEvents.summarize=evts=>({tables:evts.length,sessions:evts.length,days:20,modules:evts.length,kpTables:40,plTables:40});
   switchView('stats');renderStats();
  });
  const count=async selector=>page.locator(selector).count();
  for(const id of ['timeline','people','modules','footprint']){
    assert.equal(await count(`[data-stats-panel="${id}"] [data-stats-panel-role]`),3,`${width} ${id} role switches`);
    assert.equal(await count(`[data-stats-panel="${id}"] [data-stats-panel-mode], [data-stats-panel="${id}"] [data-stats-footprint-mode]`),2,`${width} ${id} extent switches`);
  }
  for(const id of ['calendar','habits'])assert.equal(await count(`[data-stats-panel="${id}"] [data-stats-panel-role], [data-stats-panel="${id}"] [data-stats-panel-mode]`),0);
  assert.equal(await count('.stats-run-timeline-row'),28);assert.equal(await count('.stats-footprint-row'),24);assert.equal(await count('[data-stats-panel="people"] .stats-ranking-row'),10);assert.equal(await count('[data-stats-panel="modules"] .stats-module-table tbody tr'),10);
  await page.locator('[data-stats-panel-mode="timeline"][data-stats-display-value="all"]').click();assert.equal(await count('.stats-run-timeline-row'),60);
  await page.locator('[data-stats-panel-role="timeline"][data-stats-role-value="kp"]').click();assert.equal(await count('.stats-run-timeline-row'),40);
  await page.locator('[data-stats-footprint-mode="all"]').click();assert.equal(await count('.stats-footprint-row'),60);
  await page.locator('[data-stats-panel-role="footprint"][data-stats-role-value="pl"]').click();assert.equal(await count('.stats-footprint-row'),40);
  await page.locator('[data-stats-panel-mode="people"][data-stats-display-value="all"]').click();assert.equal(await count('[data-stats-panel="people"] .stats-ranking-row'),32);
  await page.locator('[data-stats-panel-role="people"][data-stats-role-value="kp"]').click();assert.equal(await count('[data-stats-panel="people"] .stats-ranking-row'),20);
  await page.locator('[data-stats-panel-mode="modules"][data-stats-display-value="all"]').click();assert.equal(await count('[data-stats-panel="modules"] .stats-module-table tbody tr'),32);
  await page.locator('[data-stats-panel-role="modules"][data-stats-role-value="pl"]').click();assert.equal(await count('[data-stats-panel="modules"] .stats-module-table tbody tr'),20);
  await page.locator('[data-stats-panel-toggle="people"]').click();assert.equal(await page.locator('[data-stats-panel="people"] .stats-panel-controls').isVisible(),false);
  await page.locator('[data-stats-panel-toggle="people"]').click();assert.equal(await count('[data-stats-panel="people"] .stats-ranking-row'),20);
  await page.evaluate(()=>{captureCurrentViewState('stats');switchView('profiles');switchView('stats');});
  assert.equal(await page.locator('[data-stats-panel-role="people"][data-stats-role-value="kp"]').getAttribute('aria-pressed'),'true','section identity persists');
  assert.equal(await count('[data-stats-panel="people"] .stats-ranking-row'),20,'full rows persist after view change');
  assert.equal(await page.locator('#statsView [data-stats-panel-toggle] button').count(),0,'no nested button');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(overflow,false,`viewport ${width} overflow`);assert.deepEqual(errors,[],`browser errors ${width}`);
  console.log('ROUND140_SCOPED_STATS',JSON.stringify({width,identity:true,partialFull:true,collapse:true,overflow:false,errors:errors.length}));
  await page.close();
 }
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{if(browser)await browser.close();}})();
