'use strict';
// Test-only origin and fabricated data. Never read a real account, origin, backup, or PC.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const shellText=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const match=shellText.match(/const APP_SHELL\s*=\s*\[([^\]]+)\]/);
if(!match)throw Error('App shell allowlist unavailable');
const allowed=new Set([...match[1].matchAll(/["']\.\/([^"']+)["']/g)].map(x=>x[1]));allowed.add('sw.js');
const mime=x=>x.endsWith('.js')?'text/javascript; charset=utf-8':x.endsWith('.png')?'image/png':x.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8';
const server=http.createServer((req,res)=>{
 const filename=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
 if(!allowed.has(filename)||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime(filename),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(req.method==='HEAD'?undefined:fs.readFileSync(path.join(root,filename)));
});
(async()=>{
 let browser;
 try{
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(String(err.message||err)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof saveState==='function' && typeof renderRunRecords==='function',null,{timeout:60000});
  await page.waitForTimeout(850);
  if(await page.locator('#onboardingBackdrop').isVisible())await page.locator('#onboardingLaterBtn').click();
  await page.evaluate(()=>{
   const mod=normalizeRichModule({id:'round82-module',name:'合成测试模组'},settings.moduleArchive);
   modules.push(mod);
   runPlans.push(normalizeRunPlan({id:'round82-plan',moduleId:mod.id,moduleName:mod.name,tableName:'计划测试桌',logUrls:[],logLabels:[]}));
   runRecords.push(normalizeRunRecord({id:'round82-record',moduleId:mod.id,moduleName:mod.name,tableName:'记录测试桌',logUrls:[],logLabels:[]}));
   if(!saveState())throw Error('initial synthetic archive failed to save');
   // Cross-page opening is deliberate: the editor must not inherit a hidden plans view.
   openPlanEditor('round82-plan');
  });
  const plan=page.locator('#planEditorContent [data-plan-log-label="0"]');
  await page.waitForTimeout(80);
  if(!await plan.isVisible()) {
   const details=await page.evaluate(()=>{
    const input=document.querySelector('#planEditorContent [data-plan-log-label="0"]');
    const backdrop=document.getElementById('planEditorBackdrop');
    return {currentView, editorId:editingPlanId, backdropHidden:backdrop?.hidden,
      hiddenAncestor:input?.closest('[hidden]')?.id||'',
      inertAncestor:input?.closest('[inert]')?.id||'',
      parentId:backdrop?.parentElement?.id||'',
      display:input?getComputedStyle(input).display:'missing',
      errors:document.getElementById('compatStartupError')?.textContent||''};
   });
   throw Error('plan Log input not visible: '+JSON.stringify(details));
  }
  await plan.fill('计划独立备注');
  await page.evaluate(()=>{
   if(!flushPlanInputSave())throw Error('plan note-only autosave not confirmed');
   if(!closePlanEditor())throw Error('saved plan editor did not close');
   switchView('records');
   // Exercise the same navigation + edit entry points as an actual user. A bare
   // recordEditingIds.add() does not expand a default-collapsed record body.
   if(!recordDetailReveal('round82-record'))throw Error('synthetic record could not be located in its module group');
   if(!activateRecordEditing('round82-record'))throw Error('synthetic record could not enter edit mode');
  });
  const record=page.locator('#recordsBoard [data-record-id="round82-record"] [data-record-log-label="0"]');
  if(!await record.isVisible()) {
   const details=await page.evaluate(()=>{
    const row=document.querySelector('#recordsBoard [data-record-id="round82-record"]');
    const input=row?.querySelector('[data-record-log-label="0"]');
    const selected=document.querySelector('#recordsBoard .module-tab.active');
    return {currentView,recordExists:!!runRecords.find(r=>r.id==='round82-record'),
      rowExists:!!row,rowCollapsed:row?.classList.contains('is-collapsed'),
      rowEditing:row?.classList.contains('is-editing'),inputExists:!!input,
      hiddenAncestor:input?.closest('[hidden]')?.id||'',
      selectedGroup:selected?.textContent?.trim().slice(0,80)||'',
      currentGroup:selectedRecordGroupKey, defaultCollapsed:!collapseDefaultOpen(),
      inputRect:input?[input.getBoundingClientRect().width,input.getBoundingClientRect().height]:null};
   });
   throw Error('record Log input not visible after opening actual edit mode: '+JSON.stringify(details));
  }
  await record.fill('记录独立备注');
  const result=await page.evaluate(()=>{
   if(!flushRecordInputSave())throw Error('record note-only autosave not confirmed');
   const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
   const check=raw.data.runs.filter(r=>['round82-plan','round82-record'].includes(r.id));
   if(check.length!==2||check.some(r=>r.logUrls[0]!==''||!r.logLabels[0]))throw Error('note-only data missing from persistent archive');
   return check.map(r=>({id:r.id,logLabels:r.logLabels,logUrls:r.logUrls}));
  });
  await page.reload({waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof saveState==='function',null,{timeout:60000});
  await page.evaluate(()=>{
   const p=runPlans.find(x=>x.id==='round82-plan'),r=runRecords.find(x=>x.id==='round82-record');
   if(p?.logLabels?.[0]!=='计划独立备注'||r?.logLabels?.[0]!=='记录独立备注')throw Error('note-only data did not survive real page reload');
   if(p?.logUrls?.[0]!==''||r?.logUrls?.[0]!=='')throw Error('site invented a URL for a note-only entry');
  });
  if(errors.length)throw Error('Page script errors: '+errors.slice(0,3).join(' | '));
  console.log('LIVE_LOG_NOTES_PASS: plan + record typed via DOM, saved, read back and survived reload; rows='+result.length);
  await context.close();
 }catch(err){console.error('LIVE_LOG_NOTES_FAIL:',String(err.stack||err));process.exitCode=1;}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
