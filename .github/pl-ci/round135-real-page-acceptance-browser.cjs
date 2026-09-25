'use strict';
// Isolated DOM+CSS Chromium regression. Synthetic data only; app scripts are removed.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
(async()=>{
 const failures=[];let cases=0,browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,430,760,900]){
   const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
   await page.setContent(html,{waitUntil:'domcontentloaded'});
   for(const view of ['modules','records']){
    const r=await page.evaluate(({view,width})=>{
     for(const name of ['profiles','pcs','modules','plans','records','selfIntro','stats'])document.getElementById(name+'View').hidden=name!==view;
     const base=document.getElementById(view+'View');const row=base.querySelector('.filter-primary-row');const filter=base.querySelector(`[data-filter-toggle="${view}"]`);const more=base.querySelector('[data-mobile-page-sheet="moduleTools"],[data-mobile-page-sheet="records"]');const search=base.querySelector('.filter-primary-row .filter-search');
     const rect=el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,height:b.height}};
     const a=rect(search),b=rect(filter),c=rect(more),r=rect(row);const isMobile=width<=760;
     const issues=[];
     if(isMobile){if(r.height>50||r.height<44)issues.push('phantom or undersized search row '+r.height);if(Math.max(a.y,b.y,c.y)-Math.min(a.y,b.y,c.y)>2)issues.push('search/filter/more not aligned');if(a.right>b.x+2||b.right>c.x+2)issues.push('mobile controls overlap');if(Math.min(a.height,b.height,c.height)<40)issues.push('touch target too small');}
     if(document.documentElement.scrollWidth>innerWidth+2)issues.push('document overflows horizontally');
     return{width,view,issues,grid:getComputedStyle(row).gridTemplateRows};
    },{view,width});
    cases++;if(r.issues.length)failures.push(r);
   }
   await page.close();
  }
  console.log('ROUND135_BROWSER',JSON.stringify({cases,failures}));
  if(failures.length)process.exitCode=1;
 }catch(err){console.error('ROUND135_BROWSER_ERROR',err.stack||err);process.exitCode=1;}
 finally{if(browser)await browser.close();}
})();
