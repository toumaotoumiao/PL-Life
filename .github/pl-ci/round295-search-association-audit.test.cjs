const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));

test('Round295 current release is driven by unique project status',()=>{
  assert.equal(status.current.stage,'Stage125');
  assert.equal(status.current.appVersion,'8.1.12.303');
  assert.equal(status.current.schemaVersion,26);
  assert.ok(html.includes('const APP_UI_VERSION = "8.1.12.303"'));
});

test('Round295 module association selectors expose name-only and create actions before existing choices',()=>{
  for(const attr of ['data-plan-module-name-only','data-plan-module-create','data-new-module-name-only','data-new-module-create','data-intro-name-only','data-intro-create-module'])
    assert.ok(html.includes(attr),`missing ${attr}`);
  assert.ok(html.includes('仅保存模组名：'));
});

test('Round295 preference name-only state remains explicit',()=>{
  assert.ok(html.includes('linkMode:"name-only"'));
  assert.ok(html.includes('Preserve explicit name-only choices'));
});
