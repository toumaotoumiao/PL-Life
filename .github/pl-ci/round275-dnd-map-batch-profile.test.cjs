const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D mapping is grouped and supports coordinate-only batch entry',()=>{
  for(const token of [
    'function pcDndMapGroupsFor',
    'function pcDndBatchParse',
    'data-pc-dnd-map-group',
    'data-pc-dnd-map-batch-toggle',
    'data-pc-dnd-map-batch-text',
    'data-pc-dnd-map-batch-apply',
    '批量填写坐标'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.match(html,/PC_DND_MAP_BATCH_ALIASES=.*?'背景'.*?'种族／物种'.*?'生命值'/s);
});

test('reusable D&D profile stores only edition, layout and coordinate refs',()=>{
  for(const token of [
    "kind:'dnd-map-v2'",
    "'dnd-map-v1','dnd-map-v2'",
    'function pcDndMapProfileId',
    'function pcDndMapProfileFromValidated',
    'function pcDndReusableProfilesFor',
    'data-pc-dnd-map-save-profile',
    '应用已保存配置'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.match(html,/\['dnd-map-v1','dnd-map-v2'\]\.includes\(profile\.kind\).*?editionId.*?layoutId.*?refs/s);
  assert.match(html,/kind:'dnd-map-v2'.*?extras/s);
  assert.ok(!html.includes('dnd-map-profile-current-value'));
});

test('reused profiles are revalidated against the current workbook before use',()=>{
  assert.match(html,/function pcDndReusableProfilesFor\(.*?pcDndIdentityCombatMapValidate\(sheets,layoutId/s);
  assert.match(html,/pcDndMapApplyReusable\(\).*?session\.reusableProfiles/s);
  assert.match(html,/function pcDndReusableProfilesFor\(.*?pcDndIdentityCombatMapValidate\(sheets,layoutId/s);
  assert.match(html,/protectedTargets:pcDndProtectedTemplateTargets/);
});

test('reusable mapping profile is staged with PC save and complete settings backup',()=>{
  assert.match(html,/pcExcelTemplateProfilePending=pcDndMapProfileFromValidated/);
  assert.match(html,/settings\.pcExcelTemplateProfiles=pcExcelNormalizeProfiles\(\[pcExcelTemplateProfilePending/);
  assert.match(html,/pcExcelTemplateProfiles: pcExcelNormalizeProfiles\(raw\?\.pcExcelTemplateProfiles\)/);
  assert.match(html,/dnd-map-\[a-f0-9\]\{8\}/);
});
