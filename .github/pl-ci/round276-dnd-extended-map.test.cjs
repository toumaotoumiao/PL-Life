const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('extended D&D mapping is opt-in, grouped, searchable and sheet-aware',()=>{
  for(const token of [
    'PC_DND_EXTENDED_GROUPS','function pcDndExtendedCandidates','function pcDndMapDraftExtras',
    'data-pc-dnd-extra-search','data-pc-dnd-extra-group','data-pc-dnd-extra-enable',
    'data-pc-dnd-extra-sheet','data-pc-dnd-extra-ref','技能:察觉=2!D20','装备:长剑=1!F32'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.match(html,/function pcDndBatchParse\(text,pc=null\).*?工作表序号!坐标/s);
});

test('extended targets keep formula, protected-region, existence and duplicate guards',()=>{
  for(const token of ['pcDndProtectedTemplateTargets','已保护的标签／六属性区域','是公式格，不能覆盖','在第 ${item.sheet+1} 张表中不存在','多个字段不能共用第'])
    assert.ok(html.includes(token),`missing guard ${token}`);
  assert.match(html,/for\(const item of map\.extras\).*?protectedTargets\.has\(key\).*?used\.has\(key\).*?formulaRefs.*?cellRefs/s);
});

test('v2 reusable profiles persist coordinate metadata only and v1 stays accepted',()=>{
  assert.ok(html.includes("kind:'dnd-map-v2'"));
  assert.ok(html.includes("['dnd-map-v1','dnd-map-v2'].includes"));
  assert.match(html,/pcExcelNormalizeProfiles\(raw\).*?dnd-map-v1.*?dnd-map-v2.*?extras/s);
  assert.match(html,/extras\.push\(\{group,label,sheet,ref\}\)/);
  assert.ok(!html.includes('dnd-map-profile-current-value'));
});

test('extended export writes only mapped current-PC rows and rechecks exported workbook',()=>{
  assert.match(html,/function pcDndIdentityCombatPlan\(.*?validated\.extraVerified.*?pcDndExtendedExportValue.*?extraWritten/s);
  assert.match(html,/for\(const item of identity\.extraWritten\).*?pcInsaneSheetCell\(check\[item\.sheet\],item\.ref\)/s);
  assert.match(html,/count:plan\.changes\.size\+identity\.written\.length\+identity\.extraWritten\.length/);
});
