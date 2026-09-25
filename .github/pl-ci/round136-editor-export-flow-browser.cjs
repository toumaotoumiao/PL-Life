'use strict';
// Real HTML, real app scripts, test-only in-memory storage; no production domain or user archive.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/ig,'');
html=html.replace(/<script\s+src="\.\/([a-zA-Z0-9_.-]+\.js)"\s*><\/script>/gi,(_,name)=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script>/gi,'<\\/script>')+'\n</script>');
const shim=`<script>(function(){const a=new Map(),b=new Map();function storage(map){return{getItem:k=>map.has(String(k))?map.get(String(k)):null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),clear:()=>map.clear(),key:i=>[...map.keys()][i]||null,get length(){return map.size}}}Object.defineProperty(window,'localStorage',{value:storage(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:storage(b),configurable:true});})();</script>`;
html=html.replace('<head>','<head>'+shim);
(async()=>{let browser;const results=[];try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,900]){
  const page=await browser.newPage({viewport:{width,height:width===320?680:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForTimeout(550);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  const value=await page.evaluate(()=>{
   // The same open path that a stats user takes, with intentionally empty data.
   switchView('stats');toggleStatsExportCenter(true);
   const panel=document.getElementById('statsExportPanel');
   const initial=statsExportLayout(statsExportState).data;
   const buttons=Array.from(panel.querySelectorAll('[data-stats-export-preset]'));
   buttons[1]?.click();
   const all=statsExportLayout(statsExportState).data;
   const preview=document.getElementById('statsExportPreviewStage');
   toggleStatsExportCenter(false);
   // An actual plan form, not hand-built CSS placeholders.
   document.getElementById('newPlanBtn').click();
   const footer=document.querySelector('#planEditorBackdrop .plan-editor-footer').getBoundingClientRect();
   const targets=[...document.querySelectorAll('#planEditorBackdrop .ux-editor-jumpbar button')].map(b=>b.getBoundingClientRect().height);
   return{hadPanel:!!panel,statsDataKeys:['events','runs','people','mods','spans','summary'].every(k=>initial[k]!=null&&all[k]!=null),previewVisible:!!preview,emptyFeedback:preview?.innerText||'',footerBottom:footer.bottom,viewport:innerHeight,jumpSizes:targets,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
  });
  const issues=[];if(errors.length)issues.push('runtime errors '+errors.slice(0,2).join(' / '));if(!value.hadPanel||!value.statsDataKeys||!value.previewVisible||value.emptyFeedback.includes('尚未选择导出区域'))issues.push('stats flow failed or misleading empty state');if(width<=760&&value.jumpSizes.some(h=>h<40))issues.push('tiny plan jump target');if(value.footerBottom>value.viewport+1)issues.push('plan footer clipped');if(value.scrollWidth>value.viewportWidth+2)issues.push('document overflow');
  results.push({width,issues});await page.close();
 }
 console.log('ROUND136_BROWSER',JSON.stringify(results));if(results.some(x=>x.issues.length))process.exitCode=1;
 }catch(err){console.error('ROUND136_BROWSER_ERROR',err.stack||err);process.exitCode=1;}finally{if(browser)await browser.close();}})();
