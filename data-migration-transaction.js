/* PL收集梦想生活 · full-ZIP restoration crash journal, schema23. No network or external dependencies.
 * Archived data and media are separate stores; this module provides recoverable rollback, NOT
 * a single atomic transaction across localStorage and IndexedDB. */
(function(root){
'use strict';
const KEY='tomato_pl_restore_transaction_v1', STORE='migrationJournal', JOURNAL_ID='active';
// Reserve the workspace restore marker before the experimental workflow is enabled.
// This guards new-version writers; old tabs are not covered and must be closed.
const WORKSPACE_KEY='tomato_pl_workspace_restore_transaction_v1';
const ARCHIVE_KEY='trpg_pl_profile_archive_v1';
const MEDIA='media', WORKBOOKS='pcWorkbooks';
let committing=false,activeId=null;
function fail(message){throw new Error(message);}
function getMarker(storage){
  const raw=storage.getItem(KEY);
  if(raw===null)return null;
  let m;try{m=JSON.parse(raw);}catch(_){fail('完整备份恢复记录已损坏，请保留网站数据并联系制作者');}
  if(!m||m.version!==1||typeof m.id!=='string'||!/^[a-f0-9-]{16,80}$/.test(m.id)||!['preparing','settled'].includes(m.phase)||typeof m.beforeHash!=='string'||(m.abortReason!==undefined&&m.abortReason!=='source-drift')||(m.candidateHash!==undefined&&!/^[a-f0-9]{64}$/.test(m.candidateHash)))fail('完整备份恢复记录格式异常，请保留网站数据');
  return m;
}
function ensureWorkspaceIdle(storage){
  // Even an unknown or malformed marker must block destructive writes.
  if(storage.getItem(WORKSPACE_KEY)!==null)fail('工作空间恢复尚未处理，已暂停修改；请保留网站数据');
}
function ensureIdle(storage){ensureWorkspaceIdle(storage);if(getMarker(storage))fail('上次完整备份恢复尚未处理，已禁止修改数据');}
function assertOwner(storage,marker){if(getMarker(storage)?.id!==marker.id)fail('完整备份恢复事务已被另一页面更改，已停止写入');}
function assertWritable(storage){ensureWorkspaceIdle(storage);if(committing){if(getMarker(storage)?.id!==activeId)fail('完整备份恢复标记被其他页面更改，已禁止提交');return;}ensureIdle(storage);}
function textBytes(s){return new TextEncoder().encode(JSON.stringify({value:s}));}
async function sha(s){
  if(!root.crypto?.subtle)fail('当前环境无法验证恢复事务的 SHA-256，请使用 HTTPS 或支持 Web Crypto 的浏览器');
  return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',textBytes(s))),b=>b.toString(16).padStart(2,'0')).join('');
}
function done(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('本地附件事务失败'));tx.onabort=()=>reject(tx.error||new Error('本地附件事务中止'));});}
function req(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('事务日志读取失败'));});}
function storesPresent(db){for(const s of [MEDIA,WORKBOOKS,STORE])if(!db.objectStoreNames.contains(s))fail('恢复数据库缺少 '+s+'，已停止改写');}
async function readJournal(db){storesPresent(db);const tx=db.transaction([STORE],'readonly'),p=done(tx),row=await req(tx.objectStore(STORE).get(JOURNAL_ID));await p;return row||null;}
/* Binary-free target evidence. A settled crash must recheck BOTH the archive
 * and attachment bytes/metadata before deleting the last rollback journal. */
