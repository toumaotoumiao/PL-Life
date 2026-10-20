'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));

test('Round293 plan and record PL pickers expose explicit inline create rows',()=>{
  assert.match(html,/data-editor-create-pl=/);
  assert.match(html,/创建 PL“\$\{escapeHTML\(name\)\}”/);
  assert.match(html,/data-record-create-pl=/);
  assert.match(html,/新建档案并加入计划/);
  assert.match(html,/新建并关联/);
});

test('Round293 PL inline create refuses exact duplicates and creates a minimal archive only after explicit confirmation',()=>{
  assert.match(html,/const exact=exactProfileMatches\(name,profiles\)/);
  assert.match(html,/if\(exact\.length\)\{/);
  assert.match(html,/await appConfirm\(`创建 PL 档案/);
  assert.match(html,/const created=makeBlankProfile\(\);created\.name=name/);
  assert.match(html,/profiles\.push\(created\)/);
  assert.match(html,/mutateRunPlan\(id,plan=>/);
  assert.match(html,/mutateRunRecord\(id,record=>/);
});

test('Round293 plan PL picker does not bypass blacklist or already-linked exact matches',()=>{
  assert.match(html,/exact\.some\(p=>plan\.plIds\.includes\(p\.id\)\)/);
  assert.match(html,/exact\.some\(isBlacklistedProfile\)/);
  assert.match(html,/从下方“从黑名单添加 PL”选择/);
  assert.match(html,/if\(!exact\.length\)actions\.push/);
});

test('Round293 PC and KPC pickers expose inline create and keep exact same-owner duplicates on the existing-PC path',()=>{
  assert.match(html,/function pcNamePickerOptionsHTML/);
  assert.match(html,/pcCandidatesByOwnerName\(profileId,name\)/);
  assert.match(html,/data-pc-create/);
  assert.match(html,/创建 PC“\$\{escapeHTML\(name\)\}”/);
  assert.match(html,/if\(pcCandidatesByOwnerName\(owner,name\)\.length\)/);
  assert.match(html,/该 PL 已有同名 PC，请在列表中明确选择/);
});

test('Round293 duplicate lower PC create action stays hidden while clear remains contextual',()=>{
  assert.match(html,/PL \/ PC 选择器新增列表内“新建并关联”/);
  assert.match(html,/if\(button\)button\.hidden=true/);
  assert.match(html,/if\(clear\)clear\.hidden=!draft&&!field\.dataset\.pcHasValue/);
});

test('Round293 current release contract follows the unique current status source',()=>{
  const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
  assert.equal(status.current.schemaVersion,26);
  assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
});
