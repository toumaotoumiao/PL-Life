'use strict';
// Geometric/DOM regression using fabricated elements and an isolated Chromium context.
// The program scripts are deliberately stripped; it never reads real browser storage.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
const widths=[320,375,430,760,761,768,900,1024,1212,1440];
const views=['profiles','pcs','modules','plans','records','selfIntro','stats'];
let browser;
(async()=>{
 const failures=[];let cases=0;
 try{
  browser=await chromium.launch({headless:true});
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
   await page.setContent(html,{waitUntil:'domcontentloaded',timeout:60000});
   // An HTML close-tag regression must fail before we even examine geometry.
   const structure=await page.evaluate(()=>{
    const v=document.getElementById('recordsView');
    const toolbar=v.querySelector(':scope > .records-toolbar');
    const board=document.getElementById('recordsBoard');
    const expected={profileGrid:'profilesView',pcGrid:'pcsView',moduleNativeGrid:'modulesView',recordsBoard:'recordsView',statsContent:'statsView',selfIntroGrid:'selfIntroView'};
    const misplaced=Object.entries(expected).filter(([id,parent])=>document.getElementById(id)?.parentElement?.id!==parent)
      .map(([id,parent])=>`${id} must be direct child of ${parent}`);
    if(board.parentElement!==v)misplaced.push('recordsBoard is nested in toolbar or another layout');
    if(toolbar?.contains(board))misplaced.push('recordsBoard must not be a toolbar grid item');
    if(toolbar?.querySelector(':scope > .records-filter-workbench')===null)misplaced.push('records filter detached from toolbar');
    return misplaced;
   });
   failures.push(...structure.map(why=>({width,view:'structure',why})));
   for(const view of views){
    await page.evaluate(v=>{
     for(const name of ['profiles','pcs','modules','plans','records','selfIntro','stats'])
      document.getElementById(name+'View').hidden=name!==v;
     const samples={
      profiles:['profileGrid','card'],pcs:['pcGrid','pc-card'],modules:['moduleNativeGrid','native-module-card'],
      records:['recordsBoard',''],plans:[],selfIntro:[],stats:[]
     };
     if(v==='records')document.getElementById('recordsBoard').innerHTML=`<div class="records-mobile-module-bar"><button class="records-mobile-module-switch">当前模组 · 合成数据</button></div><aside class="module-sidebar"><button class="module-tab active">模拟模组</button></aside><section class="module-detail"><header class="module-detail-head"><div class="module-detail-title"><div class="module-detail-name">模拟模组</div></div><div class="module-actions"><button class="btn">新增一桌</button></div></header><div class="table-list"><article class="table-record"><header class="table-record-head">模拟桌次</header><div class="table-record-body"><input class="text-input" aria-label="合成备注" /></div></article></div></section>`;
     else if(samples[v]?.length){const [id,cls]=samples[v];document.getElementById(id).innerHTML=`<article class="${cls}"><strong>合成样本：长名称用于排布检查</strong></article>`;}
    },view);
    const result=await page.evaluate(v=>{
     const root=document.getElementById(v+'View');
     const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const shown=e=>e&&!e.closest('[hidden]')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&box(e).height>0;
     const issues=[];
     if(document.documentElement.scrollWidth>innerWidth+6)issues.push('document horizontal overflow');
     const anchors={profiles:['.profiles-search-toolbar','#profileGrid .card'],pcs:['.pc-search-toolbar','#pcGrid .pc-card'],modules:['.module-native-controls','#moduleNativeGrid .native-module-card'],records:['.records-toolbar','#recordsBoard>.module-detail'],plans:['.planner-filter-workbench','.planner-layout']};
     if(anchors[v]){
      const [upper,lower]=anchors[v].map(s=>root.querySelector(s));
      if(shown(upper)&&shown(lower)&&box(upper).bottom>box(lower).y+2)issues.push('workbench/toolbar overlaps actual first item');
     }
     if(v==='records'){
      const view=box(root),toolbar=box(root.querySelector(':scope > .records-toolbar')),
            board=box(document.getElementById('recordsBoard')),
            sidebar=box(document.querySelector('#recordsBoard>.module-sidebar')),
            detail=box(document.querySelector('#recordsBoard>.module-detail'));
      if(!board||!detail)issues.push('missing records board or actual card');
      else if(board.width<root.clientWidth-parseFloat(getComputedStyle(root).paddingLeft)-parseFloat(getComputedStyle(root).paddingRight)-5)
       issues.push(`record board uses only ${board.width.toFixed(0)}px of available ${root.clientWidth}px`);
      if(toolbar&&board&&toolbar.bottom>board.y+2)issues.push('records board overlaps toolbar');
      if(innerWidth>=761&&board&&detail&&sidebar){
       if(!shown(document.querySelector('#recordsBoard>.module-sidebar')))issues.push('desktop sidebar hidden');
       if(Math.abs(detail.right-board.right)>4)issues.push('record detail does not reach right edge of board');
       if(detail.width<Math.max(300,board.width-sidebar.width-20)-5)issues.push('record detail compressed');
      }
      if(innerWidth<=760&&detail&&board&&Math.abs(detail.width-board.width)>4)issues.push('mobile detail does not fill content width');
      for(const sel of ['#recordsView [data-filter-toggle="records"]','#recordsView #createModuleRecordBtn']){
       const el=document.querySelector(sel);if(!shown(el))issues.push('record action missing '+sel);
      }
     }
     return issues;
    },view);
    cases++;failures.push(...result.map(why=>({width,view,why})));
   }
   await page.close();
  }
  console.log('VIEW_FLOW_AUDIT',JSON.stringify({version:(html.match(/const APP_UI_VERSION = "([0-9.]+)"/)||[])[1],cases,widths:widths.length,views:views.length,failures:failures.slice(0,25)}));
  if(failures.length)process.exitCode=1;
 }catch(error){console.error('VIEW_FLOW_AUDIT_ERROR',error.stack||error);process.exitCode=1;}
 finally{if(browser)await browser.close();}
})();
