const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('special sequence helper exposes snake and explicit multi-block modes',()=>{
  for(const value of ['snake-columns','snake-rows','blocks-down','blocks-right'])assert.ok(html.includes(`value="${value}"`),`missing mode ${value}`);
  for(const token of ['data-pc-dnd-seq-block-wrap','data-pc-dnd-seq-blocks'])assert.ok(html.includes(token),`missing ${token}`);
  assert.ok(html.includes('区块起点（每行：工作表!起始格*项数）'));
});

test('snake coordinate generator reverses every other band without guessing workbook cells',()=>{
  const fn=(html.match(/function pcDndSequenceCandidate\([\s\S]*?return pcDndCellRefFromParts\(col,row\);\}/)||[])[0]||'';
  assert.ok(fn.includes("mode.startsWith('snake-')"));
  assert.ok(fn.includes('band%2===1'));
  assert.ok(fn.includes('bandSize=Math.min(groupSize'));
  assert.ok(fn.includes('totalCount'));
});

test('multi-block parser requires explicit sheet/start/count and exact selected-item total',()=>{
  const parse=(html.match(/function pcDndSequenceBlocksParse\([\s\S]*?return blocks;\}/)||[])[0]||'';
  const pick=(html.match(/function pcDndSequenceBlockCandidate\([\s\S]*?return null;\}/)||[])[0]||'';
  assert.ok(parse.includes('工作表不存在'));
  assert.ok(parse.includes('区块项数合计'));
  assert.ok(parse.includes('targetCount'));
  assert.ok(pick.includes("'blocks-down','blocks-right'"));
  assert.ok(pick.includes('sheet:block.sheet'));
});

test('special sequence candidates still flow through validation and never auto-save',()=>{
  const fn=(html.match(/function pcDndMapApplySequence\(\)[\s\S]*?return \{applied,skipped,valid,blocked,total:targets\.length,mode\};\}/)||[])[0]||'';
  assert.ok(fn.includes("blockMode=['blocks-down','blocks-right'].includes(mode)"));
  assert.ok(fn.includes('pcDndSequenceBlocksParse'));
  assert.ok(fn.includes('pcDndMapRefresh()'));
  assert.ok(fn.includes('session.extraStates'));
  assert.ok(!fn.includes('pcDndMapSave('));
  assert.ok(!fn.includes('pcWorkbookPending='));
});
