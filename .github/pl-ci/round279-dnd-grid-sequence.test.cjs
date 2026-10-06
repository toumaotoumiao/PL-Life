const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('grid sequence helper exposes explicit two-dimensional controls',()=>{
  for(const token of ['data-pc-dnd-seq-mode','data-pc-dnd-seq-group','data-pc-dnd-seq-cross'])assert.ok(html.includes(token),`missing ${token}`);
  for(const value of ['columns','rows'])assert.ok(html.includes(`value="${value}"`),`missing mode ${value}`);
  assert.ok(html.includes('先向下，填满后换列'));
  assert.ok(html.includes('先向右，填满后换行'));
});

test('grid coordinate generator supports column-major and row-major grouping',()=>{
  const fn=(html.match(/function pcDndSequenceCandidate\([\s\S]*?return pcDndCellRefFromParts\(col,row\);\}/)||[])[0]||'';
  assert.ok(fn.includes("'columns','rows','snake-columns','snake-rows'"));
  assert.ok(fn.includes("columnMode=mode==='columns'||mode==='snake-columns'"));
  assert.ok(fn.includes('index%groupSize'));
  assert.ok(fn.includes('Math.floor(index/groupSize)'));
});

test('two-dimensional mode validates group size and cross step before generating candidates',()=>{
  const fn=(html.match(/function pcDndMapApplySequence\(\)[\s\S]*?return \{applied,skipped,valid,blocked,total:targets\.length,mode\};\}/)||[])[0]||'';
  assert.ok(fn.includes('groupSize<1||groupSize>500'));
  assert.ok(fn.includes('crossStep<1||crossStep>9999'));
  assert.ok(fn.includes('pcDndSequenceCandidate(start,i,mode,step,groupSize,crossStep,targets.length)'));
  assert.ok(fn.includes("gridMode=['columns','rows','snake-columns','snake-rows'].includes(mode)"));
});

test('grid candidates still return to existing validation and never auto-save',()=>{
  const fn=(html.match(/function pcDndMapApplySequence\(\)[\s\S]*?return \{applied,skipped,valid,blocked,total:targets\.length,mode\};\}/)||[])[0]||'';
  assert.ok(fn.includes('pcDndMapRefresh()'));
  assert.ok(fn.includes('session.extraStates'));
  assert.ok(!fn.includes('pcDndMapSave('));
  assert.ok(!fn.includes('pcWorkbookPending='));
});
