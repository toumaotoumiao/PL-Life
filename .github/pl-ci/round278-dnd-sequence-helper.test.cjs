const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('sequence helper exposes explicit worksheet/start/direction/step controls',()=>{
  for(const token of ['data-pc-dnd-seq-sheet','data-pc-dnd-seq-start','data-pc-dnd-seq-mode','data-pc-dnd-seq-step','data-pc-dnd-seq-empty','data-pc-dnd-seq-apply','data-pc-dnd-seq-from-first'])
    assert.ok(html.includes(token),`missing ${token}`);
  assert.ok(html.includes('坐标规律辅助'));
  assert.ok(html.includes('value="down"')&&html.includes('value="right"'));
});

test('sequence helper targets only visible selected extension rows',()=>{
  assert.match(html,/function pcDndMapSequenceRows[\s\S]*?!row\.hidden[\s\S]*?data-pc-dnd-extra-enable[\s\S]*?\.checked/);
  assert.match(html,/function pcDndMapApplySequence[\s\S]*?pcDndMapSequenceRows/);
});

test('generated coordinates support down/right steps and keep existing mappings by default',()=>{
  assert.match(html,/function pcDndCellRefFromParts[\s\S]*?18278[\s\S]*?999999/);
  assert.match(html,/function pcDndSequenceCandidate[\s\S]*?mode==='down'[\s\S]*?mode==='right'/);
  assert.match(html,/data-pc-dnd-seq-empty checked/);
  assert.match(html,/emptyOnly&&String\(refInput\?\.value\|\|''\)\.trim\(\)/);
});

test('sequence candidates always return to existing validation and never auto-save',()=>{
  const fn=(html.match(/function pcDndMapApplySequence\(\)[\s\S]*?return \{applied,skipped,valid,blocked,total:targets\.length,mode\};\}/)||[])[0]||'';
  assert.ok(fn.includes('pcDndMapRefresh()'));
  assert.ok(fn.includes('session.extraStates'));
  assert.ok(!fn.includes('pcDndMapSave('));
  assert.ok(!fn.includes('pcWorkbookPending='));
});
