'use strict';
// Full synthetic page copy acceptance: page text and real navigation, not user archives.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/ig,'');
html=html.replace(/<script\s+src="\.\/([a-zA-Z0-9_.-]+\.js)"\s*><\/script>/gi,(_,name)=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script>/gi,'<\\/script>')+'\n</script>');
const shim=`<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>`;
html=html.replace('<head>','<head>'+shim);
(async()=>{let browser;const results=[];try{
 browser=await chromium.launch({headless:true});
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width>1000?900:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:65000});await page.waitForTimeout(350);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  const result=await page.evaluate(()=>{const rows=[],banned=['不会被错误连成','完整导出时将支持自动分页，不会丢掉','日期格直接显示模组简称与 K / P'];for(const v of ['profiles','pcs','modules','plans','records','selfIntro','stats']){switchView(v);const el=document.getElementById(v+'View'),text=el?.innerText||'';rows.push({view:v,visible:!el.hidden&&getComputedStyle(el).display!=='none',oldCopy:banned.filter(t=>text.includes(t)),overflow:document.documentElement.scrollWidth>innerWidth+2});}openSettings();const setting=document.getElementById('settingsModal');return{rows,settingsOpen:!setting.hidden,overflow:document.documentElement.scrollWidth>innerWidth+2,version:APP_UI_VERSION};});
  const issues=[];for(const row of result.rows)if(!row.visible||row.oldCopy.length||row.overflow)issues.push(row.view);if(!result.settingsOpen||result.overflow)issues.push('settings');if(errors.length)issues.push(...errors.slice(0,2));
  results.push({width,...result,errors,issues});await page.close();
 }
 console.log('ROUND138_PAGE_COPY',JSON.stringify(results));if(results.some(x=>x.issues.length))process.exitCode=1;
 }catch(err){console.error('ROUND138_PAGE_COPY_ERROR',err.stack||err);process.exitCode=1;}finally{if(browser)await browser.close();}})();
