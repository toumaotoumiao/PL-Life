const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('mapping review panel exposes compact status filters, locate actions, and managed D&D submodal focus',()=>{
  for(const token of ['data-pc-dnd-review-toggle','data-pc-dnd-review-filter','data-pc-dnd-review-mark-visible','data-pc-dnd-review-clear','data-pc-dnd-review-list','data-pc-dnd-review-locate'])assert.ok(html.includes(token),`missing ${token}`);
  for(const value of ['pending','unreviewed','exportable','valid'])assert.ok(html.includes(`<option value="${value}">`),`missing review filter ${value}`);
  const modalIds=(html.match(/const MODAL_SURFACE_IDS = \[[\s\S]*?\];/)||[])[0]||'';
  for(const id of ['pcDndPreviewBackdrop','pcDndMapBackdrop','pcInsanePreviewBackdrop'])assert.ok(modalIds.includes(`"${id}"`),`unmanaged ${id}`);
  const close=(html.match(/function closeHistorySurfaceById\([\s\S]*?return false;\n}/)||[])[0]||'';
  assert.ok(close.includes('pcDndMapClose()')&&close.includes('pcDndStructurePreviewClose()')&&close.includes('pcInsanePreviewClose()'));
});

test('review rows derive field sheet ref validation and export readiness without exposing PC values',()=>{
  const fn=(html.match(/function pcDndMapReviewItems\([\s\S]*?return items;\}/)||[])[0]||'';
  assert.ok(fn.includes("group:'固定字段'"));
  assert.ok(fn.includes('PC_DND_EXTENDED_GROUPS[group]'));
  assert.ok(fn.includes("exportable:status.state==='valid'&&pcState.exportable"));
  assert.ok(fn.includes('pcState.text'));
  assert.ok(!fn.includes('pcDndExtendedExportValue('));
  assert.ok(!fn.includes('pcDndIdentityCombatExportValue('));
});

test('review acknowledgement is session-only and coordinate fingerprint changes invalidate it',()=>{
  const fp=html.slice(html.indexOf('function pcDndMapReviewFingerprint'),html.indexOf('function pcDndMapReviewItems'));
  const set=(html.match(/function pcDndMapReviewSet\([\s\S]*?return true;\}/)||[])[0]||'';
  assert.ok(fp.includes('item.sheet')&&fp.includes('item.ref')&&fp.includes('item.state'));
  assert.ok(set.includes('session.reviewed.set'));
  assert.ok(!set.includes('settings'));
  assert.ok(!set.includes('pcWorkbookPending'));
  assert.ok(!set.includes('save'));
});

test('review panel never bypasses final map validation or auto-saves',()=>{
  const review=html.slice(html.indexOf('function pcDndMapReviewFingerprint'),html.indexOf('function pcDndMapFocusNext'));
  const save=(html.match(/async function pcDndMapSave\([\s\S]*?return true;\}/)||[])[0]||'';
  assert.ok(save.includes('pcDndIdentityCombatMapValidate'));
  assert.ok(review.includes('pcDndMapReviewLocate'));
  assert.ok(!review.includes('pcDndMapSave('));
  assert.ok(!review.includes('pcWorkbookPut('));
  assert.ok(!review.includes('pcWorkbookPending='));
});
