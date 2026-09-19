/* PL · 完整备份恢复前只读关联审计。
 * No writes, no private payload logging, no external dependencies. */
(function(root){'use strict';
function fail(message){throw new Error('备份恢复前检查未通过：'+message+'。当前档案未被覆盖');}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function name(value,prefix){return typeof value==='string'&&value.startsWith(prefix)&&value.length>prefix.length&&value.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!value.includes('\\');}
function audit(manifest,archive,files){
 if(!object(manifest)||!object(archive)||!object(archive.data)||!object(files))fail('文件清单或档案结构无效');
 const pcs=archive.data.pcs;if(!Array.isArray(pcs))fail('PC 档案集合缺失');
 const media=manifest.media,workbooks=manifest.workbooks;
 if(!Array.isArray(media)||!Array.isArray(workbooks))fail('图片或原始 Excel 清单缺失');
 if(!['complete','compact'].includes(manifest.backupMode))fail('备份范围不明确');
 if(!Number.isSafeInteger(manifest.mediaCount)||manifest.mediaCount!==media.length)fail('图片数量与清单不一致');
 const pcMap=new Map(),owners=new Map(),excel=new Set(),paths=new Set();
 for(const pc of pcs){
  if(!object(pc)||!pc.id||pcMap.has(String(pc.id)))fail('PC 档案编号重复或无效');
  const id=String(pc.id);pcMap.set(id,pc);if(pc.excelSource)excel.add(id);
  const refs=[pc.avatarMediaId,...(Array.isArray(pc.galleryMediaIds)?pc.galleryMediaIds:[])];
  for(const ref of refs){if(!ref)continue;const key=String(ref);if(owners.has(key)&&owners.get(key)!==id)fail('同一张图片被多个 PC 档案引用');owners.set(key,id);}
 }
 const archivePath=manifest.archivePath||'archive.json';
 if(archivePath!=='archive.json'||!files[archivePath]||!files['manifest.json'])fail('档案文件路径异常');
 paths.add(archivePath);paths.add('manifest.json');
 const images=new Set(),sheets=new Set();
 for(const item of media){
  if(!object(item)||!item.id||!item.pcId||!name(item.path,'media/')||!files[item.path]||paths.has(item.path))fail('图片清单存在无效或重复的文件路径');
  const id=String(item.id),pcId=String(item.pcId);
  if(images.has(id)||!owners.has(id)||owners.get(id)!==pcId||!pcMap.has(pcId))fail('图片编号与 PC 所属关系不一致');
  if(typeof item.type!=='string'||!/^image\/[a-z0-9.+-]+$/.test(item.type))fail('图片文件类型未被支持');
  images.add(id);paths.add(item.path);
  if(item.metadata!==undefined){
   if(!object(item.metadata)||String(item.metadata.id)!==id||String(item.metadata.pcId)!==pcId||!item.metadataSha256||!item.sha256)fail('关联图片原始元数据不完整');
   if(item.thumbPath){
    if(!name(item.thumbPath,'media-thumbnails/')||!files[item.thumbPath]||paths.has(item.thumbPath)||!item.thumbSha256)fail('关联图片缩略图丢失或路径重复');
    paths.add(item.thumbPath);
   }
  }else if(item.thumbPath)fail('关联图片缩略图缺少元数据清单');
 }
 if(images.size!==owners.size)fail('完整备份缺少被档案引用的图片');
 for(const item of workbooks){
  if(!object(item)||!item.pcId||!name(item.path,'workbooks/')||!files[item.path]||paths.has(item.path))fail('原始 Excel 清单存在无效或重复的文件路径');
  const pcId=String(item.pcId);
  if(sheets.has(pcId)||!pcMap.has(pcId)||!excel.has(pcId))fail('原始 Excel 与 PC 的关联不一致');
  // Workbook-store metadata and PC import-source metadata are two distinct historical fields.
  // Their original names/types may differ; do not misclassify that difference as corruption.
  // `kind` records the historical importer/provenance, not only the file extension.
  // Older CoC7 templates store `fixed` and generic XLSX imports store `generic`.
  // Reject an unknown kind or a kind/path mismatch without discarding the original.
  const sourceKind=String(item.kind||'').toLowerCase();
  if(sourceKind&&!['fixed','generic','xlsx','csv','tsv'].includes(sourceKind))fail('原始 Excel 来源类型无法识别');
  if(['fixed','generic','xlsx'].includes(sourceKind)&&!item.path.toLowerCase().endsWith('.xlsx'))fail('原始 Excel 来源类型与文件后缀不一致');
  if(['csv','tsv'].includes(sourceKind)&&!item.path.toLowerCase().endsWith('.'+sourceKind))fail('原始 Excel 来源类型与文件后缀不一致');
  if(item.metadata!==undefined&&(!object(item.metadata)||String(item.metadata.pcId)!==pcId||!item.metadataSha256||!item.sha256))fail('关联 Excel 原始元数据不完整');
  sheets.add(pcId);paths.add(item.path);
 }
 if(manifest.backupMode==='complete'&&sheets.size!==excel.size)fail('完整备份缺少 PC 已保留的原始 Excel');
 if(manifest.backupMode==='compact'&&(sheets.size||excel.size))fail('精简备份仍存在原始 Excel 引用');
 const unlinked=manifest.unlinkedAttachments;
 if(unlinked!==undefined){
  if(manifest.backupMode!=='complete'||!object(unlinked)||unlinked.version!==1||!Array.isArray(unlinked.media)||!Array.isArray(unlinked.workbooks))fail('历史附件清单格式无效');
  const unlinkedMediaIds=new Set(),unlinkedBookIds=new Set();
  for(const [kind,items,seen,original] of [['media',unlinked.media,unlinkedMediaIds,images],['workbook',unlinked.workbooks,unlinkedBookIds,sheets]]){
   for(const item of items){
    if(!object(item)||typeof item.id!=='string'||!item.id||seen.has(item.id)||original.has(item.id)||!object(item.metadata)||!name(item.path,`unlinked/${kind}/`)||!files[item.path]||paths.has(item.path))fail('历史附件文件清单不一致');
    if(String(item.metadata[kind==='media'?'id':'pcId'])!==item.id)fail('历史附件编号与元数据不一致');
    // All unlinked entries were introduced with byte and metadata hashes.
    // Reject missing evidence at the same preflight gate used by both verify
    // and restore, rather than accepting a manifest that cannot be restored.
    if(!/^[a-f0-9]{64}$/.test(item.sha256)||!/^[a-f0-9]{64}$/.test(item.metadataSha256)||
       !Number.isSafeInteger(item.size)||item.size<0||
       !Number.isInteger(item.crc32)||item.crc32<0||item.crc32>0xffffffff)
      fail('历史附件缺少完整的原件或元数据校验证据');
    seen.add(item.id);paths.add(item.path);
    if(kind==='media'&&item.thumbPath){
     if(!name(item.thumbPath,'unlinked/media/')||!files[item.thumbPath]||paths.has(item.thumbPath)||
        !/^[a-f0-9]{64}$/.test(item.thumbSha256)||!Number.isSafeInteger(item.thumbSize)||item.thumbSize<0)
       fail('历史缩略图文件或校验证据缺失或重复');
     paths.add(item.thumbPath);
    }
   }
  }
 }
 for(const path of Object.keys(files))if((path.startsWith('media/')||path.startsWith('media-thumbnails/')||path.startsWith('workbooks/')||path.startsWith('unlinked/'))&&!paths.has(path))fail('发现清单外附件，已停止静默丢弃');
 return Object.freeze({pcCount:pcs.length,mediaCount:images.size,workbookCount:sheets.size,backupMode:manifest.backupMode});
}
root.PLBackupRestorePreflight=Object.freeze({audit});
})(typeof window!=='undefined'?window:globalThis);
