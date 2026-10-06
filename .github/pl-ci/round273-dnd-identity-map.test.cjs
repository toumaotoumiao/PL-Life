const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D identity/combat template mapping is explicit and local',()=>{
  for(const token of [
    'PC_DND_IDENTITY_COMBAT_LABELS',
    'function pcDndIdentityCombatMapValidate',
    'rows.cellRefs instanceof Set',
    'rows.formulaRefs instanceof Set',
    '多个字段不能共用输入格',
    '目标格 ${ref} 是公式格',
    '目标格 ${ref} 在模板中不存在',
    '输入格不能与标签格',
    'data-pc-dnd-map-open',
    'data-pc-dnd-map-attest',
    '只保存字段坐标',
    'function pcDndProtectedTemplateTargets(layoutId)'
  ]) assert.ok(html.includes(token),`missing ${token}`);
});

test('confirmed mapping persists with workbook metadata and drives direct export',()=>{
  assert.match(html,/pendingMeta\.identityCombatMap=clone\(pcWorkbookPending\.identityCombatMap\)/);
  assert.match(html,/identityCombatMap:row\.identityCombatMap\|\|null/);
  assert.match(html,/pcWorkbookPending=\{\.\.\.row,pcId:session\.pcId,blob:row\.blob,identityCombatMap:validated\.map/);
  assert.match(html,/pcBuildDndTemplateWorkbook\(file,draft,\{identityCombatMap\}\)/);
});

test('identity/combat values remain bounded before workbook writes',()=>{
  assert.match(html,/等级必须是 1–20 的整数/);
  assert.match(html,/熟练加值必须是 0–20 的整数/);
  assert.match(html,/先攻必须是 -99–99 的整数/);
  assert.match(html,/生命值必须是 0–99999 的整数/);
  assert.match(html,/内容过长，已停止写入 D&D 模板/);
});

test('mapping workflow does not claim automatic coordinate discovery',()=>{
  assert.ok(html.includes('人工坐标映射'));
  assert.match(html,/pcDndReusableProfilesFor\(.*?pcDndIdentityCombatMapValidate/s);
  assert.ok(!html.includes('自动推断身份／战斗输入格'));
  assert.ok(!html.includes('自动识别身份／战斗输入格'));
});
