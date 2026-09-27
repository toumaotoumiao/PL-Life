'use strict';
/* Dedicated, fresh-origin Chromium evidence test. No personal archive, site data,
 * GitHub credentials or externally hosted resources are accessed. It exercises
 * the production ZIP codec, source-field evidence and actual transaction engine
 * with NATIVE browser localStorage/IndexedDB, then reloads and re-exports.
 * The full application UI route remains a separate acceptance requirement. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const txn=fs.readFileSync(path.join(root,'data-migration-transaction.js'),'utf8');
const preflight=fs.readFileSync(path.join(root,'backup-restore-preflight.js'),'utf8');
function between(begin,end){const a=html.indexOf(begin),b=html.indexOf(end,a);assert(a>=0&&b>a,begin);return html.slice(a,b);}
const code=`function pcMediaSafeName(s){return String(s).replace(/[^a-zA-Z0-9_.-]/g,'_');}\n`+
 between('const PC_ZIP_LIMITS=','function pcExcelSheetRows(')+'\n'+
 between('function pcCrc32Table()','function pcMediaStorageInventory(')+'\n'+
 between('function completeBackupRuleEvidence(','function applyImportedArchiveState(')+'\n'+preflight;
const fixture=String.raw`
const key='trpg_pl_profile_archive_v1';
const dbName='pl_round151_native_idb';
const enc=new TextEncoder(),dec=new TextDecoder();
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)),b=>b.toString(16).padStart(2,'0')).join('');
const toBytes=async b=>new Uint8Array(await b.arrayBuffer());
const equalBytes=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
function openNative(){return new Promise((ok,bad)=>{
 const request=indexedDB.open(dbName,3);
 request.onupgradeneeded=()=>{const db=request.result;
   for(const [name,keyPath] of [['media','id'],['pcWorkbooks','pcId'],['migrationJournal','id']])
    if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath});
 };
 request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error);
 request.onblocked=()=>bad(Error('isolated IndexedDB creation blocked'));
});}
function transactionDone(tx){return new Promise((ok,bad)=>{tx.oncomplete=ok;tx.onabort=()=>bad(tx.error||Error('IDB aborted'));tx.onerror=()=>bad(tx.error||Error('IDB error'));});}
async function readRows(db,name){const tx=db.transaction(name,'readonly'),finished=transactionDone(tx),request=tx.objectStore(name).getAll();const rows=await new Promise((ok,bad)=>{request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error)});await finished;return rows;}
async function writeRows(db,name,rows){const tx=db.transaction(name,'readwrite'),finished=transactionDone(tx),store=tx.objectStore(name);store.clear();for(const row of rows)store.put(row);await finished;}
const pc={id:'pc-1',name:'合成 Insane PC',ownerPlId:'self',avatarMediaId:'img-1',galleryMediaIds:['img-1'],excelSource:{kind:'fixed',fileName:'synthetic.xlsx'},excelEdits:[{sheet:'角色卡',ref:'B6',value:'保留的旧格'}],
 ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',source:'user-selected'},
 ruleData:{traits:[{label:'旧字段',value:'保留'}],future:'unknown'},
 ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[],future:'unknown nested field'},future:{keep:true}},
 coc:{str:55,san:40},skills:[{name:'侦查',value:60}],snapshots:[{id:'growth-1',san:37}]};
const archive={format:'pl-life-complete-backup',schemaVersion:26,data:{profiles:[{id:'self',name:'我'}],pcs:[pc],modules:[{id:'mod-1',name:'合成 BRP 模组',ruleMeta:{familyId:'brp',systemId:'brp-generic',editionId:''},rules:'自定义规则原文'}],runPlans:[{id:'plan-1',moduleId:'mod-1',ruleMeta:{familyId:'brp',systemId:'brp-generic'},plIds:['self']}],runRecords:[{id:'record-1',moduleId:'mod-1',ruleMeta:null,plIds:['self'],logUrls:['https://example.invalid/log']}],settings:{}}};
const incoming=archive.data;
const mediaBytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const metaMedia={id:'img-1',pcId:'pc-1',type:'image/png',name:'synthetic.png',createdAt:1};
const metaWorkbook={pcId:'pc-1',kind:'fixed',name:'synthetic.xlsx',createdAt:1};
const imageRow={...metaMedia,blob:new Blob([mediaBytes],{type:'image/png'})};
async function createWorkbook(){return new Uint8Array(await(await pcMakeZipEntries([
 {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
 {name:'xl/workbook.xml',data:'<workbook/>'}
])).arrayBuffer());}
async function pack(archiveText,media,workbook){
 const a=enc.encode(archiveText),mediaName='media/img-1.png',wbName='workbooks/pc-1.xlsx';
 const manifest={format:'pl-life-complete-backup',version:1,backupMode:'complete',archivePath:'archive.json',archiveSha256:await digest(a),mediaCount:1,
  media:[{id:'img-1',pcId:'pc-1',path:mediaName,type:'image/png',size:media.length,crc32:pcCrc32(media),sha256:await digest(media)}],
  workbooks:[{pcId:'pc-1',path:wbName,kind:'fixed',size:workbook.length,crc32:pcCrc32(workbook),sha256:await digest(workbook)}]};
 return await pcMakeZipEntries([{name:'manifest.json',data:JSON.stringify(manifest)},{name:'archive.json',data:a},{name:mediaName,data:media},{name:wbName,data:workbook}]);
}
async function verifyPacked(blob,originalText,media,workbook){
 const files=await pcExcelUnzip(await blob.arrayBuffer(),{kind:'backup'}),manifest=JSON.parse(dec.decode(files['manifest.json'])),archiveText=dec.decode(files['archive.json']),parsed=JSON.parse(archiveText);
 if(archiveText!==originalText||manifest.archiveSha256!==await digest(enc.encode(originalText))||
    !equalBytes(files['media/img-1.png'],media)||!equalBytes(files['workbooks/pc-1.xlsx'],workbook))throw Error('ZIP round-trip changed data or bytes');
 const p=PLBackupRestorePreflight.audit(manifest,parsed,files);if(p.mediaCount!==1||p.workbookCount!==1)throw Error('ZIP preflight count');
 return parsed;
}
async function assertNativeRows(db,media,workbook){
 const images=await readRows(db,'media'),books=await readRows(db,'pcWorkbooks');
 if(images.length!==1||books.length!==1||!equalBytes(await toBytes(images[0].blob),media)||!equalBytes(await toBytes(books[0].blob),workbook))throw Error('native IndexedDB bytes changed');
 return {images,books};
}
`;
async function main(){
 const server=http.createServer((req,res)=>{if(req.url==='/data-migration-transaction.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(txn);}else{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end('<!doctype html><meta charset="utf-8"><title>PL isolated recovery fixture</title><script src="/data-migration-transaction.js"></script><main>synthetic restore only</main>');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=`http://127.0.0.1:${server.address().port}/fixture`,report=process.env.PL_SYNTHETIC_REPORT_DIR;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(address,{waitUntil:'load'});await page.addScriptTag({content:code});
  const before=await page.evaluate(src=>new Function(src+`\nreturn (async()=>{
    localStorage.clear();const db=await openNative(),old=JSON.stringify({format:'historical',data:{pcs:[{id:'pc-1',name:'old CoC PC',coc:{san:55}}]}});
    const workbook=await createWorkbook(),oldMedia=new Uint8Array([137,80,78,71,13,10,26,10,7]);
    await writeRows(db,'media',[{...metaMedia,blob:new Blob([oldMedia],{type:'image/png'})}]);
    await writeRows(db,'pcWorkbooks',[{...metaWorkbook,blob:new Blob([workbook])}]);
    localStorage.setItem(key,old);const archiveText=JSON.stringify(archive),frozen=completeBackupRuleEvidence(incoming);
    const zip=await pack(archiveText,mediaBytes,workbook),parsed=await verifyPacked(zip,archiveText,mediaBytes,workbook);
    if(completeBackupRuleEvidence(parsed.data)!==frozen)throw Error('source field evidence mismatched after ZIP parse');
    const expectedMedia=[{...metaMedia,blob:new Blob([mediaBytes],{type:'image/png'})}],expectedBooks=[{...metaWorkbook,blob:new Blob([workbook])}];
    const committed=await PLDataMigrationTransaction.run({storage:localStorage,openDb:async()=>db,expectedOriginalRaw:old,
      mediaRows:expectedMedia,workbookRows:expectedBooks,
      verifyTarget:async()=>{await assertNativeRows(db,mediaBytes,workbook);},
      verifyOriginal:async()=>{await assertNativeRows(db,oldMedia,workbook);},
      commitArchive:async()=>{localStorage.setItem(key,archiveText);},
      verifyArchive:async text=>{if(completeBackupRuleEvidence(JSON.parse(text).data)!==frozen)throw Error('frozen source lost after commit');}
    });
    if(committed.status!=='committed'||localStorage.getItem(PLDataMigrationTransaction.KEY)!==null)throw Error('not durably committed');
    await assertNativeRows(db,mediaBytes,workbook);
    sessionStorage.setItem('fixture-original',archiveText);sessionStorage.setItem('fixture-evidence',frozen);
    return {committed:committed.status,zipBytes:zip.size,originalImageBytes:mediaBytes.length,workbookBytes:workbook.length};
   })();`)(),fixture);
  // One real navigation, fresh JS memory and fresh native IndexedDB connection.
  await page.reload({waitUntil:'load'});await page.addScriptTag({content:code});
  const after=await page.evaluate(src=>new Function(src+`\nreturn (async()=>{
   const expected=sessionStorage.getItem('fixture-original'),frozen=sessionStorage.getItem('fixture-evidence');
   if(!expected||!frozen)throw Error('reload source evidence missing');
   const saved=localStorage.getItem(key),persisted=JSON.parse(saved);
   if(saved!==expected||completeBackupRuleEvidence(persisted.data)!==frozen)throw Error('reload changed imported rule records');
   if((await PLDataMigrationTransaction.recover({storage:localStorage,openDb:openNative,verifyOriginal:async()=>{}})).status!=='idle')throw Error('unexpected restore journal after reload');
   const db=await openNative(),workbook=await createWorkbook();await assertNativeRows(db,mediaBytes,workbook);
   const repack=await pack(saved,await toBytes((await readRows(db,'media'))[0].blob),await toBytes((await readRows(db,'pcWorkbooks'))[0].blob));
   const exported=await verifyPacked(repack,expected,mediaBytes,workbook);
   if(completeBackupRuleEvidence(exported.data)!==frozen)throw Error('re-export dropped rule data');
   // A second attempted recovery with an injected pre-commit readback failure
   // must preserve the already committed archive and both original attachments.
   let refused=false;
   try{await PLDataMigrationTransaction.run({storage:localStorage,openDb:async()=>db,expectedOriginalRaw:saved,
      mediaRows:[{...metaMedia,blob:new Blob([new Uint8Array([1,2,3])])}],workbookRows:[{...metaWorkbook,blob:new Blob([workbook])}],
      verifyTarget:async()=>{throw Error('injected new source readback failure');},
      verifyOriginal:async()=>{await assertNativeRows(db,mediaBytes,workbook);},
      commitArchive:async()=>{throw Error('should not commit');},verifyArchive:async()=>{}
    });}catch(e){refused=/injected new source readback failure/.test(String(e.message));}
   if(!refused||localStorage.getItem(key)!==saved||localStorage.getItem(PLDataMigrationTransaction.KEY)!==null)throw Error('failed retry changed source or retained marker');
   await assertNativeRows(db,mediaBytes,workbook);
   return {reloaded:true,ruleSheetsPersisted:true,sourceEvidenceVerified:true,nativeAttachmentsVerified:true,reexportVerified:true,failureRolledBack:true,reexportBytes:repack.size};
 })();`)(),fixture);
  assert.deepEqual(errors,[]);assert.equal(before.committed,'committed');assert.equal(after.reexportVerified,true);
  if(report){fs.mkdirSync(report,{recursive:true});fs.writeFileSync(path.join(report,'round151-native-storage-result.json'),JSON.stringify({before,after},null,2));}
  console.log('Round151 native Chromium isolated ZIP → IndexedDB/localStorage commit → reload → re-export → failed retry rollback PASS');
  console.log(JSON.stringify({before,after}));
  await context.close();
 }catch(error){
  if(report){fs.mkdirSync(report,{recursive:true});fs.writeFileSync(path.join(report,'round151-native-storage-error.txt'),String(error.stack||error));}
  throw error;
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
