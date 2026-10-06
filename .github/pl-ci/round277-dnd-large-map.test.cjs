const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('large D&D mapping capacity covers current PC skill ceiling',()=>{
  assert.ok(html.includes('return items.slice(0,220);'));
  assert.match(html,/pcDndExtendedMapNormalize[\s\S]*?out\.length>=220/);
  assert.match(html,/pcExcelNormalizeProfiles[\s\S]*?extras\.length>=220/);
  assert.ok(!html.includes('return items.slice(0,140);'));
});

test('large mapping adds group/state filters and bulk visible selection',()=>{
  for(const token of ['data-pc-dnd-extra-group-filter','data-pc-dnd-extra-state-filter','data-pc-dnd-extra-select-visible','data-pc-dnd-extra-clear-visible','function pcDndMapToggleVisibleExtras'])
    assert.ok(html.includes(token),`missing ${token}`);
  for(const label of ['未完成','已映射','本次可导出','PC 已填写','冲突']) assert.ok(html.includes(`>${label}<`),`missing filter ${label}`);
});

test('extended search reuses global pinyin-aware search and exposes conflicts',()=>{
  assert.match(html,/function pcDndMapFilterExtras\(\)[\s\S]*?searchTextMatches/);
  assert.match(html,/conflict=.*?pcDndExtraDuplicate.*?重复\|重名/s);
  assert.ok(html.includes('data-pc-dnd-extra-duplicate'));
});

test('next incomplete and bulk selection respect current visible result set',()=>{
  assert.match(html,/pcDndMapFocusNext[\s\S]*?!el\.hidden&&el\.querySelector/);
  assert.match(html,/function pcDndMapToggleVisibleExtras\(enabled\)[\s\S]*?if\(row\.hidden\)continue/);
});