async function hashBytes(bytes){
  if(!root.crypto?.subtle)fail('无法读取 SHA-256，已保留原始事务日志');
  return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
async function evidenceRows(rows,keyField){
  if(!Array.isArray(rows))fail('附件证据清单格式异常');
  const seen=new Set(),result=[];
  for(const row of rows){
    const key=row?.[keyField];
    if(typeof key!=='string'||!key||seen.has(key)||!row.blob||typeof row.blob.arrayBuffer!=='function')
      fail('附件证据缺少有效编号、原件或包含重复编号');
    seen.add(key);
    const meta=Object.fromEntries(Object.entries(row).filter(([k])=>k!=='blob'&&k!=='thumbBlob'));
    const metaText=JSON.stringify(meta);
    if(typeof metaText!=='string')fail('附件元数据无法编码');
    const thumb=row.thumbBlob;
    if(thumb&&typeof thumb.arrayBuffer!=='function')fail('缩略图无法校验');
    result.push({key,meta:await hashBytes(new TextEncoder().encode(metaText)),
      blob:await hashBytes(await row.blob.arrayBuffer()),
      thumb:thumb?await hashBytes(await thumb.arrayBuffer()):null});
  }
  result.sort((x,y)=>x.key<y.key?-1:x.key>y.key?1:0);
  return result;
}
async function buildEvidence(media,workbooks){return {version:1,
  media:await evidenceRows(media,'id'),workbooks:await evidenceRows(workbooks,'pcId')};}
async function verifyTargetEvidence(db,expected){
  if(!expected||expected.version!==1||!Array.isArray(expected.media)||!Array.isArray(expected.workbooks))
    fail('候选附件缺少完整证据，已保留事务日志');
  const tx=db.transaction([MEDIA,WORKBOOKS],'readonly'),p=done(tx);
  const a=req(tx.objectStore(MEDIA).getAll()),b=req(tx.objectStore(WORKBOOKS).getAll());
  const [media,workbooks]=await Promise.all([a,b]);await p;
  const actual=await buildEvidence(media,workbooks);
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('已提交附件与事务证据不一致，禁止清理保护日志');
  return true;
}

async function discardJournal(db){const tx=db.transaction([STORE],'readwrite'),p=done(tx);tx.objectStore(STORE).delete(JOURNAL_ID);await p;}
function replaceStores(db,media,workbooks){
  const tx=db.transaction([MEDIA,WORKBOOKS],'readwrite'),p=done(tx);
  try{
    const ms=tx.objectStore(MEDIA),ws=tx.objectStore(WORKBOOKS);ms.clear();ws.clear();
    for(const row of media)ms.put(row);
    for(const row of workbooks)ws.put(row);
  }catch(error){
    // A synchronous DataCloneError/invalid key may occur AFTER clear().
    // Abort immediately so the browser cannot commit an emptied store.
    try{tx.abort();}catch(_){}
    void p.catch(()=>{});
    throw error;
  }
  return p;
}
/* One native IndexedDB transaction captures the ORIGINAL rows and replaces both attachment
 * stores; the previous rows and archive are durably recorded in that SAME transaction. */
function swapWithJournal(db,marker,beforeRaw,media,workbooks,targetEvidence){
  storesPresent(db);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([MEDIA,WORKBOOKS,STORE],'readwrite');
    const ms=tx.objectStore(MEDIA),ws=tx.objectStore(WORKBOOKS),js=tx.objectStore(STORE);
    let originalMedia=null,originalWorkbooks=null,existingJournal=undefined,queued=false;
    const r1=ms.getAll(),r2=ws.getAll(),r3=js.get(JOURNAL_ID);
    const queue=()=>{
      if(queued||!originalMedia||!originalWorkbooks||existingJournal===undefined)return;queued=true;
      if(existingJournal!==null){tx.abort();return;}
      try{
        js.put({id:JOURNAL_ID,transactionId:marker.id,createdAt:marker.createdAt,beforeRaw,originalMedia,originalWorkbooks,targetEvidence});
        ms.clear();ws.clear();
        for(const row of media)ms.put(row);
        for(const row of workbooks)ws.put(row);
      }catch(error){
        // Fail CLOSED even if a request throws synchronously inside an IDB
        // success callback; the journal and both stores share this transaction.
        try{tx.abort();}catch(_){}
        reject(error);
      }
    };
    r1.onsuccess=()=>{originalMedia=r1.result||[];queue();};
    r2.onsuccess=()=>{originalWorkbooks=r2.result||[];queue();};
    r3.onsuccess=()=>{existingJournal=r3.result||null;queue();};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('候选附件写入失败'));
    tx.onabort=()=>reject(tx.error||new Error('候选附件写入已中止'));
  });
}
function writeMarker(storage,marker){storage.setItem(KEY,JSON.stringify(marker));const actual=getMarker(storage);if(!actual||actual.id!==marker.id||actual.phase!==marker.phase)fail('事务标记无法回读，已取消恢复');}
function restoreRaw(storage,raw){
  if(raw===null)storage.removeItem(ARCHIVE_KEY);else storage.setItem(ARCHIVE_KEY,raw);
  if(storage.getItem(ARCHIVE_KEY)!==raw)fail('恢复前主档案回读不一致，请勿清除浏览器数据');
}
async function finalize(storage,db,marker,expectedArchiveRaw,settlement){
  if(settlement!=='target'&&settlement!=='original')fail('恢复结算方向无效');
  // Hashing yields to the event loop. Never adopt a third-party write as the
  // destination hash, or erase the original journal while source drift exists.
  const targetHash=await sha(expectedArchiveRaw);
  assertOwner(storage,marker);
  if(storage.getItem(ARCHIVE_KEY)!==expectedArchiveRaw)
    fail('恢复结算期间其他页面更新主档案；保留原始恢复日志');
  writeMarker(storage,{...marker,phase:'settled',targetHash,settlement});
  if(storage.getItem(ARCHIVE_KEY)!==expectedArchiveRaw)
    fail('清理恢复日志前主档案变化；保留原始恢复日志');
  await discardJournal(db);
  // If an uncooperative old tab writes during IDB cleanup, retain the marker:
  // restart recovery must reject a mismatched archive rather than report success.
  if(storage.getItem(ARCHIVE_KEY)!==expectedArchiveRaw)
    fail('清理恢复日志期间主档案变化；保留只读保护标记');
  storage.removeItem(KEY);
  if(storage.getItem(KEY)!==null)fail('已恢复数据，但无法清理事务标记，请刷新后重试');
}
async function rollback(storage,db,marker,journal,verifyOriginal){
  if(!journal||journal.transactionId!==marker.id||!Array.isArray(journal.originalMedia)||!Array.isArray(journal.originalWorkbooks))fail('恢复事务日志不完整；已进入只读保护，切勿清理网站数据');
  if(await sha(journal.beforeRaw)!==marker.beforeHash)fail('恢复事务中的原始档案校验失败；请保留网站数据');
  // An old tab can write a third archive after the attachment swap and before
  // the restoring tab records its conflict. A restart must not mistake that
  // third archive for our own candidate and silently overwrite it. The only
  // acceptable non-original archive is a candidate proven by our own verified
  // commit, whose digest was durably marked BEFORE any subsequent operation.
  const originalArchiveRaw=storage.getItem(ARCHIVE_KEY);
  if(originalArchiveRaw!==journal.beforeRaw&&
     (!marker.candidateHash||await sha(originalArchiveRaw)!==marker.candidateHash))
    fail('恢复期间主档案存在未确认的新版本；已保留原档案与附件日志，停止自动回滚');
  // For new transactions, do not destroy third-party edits made by an older
  // tab while our restore was interrupted. Preserve all stores and the journal.
  if(journal.targetEvidence){
    const tx=db.transaction([MEDIA,WORKBOOKS],'readonly'),completed=done(tx);
    const mediaReq=req(tx.objectStore(MEDIA).getAll()),bookReq=req(tx.objectStore(WORKBOOKS).getAll());
    const [media,books]=await Promise.all([mediaReq,bookReq]);await completed;
    const current=await buildEvidence(media,books);
    const original=await buildEvidence(journal.originalMedia,journal.originalWorkbooks);
    const acceptable=(a,b,c)=>JSON.stringify(a)===JSON.stringify(b)||JSON.stringify(a)===JSON.stringify(c);
    if(!acceptable(current.media,original.media,journal.targetEvidence.media)||
       !acceptable(current.workbooks,original.workbooks,journal.targetEvidence.workbooks))
      fail('中断期间附件出现第三版本；停止自动回滚，保留原件与事务日志');
  }
  if(storage.getItem(ARCHIVE_KEY)!==originalArchiveRaw)
    fail('回滚附件前主档案发生并发更新；保留恢复日志');
  await replaceStores(db,journal.originalMedia,journal.originalWorkbooks);
  // Preserve journal until BOTH stores and localStorage have passed read-back verification.
  await verifyOriginal(journal.originalMedia,journal.originalWorkbooks);
  if(storage.getItem(ARCHIVE_KEY)!==originalArchiveRaw)
    fail('回滚附件后主档案发生并发更新；保留原档案与恢复日志');
  restoreRaw(storage,journal.beforeRaw);
  if(await sha(storage.getItem(ARCHIVE_KEY))!==marker.beforeHash)fail('恢复前主档案校验失败，已保持事务保护');
  await finalize(storage,db,marker,journal.beforeRaw,'original');
  return {status:'rolled-back',id:marker.id};
}
async function recover(options){
  const {storage,openDb,verifyOriginal}=options;
  // Two independent recovery protocols must never repair the same origin in parallel.
  ensureWorkspaceIdle(storage);
  const marker=getMarker(storage);
  if(!marker)return {status:'idle'};
  // An older tab wrote a newer archive while the new-version attachment swap
  // was underway. The archive belongs to that tab; automatic rollback must
  // not replace it, including after a reload. Keep the journal for review.
  if(marker.abortReason==='source-drift')
    fail('其他页面更新主档案期间发现恢复冲突；已保留新档案和附件恢复日志，请保持只读并联系制作者');
  const db=await openDb(),journal=await readJournal(db);
  if(!journal){
    // No journal means the atomic IDB swap did not commit, OR cleanup already finished.
    const expected=marker.phase==='settled'?marker.targetHash:marker.beforeHash;
    if(!expected||await sha(storage.getItem(ARCHIVE_KEY))!==expected)fail('事务日志缺失，主档案又与记录不一致；请勿继续操作');
    storage.removeItem(KEY);if(getMarker(storage))fail('事务保护标记无法清理');
    return {status:marker.phase==='settled'?(marker.settlement==='original'||!marker.settlement&&marker.targetHash===marker.beforeHash?'rolled-back':'committed'):'not-started',id:marker.id};
  }
  if(journal.transactionId!==marker.id)fail('事务编号不一致，已禁止自动回滚');
  if(marker.phase==='settled'){
    if(!marker.targetHash||await sha(storage.getItem(ARCHIVE_KEY))!==marker.targetHash)
      fail('已提交档案校验失败，自动清理已停止');
    // A ROLLBACK also settles the marker (with the ORIGINAL archive hash).
    // If a crash happens between that marker and journal deletion, comparing
    // the old bytes against incoming targetEvidence would incorrectly strand
    // a correctly rolled-back archive in permanent read-only mode.
    // Verify BOTH original stores and original archive before clearing it.
    if(marker.settlement==='original'||!marker.settlement&&marker.targetHash===marker.beforeHash){
      if(!Array.isArray(journal.originalMedia)||!Array.isArray(journal.originalWorkbooks)||
         await sha(journal.beforeRaw)!==marker.beforeHash)
        fail('回滚日志原件不完整，保留保护标记');
      const tx=db.transaction([MEDIA,WORKBOOKS],'readonly'),completed=done(tx);
      const [media,books]=await Promise.all([
        req(tx.objectStore(MEDIA).getAll()),req(tx.objectStore(WORKBOOKS).getAll())]);
      await completed;
      const actual=await buildEvidence(media,books);
      const original=await buildEvidence(journal.originalMedia,journal.originalWorkbooks);
      if(JSON.stringify(actual)!==JSON.stringify(original))
        fail('回滚后的附件与日志原件不一致，停止清理保护日志');
      await verifyOriginal(journal.originalMedia,journal.originalWorkbooks);
      await discardJournal(db);storage.removeItem(KEY);
      if(getMarker(storage))fail('已回滚数据但无法清理恢复标记');
      return {status:'rolled-back',id:marker.id};
    }
    // Prior releases had no target evidence. They can be safely rolled back
    // from the original journal, but cannot truthfully be confirmed committed.
    if(!journal.targetEvidence)return rollback(storage,db,marker,journal,verifyOriginal);
    await verifyTargetEvidence(db,journal.targetEvidence);
    await discardJournal(db);storage.removeItem(KEY);if(getMarker(storage))fail('事务保护标记无法清理');
    return {status:'committed',id:marker.id};
  }
  return rollback(storage,db,marker,journal,verifyOriginal);
}
async function run(options){
  const {storage,openDb,mediaRows,workbookRows,commitArchive,verifyTarget,verifyOriginal,expectedOriginalRaw}=options;
  ensureIdle(storage);
  if(!Array.isArray(mediaRows)||!Array.isArray(workbookRows))fail('候选附件格式无效');
  const beforeRaw=storage.getItem(ARCHIVE_KEY);
  // The source was approved before the user confirmation and safety snapshot.
  // A newer tab must not become the silently adopted source during that delay.
  if(Object.prototype.hasOwnProperty.call(options,'expectedOriginalRaw')&&beforeRaw!==expectedOriginalRaw)
    fail('确认恢复期间主档案已变化；请同步后重新预览，未覆盖任何数据');
  const targetEvidence=await buildEvidence(mediaRows,workbookRows);
  let marker={version:1,id:(root.crypto?.randomUUID?.()||'').toLowerCase(),phase:'preparing',createdAt:Date.now(),beforeHash:await sha(beforeRaw)};
  if(!marker.id)fail('当前浏览器无法创建可靠的事务编号');
  // Hashing attachment bytes yields to the event loop. Another tab may save a
  // newer archive during that interval. Never log the stale source as original.
  ensureIdle(storage);
  if(storage.getItem(ARCHIVE_KEY)!==beforeRaw)
    fail('生成恢复日志时其他页面已更新主档案；本次恢复未启动，原始数据未覆盖');
  writeMarker(storage,marker);
  let db,sourceConflict=false,commitStarted=false;
  try{
    db=await openDb();
    assertOwner(storage,marker);
    await swapWithJournal(db,marker,beforeRaw,mediaRows,workbookRows,targetEvidence);
    await verifyTarget(mediaRows,workbookRows);
    await verifyTargetEvidence(db,targetEvidence);
    assertOwner(storage,marker);
    // The attachment journal exists now, but an older tab may ignore the new
    // migration marker. Preserve its newly saved archive and our rollback
    // journal instead of overwriting it with the captured stale original.
    if(storage.getItem(ARCHIVE_KEY)!==beforeRaw){
      sourceConflict=true;
      writeMarker(storage,{...marker,abortReason:'source-drift'});
      fail('恢复附件期间其他页面已更新主档案；保持事务保护与原始附件日志，停止自动覆盖');
    }
    committing=true;activeId=marker.id;commitStarted=true;
    try{await commitArchive();}finally{committing=false;activeId=null;}
    // The archive is the only localStorage commit; read-back its bytes before finalization.
    const current=storage.getItem(ARCHIVE_KEY);
    if(current===null)fail('恢复后的主档案未成功提交');
    // Replacing missing/damaged attachments is valid even when the archive bytes
    // remain identical; settlement explicitly records target vs original.
    // The archive adapter supplies structural validation and source-data comparison.
    await options.verifyArchive(current);
    // Record a verified candidate for safe restart classification. A crash
    // before this point must fail closed rather than guess that any changed
    // archive was written by this restore.
    const candidateHash=await sha(current);
    assertOwner(storage,marker);
    if(storage.getItem(ARCHIVE_KEY)!==current)
      fail('候选档案核验后发生并发更新；已保留恢复日志');
    marker={...marker,candidateHash};
    writeMarker(storage,marker);
    await finalize(storage,db,marker,current,'target');
    return {status:'committed',id:marker.id};
  }catch(error){
    committing=false;activeId=null;
    // A third-party archive is not ours to roll back. Keep the durable journal
    // and marker for safe, explicit resolution; never erase the newer bytes.
    if(sourceConflict&&!commitStarted)throw error;
    let recoveryOutcome;
    try{if(db)recoveryOutcome=await recover({storage,openDb,verifyOriginal});}
    catch(recoveryError){const e=new Error('导入失败且自动恢复未完成：'+String(recoveryError.message||recoveryError));e.cause=error;throw e;}
    // Cleanup can fail AFTER the archive and attachment swap has committed.
    // A verified restart may then finish the settlement. Report that committed
    // outcome to the UI; claiming "original restored" would be false and might
    // prompt the user to overwrite the successfully imported archive.
    if(recoveryOutcome?.status==='committed')return {...recoveryOutcome,recoveredAfterCleanupError:true};
    throw error;
  }
}
root.PLDataMigrationTransaction=Object.freeze({KEY,STORE,ARCHIVE_KEY,ensureIdle,assertWritable,getMarker,isCommitting:()=>committing,run,recover});
})(typeof window!=='undefined'?window:globalThis);
