'use strict';
// Anonymous and isolated fresh origins only. No access to personal browser downloads.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {prepareSyntheticOrigin}=require('./synthetic-browser-origin.cjs');

async function openBackupSettings(page){
  const welcome=page.locator('#skipOnboardingBtn');
  if(await welcome.isVisible())await welcome.click();
  await page.locator('#settingsBtn').click();
  await page.locator('.settings-overview-grid [data-settings-target="data"]').click();
  await page.locator('[data-collapse-key="settings:data:external"] > summary').click();
  await page.locator('#externalBackupSection').waitFor({state:'visible'});
}

async function captureFailure(page,label){
  const dir=process.env.PL_SYNTHETIC_REPORT_DIR;
  if(!dir)return;
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,`stage162-backup-location-${label}.png`),fullPage:true}).catch(()=>{});
}

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  try{
    for(const width of [390,1024]){
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      try{
        // Simulates browsers without File System Access, including the user's screenshot fallback mode.
        await page.addInitScript(()=>{
          Object.defineProperty(window,'showDirectoryPicker',{value:undefined,configurable:true});
          Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});
        });
        const origin=await prepareSyntheticOrigin(page);
        await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
        await openBackupSettings(page);
        await page.evaluate(async()=>{
          window.__backupNotices=[];
          window.appNotice=(message,title)=>window.__backupNotices.push({message,title});
          setExternalBackupFallbackMode('mobile');
          await updateExternalBackupUI();
        });
        assert.equal(await page.locator('#viewExternalBackupFilesBtn').isVisible(),true);
        assert.match(await page.locator('#viewExternalBackupFilesBtn').innerText(),/查看下载位置/);
        assert.match(await page.locator('#chooseExternalBackupFolderBtn').innerText(),/更改下载目录/);
        await page.locator('#viewExternalBackupFilesBtn').click();
        await page.locator('#chooseExternalBackupFolderBtn').click();
        const notices=await page.evaluate(()=>window.__backupNotices);
        assert.equal(notices.length,2);
        assert.match(notices[0].message,/下载记录/);
        assert.match(notices[1].message,/下载位置|下载\/存储位置/);
        await page.evaluate(()=>showExternalBackupSuccessNotice({kind:'mobile-auto-download',fileName:'synthetic.zip',locationName:'浏览器下载目录'}));
        assert.equal(await page.locator('#externalBackupVerifyBtn').innerText(),'查看下载位置');
        assert.equal(await page.locator('#externalBackupRetryDownloadBtn').isVisible(),true);
        assert.equal(errors.length,0,`page errors at ${width}px: ${errors.slice(0,2)}`);
        console.log(`Stage162 ${width}px fallback: location and change actions, success notice / retry PASS`);
      }catch(err){await captureFailure(page,`fallback-${width}`);throw err;}
      finally{await page.close();}
    }

    const page=await browser.newPage({viewport:{width:1024,height:900}});
    try{
      const origin=await prepareSyntheticOrigin(page);
      await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
      await openBackupSettings(page);
      await page.evaluate(async()=>{
        const filename='PL收集梦想生活_自动备份_2026-11-11.zip';
        const handle={kind:'directory',name:'Stage162匿名备份文件夹',queryPermission:async()=> 'granted',entries:async function*(){yield [filename,{kind:'file',getFile:async()=>new File(['synthetic-invalid-zip'],filename,{type:'application/zip'})}];}};
        externalBackupTargetCache={kind:'directory',handle,displayName:handle.name};
        setExternalBackupFallbackMode('');
        await updateExternalBackupUI();
      });
      assert.equal(await page.locator('#viewExternalBackupFilesBtn').innerText(),'查看当前文件夹');
      assert.equal(await page.locator('#chooseExternalBackupFolderBtn').innerText(),'重新选择文件夹');
      await page.locator('#viewExternalBackupFilesBtn').click();
      await page.locator('#externalBackupBrowserBackdrop').waitFor({state:'visible'});
      assert.match(await page.locator('#externalBackupBrowserLocation').innerText(),/Stage162匿名备份文件夹/);
      assert.match(await page.locator('#externalBackupFileList').innerText(),/自动备份_2026-11-11\.zip/);
      assert.match(await page.locator('#externalBackupFileList').innerText(),/校验失败/);
      console.log('Stage162 1024px folder: re-select and in-app file listing PASS');
    }catch(err){await captureFailure(page,'folder-1024');throw err;}
    finally{await page.close();}
  }finally{await browser.close();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
