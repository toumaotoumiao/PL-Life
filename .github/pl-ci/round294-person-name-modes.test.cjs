const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('Round294 KP/PL/PC/KPC expose explicit name-only and create/archive actions',()=>{
  for(const needle of [
    '仅保存 KP 名：','创建 PL 档案并设为 KP：',
    '仅保存 PL 名：','仅保存角色名：','创建 PC“'
  ]) assert.ok(html.includes(needle),`missing ${needle}`);
  for(const attr of ['data-editor-kp-custom','data-editor-kp-create','data-record-kp-custom','data-record-kp-create','data-editor-add-external-pl','data-record-add-external-pl','data-pc-save-external'])
    assert.ok(html.includes(attr),`missing ${attr}`);
});

test('Round294 name-only choices are explicit actions and do not require archive creation',()=>{
  assert.ok(html.includes('本桌记录，不创建 PL 档案'));
  assert.ok(html.includes('本桌记录，不创建 PC 档案'));
});
