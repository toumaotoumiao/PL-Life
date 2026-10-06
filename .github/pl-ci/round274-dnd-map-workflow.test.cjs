const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D mapping workflow exposes live progress without exposing cell contents',()=>{
  for(const token of [
    'data-pc-dnd-map-verified',
    'data-pc-dnd-map-filled',
    'data-pc-dnd-map-exportable',
    'data-pc-dnd-map-next',
    'data-pc-dnd-map-state',
    'data-pc-dnd-map-pc-state',
    'function pcDndMapFieldStatus',
    'function pcDndMapRefresh',
    'function pcDndMapFocusNext'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.ok(html.includes("text:'PC 已填写'"));
  assert.ok(html.includes("text:'PC 未填写'"));
  assert.ok(!html.includes('data-pc-dnd-map-current-value'));
});

test('live checks mirror the saved mapping safety model',()=>{
  for(const token of ['坐标格式无效','不能使用标签格','重复','公式格','模板中不存在','标签待核对'])
    assert.ok(html.includes(token),`missing live state ${token}`);
  assert.match(html,/pcDndMapSave\(\).*?pcDndIdentityCombatMapValidate/s);
});

test('mapping status is visible from the D&D editor before opening the dialog',()=>{
  assert.match(html,/mapButton\.disabled=!ready/);
  assert.ok(html.includes('模板字段映射 ${mapped}/7'));
  assert.match(html,/mapButton\.dataset\.pcDndMapCount=String\(mapped\)/);
  assert.match(html,/mapButton\.dataset\.pcDndMapExtraCount=String\(extraMapped\)/);
  assert.ok(html.includes('固定映射 ${mapped}/7'));
});

test('keyboard and next-item workflow preserve explicit user confirmation',()=>{
  assert.match(html,/event\.key!==['"]Enter['"]/);
  assert.match(html,/pcDndMapFocusNext\(input\)/);
  assert.match(html,/data-pc-dnd-map-attest/);
  assert.match(html,/请先确认已在当前模板中逐项核对坐标/);
});
