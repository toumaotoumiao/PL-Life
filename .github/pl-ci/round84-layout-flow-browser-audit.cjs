'use strict';
// Synthetic layout audit: real Chromium CSS engine, stripped app scripts, EMPTY browser context.
// Tests page geometry and entry visibility, not persistence, original user data, or click handlers.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const site=fs.existsSync(path.join(root,'index.html'))?root:path.join(root,'site');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
const out=path.resolve(process.env.RUNNER_TEMP||__dirname,'pl-synthetic-report');
fs.mkdirSync(out,{recursive:true});
const widths=[320,375,430,760,761,768,900,980,1024,1070,1071,1212,1280,1440];
const pages=['profiles','pcs','modules','plans','records','selfIntro','stats'];
const anchors={
  profiles:['#profilesView>.view-toolbar','#profilesView>.filter-workbench','#profileGrid'],
  pcs:['#pcsView>.view-toolbar','#pcsView>.filter-workbench','#pcGrid'],
  modules:['#modulesView>.view-toolbar','#modulesView .module-native-controls','#moduleNativeGrid']
};
const entryControls={
  profiles:['#profilesView [data-filter-toggle="profiles"]','#sortSelect','#cardLayoutBtn','#compactLayoutBtn'],
  pcs:['#pcsView [data-filter-toggle="pcs"]','#pcSortSelect','#pcCardsLayoutBtn','#pcCompactLayoutBtn','#pcBatchToggleBtn'],
  modules:['#modulesView [data-filter-toggle="modules"]','#moduleNativeSort','#moduleCardsLayoutBtn','#moduleCompactLayoutBtn']
};
const report={format:'pl-layout-flow-synthetic-v1',version:(html.match(/const APP_UI_VERSION = "([0-9.]+)"/)||[])[1],
 scope:'real Chromium CSS and synthetic DOM only; app scripts stripped; no personal data or persistent profile',widths,results:[],failures:[]};
