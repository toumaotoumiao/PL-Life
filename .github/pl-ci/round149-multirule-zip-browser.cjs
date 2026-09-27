'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),preflight=fs.readFileSync(path.join(root,'backup-restore-preflight.js'),'utf8');
function between(begin,end){const a=html.indexOf(begin),b=html.indexOf(end,a);assert(a>=0&&b>a,begin);return html.slice(a,b);}
const unzip=between('const PC_ZIP_LIMITS=','function pcExcelSheetRows('),zip=between('function pcCrc32Table()','function pcMediaStorageInventory(');
const setup=`function pcMediaSafeName(s){return String(s).replace(/[^a-zA-Z0-9_.-]/g,'_');}\n${unzip}\n${zip}\n${preflight}\n`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.setContent('<!doctype html><meta charset="utf-8"><main>synthetic isolated ZIP verifier</main>');
   const result=await page.evaluate(async source=>{
    return await (new Function(source+`\nreturn (async()=>{
     const enc=new TextEncoder(),same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
     const wb=await pcMakeZipEntries([{name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},{name:'xl/workbook.xml',data:'<workbook/>'}]);
     const wbBytes=new Uint8Array(await wb.arrayBuffer()),media=new Uint8Array([137,80,78,71,13,10,26,10,0,1]);
     const auditResults=[];
     for(const old of [true,false]){
      const pc={id:'pc-1',name:'isolated PC',ownerPlId:'self',avatarMediaId:'image-1',galleryMediaIds:[],excelSource:{kind:'fixed',fileName:'source.xlsx'},...(!old?{ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:''},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[]}}}:{})};
      const archive={format:'fixture',schemaVersion:26,data:{profiles:[{id:'self'}],pcs:[pc],modules:[],runs:[]}};
      const archiveBytes=enc.encode(JSON.stringify(archive));
      const manifest={format:'pl-life-complete-backup',version:1,backupMode:'complete',archivePath:'archive.json',mediaCount:1,
       archiveSha256:'',media:[{id:'image-1',pcId:'pc-1',path:'media/image-1.png',type:'image/png',size:media.length,crc32:pcCrc32(media)}],
       workbooks:[{pcId:'pc-1',path:'workbooks/pc-1.xlsx',kind:'fixed',size:wbBytes.length,crc32:pcCrc32(wbBytes)}]};
      const zipped=await pcMakeZipEntries([{name:'manifest.json',data:JSON.stringify(manifest)},{name:'archive.json',data:archiveBytes},{name:'media/image-1.png',data:media},{name:'workbooks/pc-1.xlsx',data:wbBytes}]);
      const bytes=new Uint8Array(await zipped.arrayBuffer()),files=await pcExcelUnzip(bytes.buffer,{kind:'backup'});
      const restoredArchive=JSON.parse(new TextDecoder().decode(files['archive.json']));
      const restoredManifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
      const pre=PLBackupRestorePreflight.audit(restoredManifest,restoredArchive,files);
      if(!same(files['workbooks/pc-1.xlsx'],wbBytes)||!same(files['media/image-1.png'],media)||pre.workbookCount!==1||pre.mediaCount!==1)throw Error('ZIP attachment mismatch');
      if(!old&&restoredArchive.data.pcs[0].ruleSheets.insane.traits[0].value!=='6')throw Error('new sheet lost');
      if(old&&restoredArchive.data.pcs[0].ruleSheets)throw Error('old archive altered');
      const bad=new Uint8Array(bytes),at=bad.findIndex((v,i)=>i>70&&bad.slice(i,i+wbBytes.length).every((b,j)=>b===wbBytes[j]));
      if(at<0)throw Error('unable to locate workbook bytes in ZIP');bad[at+5]^=1;
      let rejected=false;try{await pcExcelUnzip(bad.buffer,{kind:'backup'});}catch(e){rejected=/校验|ZIP/.test(String(e.message));}
      if(!rejected)throw Error('mutated workbook passed CRC validation');
      auditResults.push({version:old?'historical':'rule-sheets',zipBytes:bytes.length,workbookBytes:wbBytes.length,attachmentPreserved:true,tamperRejected:true});
     }
     return auditResults;
    })();`))();
   },setup);
   assert.deepEqual(errors,[]);assert.equal(result.length,2);for(const row of result){assert.equal(row.attachmentPreserved,true);assert.equal(row.tamperRejected,true);console.log(`Round149 ${row.version}: actual ZIP build/unzip, original workbook and image exact, damaged ZIP rejected (${row.zipBytes} bytes) PASS`);}
  }catch(err){const dir=process.env.PL_SYNTHETIC_REPORT_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'round149-zip-failure.png')});}throw err;}finally{await page.close();}
 }finally{await browser.close();}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
