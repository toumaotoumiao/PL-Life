const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D template build runs a post-build verifier before returning the downloadable blob',()=>{
  assert.match(html,/function pcDndVerifyGeneratedWorkbook\(sourceFiles,outputFiles,sourceSheets,outputSheets,sheetChanges\)/);
  const build=(html.match(/async function pcBuildDndTemplateWorkbook\([\s\S]*?\n}\n\/\* Stage112:/)||[])[0]||'';
  assert.ok(build.includes('sourceFiles=await pcExcelUnzip(raw)'));
  assert.ok(build.includes('const selfCheck=pcDndVerifyGeneratedWorkbook(sourceFiles,verified,sheets,check,sheetChanges)'));
  assert.ok(build.includes('selfCheck}'));
});

test('post-build verifier rechecks every planned write and preserves target-cell structure',()=>{
  const verify=(html.match(/function pcDndVerifyGeneratedWorkbook\([\s\S]*?return \{plannedWrites[\s\S]*?\n}/)||[])[0]||'';
  assert.ok(verify.includes('pcInsaneSheetCell(outputSheet,ref)'));
  assert.ok(verify.includes('beforeShell!==afterShell'));
  assert.ok(verify.includes('rows?.formulaRefs')||verify.includes('formulaRefs'));
  assert.match(verify,/回读值不一致/);
});

test('post-build verifier rejects any unplanned worksheet or package-part mutation',()=>{
  const verify=(html.match(/function pcDndVerifyGeneratedWorkbook\([\s\S]*?return \{plannedWrites[\s\S]*?\n}/)||[])[0]||'';
  assert.ok(verify.includes('pcDndWorksheetMaskTargets(before,refs)!==pcDndWorksheetMaskTargets(after,refs)'));
  assert.ok(verify.includes('pcDndBytesEqual(sourceFiles[name],outputFiles[name])'));
  assert.match(verify,/计划外结构或单元格变化/);
  assert.match(verify,/非目标部件 .* 被改动/);
});

test('user-visible success is emitted only after the generated workbook self-check passes',()=>{
  assert.match(html,/D&D 角色 Excel 卡生成后自检通过 · 已回填/);
  const exportFn=(html.match(/async function pcExportDndTemplateWorkbook\([\s\S]*?\n}\nlet pcDndTemplateExportPending/)||[])[0]||'';
  assert.ok(exportFn.indexOf('pcBuildDndTemplateWorkbook')<exportFn.indexOf('downloadBlobFile'));
});
