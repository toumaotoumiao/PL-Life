'use strict';
// Actual page scripts + in-memory synthetic records. No user archive, no live domain.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/ig,'');
html=html.replace(/<script\s+src="\.\/([a-zA-Z0-9_.-]+\.js)"\s*><\/script>/gi,(_,name)=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script>/gi,'<\\/script>')+'\n</script>');
const shim=`<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>`;
html=html.replace('<head>','<head>'+shim);
(async()=>{let browser;const results=[];try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width>1000?900:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:65000});await page.waitForTimeout(350);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  const result=await page.evaluate(async()=>{
   const version=APP_UI_VERSION;const mod=normalizeRichModule({id:'round137-module',name:'仅用于测试的统计模组'},settings.moduleArchive);modules.push(mod);
   runRecords.push(normalizeRunRecord({id:'round137-record',moduleId:mod.id,moduleName:mod.name,kpProfileId:selfProfileId(),tableName:'合成日期桌次',startDate:'2026-09-20',endDate:'2026-09-20',sessionSlots:[{id:'round137-slot',date:'2026-09-20',startTime:'19:00',endTime:'23:00'}]}));
   switchView('stats');toggleStatsExportCenter(true);
   const panel=document.getElementById('statsExportPanel');const layout=statsExportLayout(statsExportState);
   document.querySelector('[data-stats-export-preset="data"]')?.click();
   const stage=document.getElementById('statsExportPreviewStage'),before=stage.querySelectorAll('canvas').length;
   const exported=await exportStatsImage(),final=document.getElementById('uxExportPreviewBackdrop');
   const finalBefore=final.querySelectorAll('#uxExportPreviewStage canvas').length;
   document.querySelector('[data-ux-export-layout="long"]')?.click();
   const long=final.querySelectorAll('#uxExportPreviewStage canvas').length;
   const longError=document.getElementById('uxExportPreviewDownload').disabled;
   document.getElementById('uxExportPreviewCancel').click();
   await new Promise(resolve=>setTimeout(resolve,160));
   return{version,open:!panel.hidden,summary:layout.data.summary.sessions,preview:before,exported,finalBefore,long,longError,returned:!panel.hidden};
  });
  const issues=[];if(errors.length)issues.push('page error: '+errors.slice(0,2).join(' / '));if(!result.version||!result.open||result.summary<1||result.preview<1||!result.exported||result.finalBefore<1||result.long!==1||result.longError||!result.returned)issues.push('stats export open-preview-long-return contract failed');
  results.push({width,...result,issues});await page.close();
 }
 console.log('ROUND137_BROWSER',JSON.stringify(results));if(results.some(x=>x.issues.length))process.exitCode=1;
 }catch(err){console.error('ROUND137_BROWSER_ERROR',err.stack||err);process.exitCode=1;}finally{if(browser)await browser.close();}})();