let browser;
(async()=>{
try {
  browser=await chromium.launch({headless:true});
  for(const width of widths){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
    await page.setContent(html,{waitUntil:'domcontentloaded',timeout:60000});
    // Cross-view dialogs must not be descendants of views hidden by navigation.
    const nested=await page.evaluate(()=>[...document.querySelectorAll('section[id$="View"] [id$="Backdrop"]')].map(el=>el.id));
    if(nested.length)report.failures.push({width,view:'dialog-contract',failures:nested.map(id=>'dialog-inside-hidden-view: '+id)});
    for(const view of pages){
      await page.evaluate(v=>{
        for(const name of ['profiles','pcs','modules','plans','records','selfIntro','stats'])
          document.getElementById(name+'View').hidden=name!==v;
        const samples={pcs:['pcGrid','pc-card'],profiles:['profileGrid','card'],modules:['moduleNativeGrid','native-module-card']};
        if(samples[v]){
          const [id,cls]=samples[v];
          document.getElementById(id).innerHTML=`<article class="${cls}"><strong>布局审计专用虚构条目：长名称场景</strong><p>全部为合成信息</p></article>`;
        }
      },view);
      const record=await page.evaluate(({view,anchors,controls})=>{
        const visible=e=>{if(!e||e.closest('[hidden]'))return false;
          const c=getComputedStyle(e),r=e.getBoundingClientRect();
          return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;};
        const rect=s=>{const e=document.querySelector(s);if(!e)return null;
          const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,shown:visible(e)};};
        const failures=[];
        if(document.documentElement.scrollWidth>innerWidth+6)failures.push('unexpected-page-horizontal-overflow');
        if(innerWidth>=761){
          for(const sel of controls||[]){const r=rect(sel);
            if(!r||!r.shown)failures.push('desktop-entry-hidden: '+sel);
            else if(r.x < -3||r.right>innerWidth+3)failures.push('desktop-entry-outside-viewport: '+sel);
          }
          const nav=[...document.querySelectorAll('.view-switch .view-tab')].map(e=>({rect:e.getBoundingClientRect(),scroll:e.scrollWidth,client:e.clientWidth}));
          for(let i=1;i<nav.length;i++)if(nav[i-1].rect.right>nav[i].rect.left+1)failures.push('nav-labels-overlap: '+i);
          for(let i=0;i<nav.length;i++)if(nav[i].scroll>nav[i].client+3)failures.push('nav-label-clipped: '+i);
        }else if(['profiles','pcs','modules','records'].includes(view)){
          const sel=`#${view}View [data-filter-toggle="${view}"]`;
          if(!rect(sel)?.shown)failures.push('mobile-filter-hidden: '+sel);
        }
        // Audit actual visible card, not just its container: negative margins/transform
        // could hide the card even when the grid's bounding box appears safe.
        const boxes=anchors?anchors.map(rect):null;
        const firstCard=rect(({profiles:'#profileGrid .card',pcs:'#pcGrid .pc-card',modules:'#moduleNativeGrid .native-module-card'})[view]);
        if(innerWidth>=761&&boxes&&firstCard?.shown&&boxes[1]?.shown&&boxes[1].bottom>firstCard.y+1)
          failures.push('filter-overlaps-actual-first-card: '+Math.round(boxes[1].bottom-firstCard.y)+'px');
        // Check independent clickable controls do not occupy overlapping hit areas.
        const root=document.getElementById(view+'View');
        const shown=e=>{if(e.closest('[hidden]'))return false;
          const c=getComputedStyle(e),r=e.getBoundingClientRect();
          return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;};
        for(const parent of root.querySelectorAll('.filter-primary-row,.view-toolbar-actions,.stats-toolbar-actions,.table-record-head-actions')){
          if(!shown(parent))continue;
          const controls=[...parent.querySelectorAll('button,input,select')].filter(e=>shown(e)&&!e.closest('.filter-panel'));
          for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
            if(controls[i].contains(controls[j])||controls[j].contains(controls[i]))continue;
            const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)
              failures.push('overlapping-interactive-controls: '+(controls[i].id||i)+' / '+(controls[j].id||j));
          }
        }
        if(innerWidth>=761&&boxes){
          if(boxes.some(x=>!x||!x.shown))failures.push('missing-layout-anchor');
          else if(boxes[1].bottom>boxes[2].y+1)failures.push('filter-overlaps-first-card: '+Math.round(boxes[1].bottom-boxes[2].y)+'px');
        }
        return {width:innerWidth,view,boxes,failures};
      },{view,anchors:anchors[view],controls:entryControls[view]});
      if(width>=761&&anchors[view]){
        const panel=page.locator('#'+view+'View .filter-panel').first();
        if(await panel.count()){
          await panel.evaluate(el=>el.hidden=false);
          const overlap=await page.evaluate(([filter,grid])=>
            document.querySelector(filter).getBoundingClientRect().bottom-
            document.querySelector(grid).getBoundingClientRect().top,[anchors[view][1],anchors[view][2]]);
          if(overlap>1)record.failures.push('expanded-filter-overlaps-first-card: '+Math.round(overlap)+'px');
          await panel.evaluate(el=>el.hidden=true);
        }
      }
      if(record.failures.length)report.failures.push(record);
      report.results.push(record);
      if(view==='pcs'&&[375,768,1212].includes(width))
        await page.screenshot({path:path.join(out,`layout-pc-${width}.png`),fullPage:false});
    }
    await page.close();
  }
} catch(err){report.failures.push({fatal:String(err.stack||err).slice(0,1200)});}
finally{
  if(browser)await browser.close();
  fs.writeFileSync(path.join(out,'round84-layout-flow-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log('ROUND84_LAYOUT_AUDIT',report.version,'views',report.results.length,'failed',report.failures.length);
  for(const f of report.failures.slice(0,15))console.error('LAYOUT_FAILURE',JSON.stringify(f).slice(0,500));
  if(report.failures.length)process.exitCode=1;
}
})();
