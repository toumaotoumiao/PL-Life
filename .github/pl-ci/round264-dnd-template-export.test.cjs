const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D primary Excel route is a real template-filled character card, not the standalone data sheet',()=>{
  assert.match(html,/'dnd:5e-2014':Object\.freeze\(\{id:'dnd-template',label:'D&D 角色 Excel 卡'\}\)/);
  assert.match(html,/'dnd:5e-2024':Object\.freeze\(\{id:'dnd-template',label:'D&D 角色 Excel 卡'\}\)/);
  assert.match(html,/if\(route\.status==='ready'&&route\.adapterId==='dnd-template'\)return pcExportDndCharacterCard\(pc\)/);
  assert.doesNotMatch(html,/adapterId==='dnd-manual'\)return pcExportDndRuleWorkbook\(pc\)/);
});

test('first-time template setup uses a user-selected XLSX and preserves the source workbook package',()=>{
  assert.match(html,/id="pcFooterDndTemplateInput"[^>]+type="file"[^>]+accept="\.xlsx/);
  assert.match(html,/async function pcBuildDndTemplateWorkbook\(file,pc\)/);
  assert.match(html,/const raw=await file\.arrayBuffer\(\),sheets=await pcExcelReadXlsx\(raw\)/);
  assert.match(html,/files=await pcExcelUnzip\(raw\)/);
  assert.match(html,/Object\.entries\(files\).*pcMakeExcelZipEntries/s);
  assert.match(html,/actualNames\.length!==expectedNames\.length/);
});

test('only verified six-ability coordinates are writable and unknown D&D fields remain untouched',()=>{
  assert.match(html,/const PC_DND_SIX_LABELS=Object\.freeze\(\['力量','敏捷','体质','智力','感知','魅力'\]\)/);
  assert.match(html,/changes\.set\(profile\.candidateRefs\[i\],Number\(raw\)\)/);
  assert.match(html,/if\(!\/\^\\d\+\$\/\.test\(raw\)\|\|Number\(raw\)<1\|\|Number\(raw\)>30\)/);
  assert.match(html,/身份、战斗与装备字段的输入格尚未核实，因此本次保持原模板内容不变/);
  assert.match(html,/目标格是公式，已停止导出以保护原表/);
  assert.match(html,/if\(profile\.kind!=='template'\)/);
  assert.match(html,/没有同版空白模板证据；为避免写错单元格/);
});

test('legacy standalone rule-data XLSX stays internal and is no longer the visible D&D export',()=>{
  assert.match(html,/async function pcBuildDndRuleWorkbook\(pc\)/);
  assert.match(html,/async function pcExportDndRuleWorkbook\(pc\)/);
  assert.match(html,/if\(verifyButton\)verifyButton\.hidden=true/);
});
