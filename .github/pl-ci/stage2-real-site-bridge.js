/* Stage 2 synthetic integration bridge. Engineering-only; never ship with the website. */
(function () {
  'use strict';
  if (window.__plStage2SyntheticBridge) return;
  const bytes = blob => blob ? blob.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer))) : Promise.resolve(null);
 // JSON object insertion order may change when settings are normalized on import.
 // Preserve array order and EVERY field value, including legacy sidecar entries.
 const semanticText = value => JSON.stringify(value,function(key,item){
   if(item===null||typeof item!=='object'||Array.isArray(item))return item;
   const ordered=Object.create(null);
   Object.keys(item).sort().forEach(name=>{ordered[name]=item[name];});
   return ordered;
 });
 const archiveCore = archive => semanticText({settings:archive.settings,data:archive.data,
   heritage:Number(archive.schemaVersion)>=24?(archive.heritage||null):null});
 // Export fixed boolean categories only; do not export any archive value, user-defined
 // key, identifier, filename, exception message or actual browser storage.
 const compareArchiveSections = (before,after) => {
   const sections=['settings','profiles','pcs','modules','runs','heritage'];
   return Object.fromEntries(sections.map(name=>{
     const select=source=>name==='settings'?source.settings:
       name==='heritage'?(Number(source.schemaVersion)>=24?(source.heritage||null):null):
       source.data?.[name];
     return [name,semanticText(select(before))===semanticText(select(after))];
   }));
 };
  const bridge = {
    status() {
      return {
        version: APP_UI_VERSION,
        protected: Boolean(migrationReadOnly),
        zip: typeof buildUnifiedCompleteBackupBlob,
        parse: typeof parseUnifiedCompleteBackupFile,
        restore: typeof restoreUnifiedCompleteBackup
      };
    },
    async run(action) {
      switch (action) {
        case 'fixtures': {
          const db = await openPcMediaDb();
          const tx = db.transaction([PC_MEDIA_STORE, PC_WORKBOOK_STORE], 'readwrite');
          tx.objectStore(PC_MEDIA_STORE).put({
            id: '__stage2_synthetic_image', pcId: '__stage2_synthetic_none',
            name: 'synthetic.png', type: 'image/png', note: 'synthetic-only',
            blob: new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:'image/png'}),
            thumbBlob: new Blob([new Uint8Array([1,2,3,4])], {type:'image/png'})
          });
          tx.objectStore(PC_WORKBOOK_STORE).put({
            pcId: '__stage2_synthetic_workbook', fileName: 'synthetic.xlsx', kind:'fixed',
            blob: new Blob([new Uint8Array([80,75,3,4,5,6])], {type:PC_XLSX_MIME})
          });
          await pcMediaTxDone(tx);
          return [(await pcMediaAllRows()).length, (await pcWorkbookAllRows()).length];
        }
        case 'export': {
          window.__stage2SyntheticZip = await buildUnifiedCompleteBackupBlob();
          const file = new File([window.__stage2SyntheticZip.blob], 'stage2_synthetic.zip', {type:'application/zip'});
          const verified = await verifyCompleteBackupZipFile(file);
          const prepared = await parseUnifiedCompleteBackupFile(file);
          window.__stage2SyntheticBackupCore = archiveCore(prepared.raw);
          window.__stage2SyntheticBackupArchive = prepared.raw;
          const a = prepared.rows.find(x=>x.id==='__stage2_synthetic_image');
          const b = prepared.workbookRows.find(x=>x.pcId==='__stage2_synthetic_workbook');
          return {
            bytes:file.size,mode:prepared.manifest.backupMode,
            unlinkedMedia:prepared.manifest.unlinkedAttachments?.media?.length,
            unlinkedBooks:prepared.manifest.unlinkedAttachments?.workbooks?.length,
            image:await bytes(a?.blob),thumb:await bytes(a?.thumbBlob),note:a?.note,
            book:await bytes(b?.blob),verified:!!verified
          };
        }
        case 'mutate': {
          const beforeArchive=buildCanonicalArchive(true);
         window.__stage2SyntheticBefore=archiveDataFingerprint(beforeArchive);
         window.__stage2SyntheticBeforeCore=archiveCore(beforeArchive);
         window.__stage2SyntheticBeforeArchive=beforeArchive;
         // Backups must already match the user's pre-mutation archive before testing restore.
         if(!window.__stage2SyntheticBackupCore||window.__stage2SyntheticBackupCore!==window.__stage2SyntheticBeforeCore)
           throw Error('合成备份与修改前档案不一致；停止恢复测试');
          const p = profiles.find(x=>String(x.systemRole||'')==='self');
          if (!p) throw Error('默认虚构本人档案缺失');
          // The real site reserves self.name="我" and normalizes it on every save.
          // Only self.displayName is user-editable and survives canonicalization.
          p.displayName = '仅供隔离验收的虚构显示名称';
          if (!saveState()) throw Error('正式保存返回失败');
          const changed = archiveDataFingerprint(buildCanonicalArchive(true));
          const storedRaw = localStorage.getItem(STORAGE_KEY);
          const stored = storedRaw && archiveDataFingerprint(JSON.parse(storedRaw)) === changed;
          return {changed:changed!==window.__stage2SyntheticBefore,stored:!!stored};
        }
        case 'restore': {
          const file = new File([window.__stage2SyntheticZip.blob], 'stage2_synthetic.zip', {type:'application/zip'});
          const priorConfirm = appConfirm;
          let ok=false,issue='NONE',stage='before-restore';
          /* Every exported diagnostic is a fixed code or boolean; never export records,
           * file contents, filenames, raw exception strings or browser storage. */
          const classify = error => {
            const message=String(error?.message||'');
            if (/无法创建恢复前安全快照|创建恢复点失败/.test(message))return 'RECOVERY_SNAPSHOT';
            if (/恢复后的主档案未成功提交/.test(message))return 'ARCHIVE_UNCHANGED';
            if (/档案写入失败|本地保存失败/.test(message))return 'ARCHIVE_WRITE';
            if (/恢复后档案回读校验失败|档案结构校验失败/.test(message))return 'ARCHIVE_VERIFY';
            if (/图片|缩略图|Excel|附件/.test(message))return 'ATTACHMENT_VERIFY';
            if (/只读|保护标记|事务标记|事务日志|恢复中断/.test(message))return 'TRANSACTION_PROTECTED';
            if (/其他标签页|另一个页面|正在保存|同步/.test(message))return 'CONCURRENT_WRITE';
            if (/无法识别|无效|校验|ZIP|备份/.test(message))return 'PRECONDITION_OR_BACKUP';
            if (error?.name==='QuotaExceededError')return 'QUOTA';
            return 'UNCLASSIFIED_ERROR';
          };
          try {
            appConfirm = async()=>true;
            stage='restore-call';
            try {ok=await restoreUnifiedCompleteBackup(file);if(ok!==true)issue='RESTORE_RETURNED_FALSE';}
            catch(error){issue=classify(error);}
            stage='post-restore-readback';
            let after='',stored=false,image=false,thumb=false,book=false,marker=true;
            let restoredCore='',restoredArchive=null;
           try {restoredArchive=buildCanonicalArchive(true);
             after=archiveDataFingerprint(restoredArchive);restoredCore=archiveCore(restoredArchive);
           }catch(_){issue=issue==='NONE'?'ARCHIVE_READ_ERROR':issue;}
            try {const raw=localStorage.getItem(STORAGE_KEY);stored=!!raw&&archiveDataFingerprint(JSON.parse(raw))===after;}catch(_){}
            try {const row=(await pcMediaAllRows()).find(x=>x.id==='__stage2_synthetic_image');
             image=JSON.stringify(await bytes(row?.blob))==='[137,80,78,71,13,10,26,10]';
             thumb=JSON.stringify(await bytes(row?.thumbBlob))==='[1,2,3,4]';
           }catch(_){}
           try {const row=(await pcWorkbookAllRows()).find(x=>x.pcId==='__stage2_synthetic_workbook');
             book=JSON.stringify(await bytes(row?.blob))==='[80,75,3,4,5,6]';
           }catch(_){}
            try {marker=!!PLDataMigrationTransaction.getMarker(localStorage);}catch(_){}
            return {ok,original:!!restoredCore&&restoredCore===window.__stage2SyntheticBeforeCore&&restoredCore===window.__stage2SyntheticBackupCore,
              sectionChecks:restoredArchive&&window.__stage2SyntheticBeforeArchive?
               compareArchiveSections(window.__stage2SyntheticBeforeArchive,restoredArchive):null,
              stored,image,thumb,book,marker,issue,stage};
          } finally {appConfirm = priorConfirm;}
        }
        case 'source-drift': {
          // Simulate an uncooperative old tab writing a NEWER archive while
          // the restore confirmation is open. Only synthetic, isolated storage.
          const archiveBefore=localStorage.getItem(STORAGE_KEY);
          const newer=JSON.parse(archiveBefore);
          const self=newer?.data?.profiles?.find(x=>String(x.systemRole||'')==='self');
          if(!self)throw Error('Synthetic self record missing');
          // The canonical profile stores its editable display name under identity.
          // Writing a top-level displayName creates an unsupported test-only key;
          // startup correctly drops it, which would falsely fail the upgrade test.
          if(!self.identity || typeof self.identity!=='object') throw Error('Synthetic canonical identity missing');
          self.identity.displayName='仅供隔离验收的另一个标签页新数据';
          const newerRaw=JSON.stringify(newer);
          if(newerRaw===archiveBefore)throw Error('Synthetic concurrent edit unchanged');
          const mediaBefore=await pcMediaAllRows(),workbookBefore=await pcWorkbookAllRows();
          const mediaEvidence=await Promise.all(mediaBefore.map(async row=>[row.id,await bytes(row.blob),await bytes(row.thumbBlob)]));
          const workbookEvidence=await Promise.all(workbookBefore.map(async row=>[row.pcId,await bytes(row.blob)]));
          const oldConfirm=appConfirm;
          let refused=false,injected=false;
          try{
            appConfirm=async()=>{localStorage.setItem(STORAGE_KEY,newerRaw);injected=true;return true};
            const file=new File([window.__stage2SyntheticZip.blob],'stage2_synthetic.zip',{type:'application/zip'});
            try{await restoreUnifiedCompleteBackup(file)}catch(_){refused=true;}
          }finally{appConfirm=oldConfirm;}
          const mediaAfter=await pcMediaAllRows(),workbookAfter=await pcWorkbookAllRows();
          const currentMedia=await Promise.all(mediaAfter.map(async row=>[row.id,await bytes(row.blob),await bytes(row.thumbBlob)]));
          const currentBooks=await Promise.all(workbookAfter.map(async row=>[row.pcId,await bytes(row.blob)]));
          const sameRows=(a,b)=>semanticText(a)===semanticText(b);
          let noMarker=false;
          try{noMarker=!PLDataMigrationTransaction.getMarker(localStorage)}catch(_){noMarker=false}
          return {injected,refused,newerPreserved:localStorage.getItem(STORAGE_KEY)===newerRaw,
            mediaPreserved:sameRows(mediaEvidence,currentMedia),workbookPreserved:sameRows(workbookEvidence,currentBooks),noMarker};
        }
        case 'migration-inspect': {
          // Report only fixed boolean checks and a fixed phase code. The synthetic
          // ZIP, localStorage, attachment rows and exception text never leave the browser.
          let phase='BASELINE';
          const result={valid:false,enabled:false,details:false,corruptRejected:false,
            staleCleared:false,reverified:false,noArchiveWrite:false,
            noAttachmentWrite:false,failureStage:'NONE'};
          try{
            const file=new File([window.__stage2SyntheticZip.blob],'synthetic-transfer.zip',{type:'application/zip'});
            const archiveBefore=localStorage.getItem(STORAGE_KEY);
            const mediaBefore=await pcMediaAllRows(),booksBefore=await pcWorkbookAllRows();
            const beforeMedia=await Promise.all(mediaBefore.map(async row=>[row.id,await bytes(row.blob),await bytes(row.thumbBlob)]));
            const beforeBooks=await Promise.all(booksBefore.map(async row=>[row.pcId,await bytes(row.blob)]));
            phase='VALID_INSPECTION';
            result.valid=await inspectDeviceMigrationInput(file);
            result.enabled=document.getElementById('deviceMigrationRestoreBtn')?.disabled===false;
            const summary=document.getElementById('deviceMigrationInspectStatus')?.textContent||'';
            result.details=summary.includes('只读核验')&&summary.includes('关联图片 0')&&summary.includes('关联原始 Excel 0')&&summary.includes('未关联图片 1')&&summary.includes('未关联原始 Excel 1');
            phase='CORRUPT_INSPECTION';
            const corrupt=new File([new Uint8Array([80,75,0,0,1])],'synthetic-broken.zip',{type:'application/zip'});
            result.corruptRejected=(await inspectDeviceMigrationInput(corrupt))===false;
            result.staleCleared=document.getElementById('deviceMigrationRestoreBtn')?.disabled===true;
            phase='REINSPECTION';
            result.reverified=await inspectDeviceMigrationInput(file);
            phase='READBACK';
            const currentMedia=await Promise.all((await pcMediaAllRows()).map(async row=>[row.id,await bytes(row.blob),await bytes(row.thumbBlob)]));
            const currentBooks=await Promise.all((await pcWorkbookAllRows()).map(async row=>[row.pcId,await bytes(row.blob)]));
            result.noArchiveWrite=localStorage.getItem(STORAGE_KEY)===archiveBefore;
            result.noAttachmentWrite=semanticText(beforeMedia)===semanticText(currentMedia)&&semanticText(beforeBooks)===semanticText(currentBooks);
          }catch(_){result.failureStage=phase;}
          return result;
        }
        case 'migration-restore': {
          const modified=await bridge.run('mutate');
          const oldConfirm=appConfirm;
          let success=false;
          try{appConfirm=async()=>true;success=await restoreVerifiedDeviceMigrationFile();}
          finally{appConfirm=oldConfirm;}
          const original=archiveCore(buildCanonicalArchive(true))===window.__stage2SyntheticBackupCore;
          const storedRaw=localStorage.getItem(STORAGE_KEY);
          const stored=!!storedRaw&&archiveDataFingerprint(JSON.parse(storedRaw))===archiveDataFingerprint(buildCanonicalArchive(true));
          const imageRow=(await pcMediaAllRows()).find(row=>row.id==='__stage2_synthetic_image');
          const bookRow=(await pcWorkbookAllRows()).find(row=>row.pcId==='__stage2_synthetic_workbook');
          const image=JSON.stringify(await bytes(imageRow?.blob))==='[137,80,78,71,13,10,26,10]';
          const thumb=JSON.stringify(await bytes(imageRow?.thumbBlob))==='[1,2,3,4]';
          const book=JSON.stringify(await bytes(bookRow?.blob))==='[80,75,3,4,5,6]';
          const reset=document.getElementById('deviceMigrationRestoreBtn')?.disabled===true;
          return {modified:modified.changed&&modified.stored,success,original,stored,image,thumb,book,reset};
        }
        case 'prepare-same-origin-upgrade': {
          // Isolated random localhost port only; never point this engineering bridge at a real website.
          const rawText=localStorage.getItem(STORAGE_KEY);
          if(!rawText)throw Error('synthetic archive missing');
          const prior=JSON.parse(rawText);
          if(!Array.isArray(prior.data?.profiles)||!prior.data.profiles.length)throw Error('synthetic profile missing');
          prior.app={...prior.app,uiVersion:'8.1.12.63'};
          const olderText=JSON.stringify(prior);
          sessionStorage.setItem('__pl_stage3_expected_upgrade_core',archiveCore(prior));
          localStorage.setItem(STORAGE_KEY,olderText);
          if(localStorage.getItem(STORAGE_KEY)!==olderText)throw Error('synthetic source write failed');
          return {prepared:true};
        }
        case 'verify-same-origin-upgrade': {
          const expected=sessionStorage.getItem('__pl_stage3_expected_upgrade_core');
          const savedText=localStorage.getItem(STORAGE_KEY);
          const saved=savedText?JSON.parse(savedText):null;
          const guardText=localStorage.getItem(UPGRADE_GUARD_KEY);
          const guard=guardText?JSON.parse(guardText):null;
          const stored=Boolean(expected&&saved&&archiveCore(saved)===expected);
          const memory=Boolean(expected&&archiveCore(buildCanonicalArchive(false))===expected);
          const source=Boolean(guard?.payload?.app?.uiVersion==='8.1.12.63'&&archiveCore(guard.payload)===expected);
          const version=Boolean(saved?.app?.uiVersion===APP_UI_VERSION);
          const media=(await pcMediaAllRows()).find(row=>row.id==='__stage2_synthetic_image');
          const workbook=(await pcWorkbookAllRows()).find(row=>row.pcId==='__stage2_synthetic_workbook');
          const attachments=JSON.stringify(await bytes(media?.blob))==='[137,80,78,71,13,10,26,10]'&&
              JSON.stringify(await bytes(media?.thumbBlob))==='[1,2,3,4]'&&
              JSON.stringify(await bytes(workbook?.blob))==='[80,75,3,4,5,6]';
          let noMarker=false;try{noMarker=!PLDataMigrationTransaction.getMarker(localStorage)}catch(_){}
          sessionStorage.removeItem('__pl_stage3_expected_upgrade_core');
          return {stored,memory,source,version,attachments,noMarker,unprotected:!migrationReadOnly};
        }
        case 'bad-zip': {
          const before = archiveDataFingerprint(JSON.parse(localStorage.getItem(STORAGE_KEY)));
          let refused=false;
          try {await restoreUnifiedCompleteBackup(new File([new Uint8Array([80,75,0,0,1])], 'broken.zip', {type:'application/zip'}));}
          catch (_) {refused=true;}
          return {refused,same:before===archiveDataFingerprint(JSON.parse(localStorage.getItem(STORAGE_KEY)))};
        }
        default: throw Error('Unsupported synthetic test action');
      }
    }
  };
  Object.defineProperty(window,'__plStage2SyntheticBridge',{value:bridge,writable:false,configurable:false});
})();
