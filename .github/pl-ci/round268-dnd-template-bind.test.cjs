const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D export button distinguishes setup from actual export',()=>{
  assert.match(html,/button\.textContent=ready\?'导出 D&D 角色 Excel 卡':'设置 D&D 角色卡模板'/);
  assert.match(html,/首次需要设置一份 D&D 角色卡模板；成功核对并保存 PC 后，以后直接导出/);
  assert.match(html,/if\(route\.status==='ready'&&route\.adapterId==='dnd-template'\)return pcExportDndCharacterCard\(pc\)/);
});

test('first verified template becomes a pending PC attachment instead of a hidden global file',()=>{
  assert.match(html,/pcWorkbookPending=\{pcId:String\(draft\.id\|\|''\),blob,fileName:String\(file\.name\|\|'D&D 角色卡模板\.xlsx'\),kind:'dnd-template',templateKey:key,editionId:/);
  assert.match(html,/pcDraft\.excelSource=\{kind:'dnd-template',fileName:pcWorkbookPending\.fileName,templateId:key,storedAt:Date\.now\(\)\}/);
  assert.match(html,/pcWorkbookPending\.kind==='dnd-template'\?'待保存的 D&D 导出模板':'待保存的原始 Excel'/);
});

test('saved template metadata survives PC save and is edition-scoped',()=>{
  assert.match(html,/for\(const key of \['templateKey','editionId','layoutId'\]\)if\(pcWorkbookPending\[key\]\)pendingMeta\[key\]=String\(pcWorkbookPending\[key\]\)/);
  assert.match(html,/row\.kind==='dnd-template'&&String\(row\.templateKey\|\|''\)===key/);
  assert.match(html,/if\(!row\)return pcRequestDndTemplateExport\(draft\)/);
  assert.match(html,/return pcDndExportCheckOpen\(file,draft,\{bindTemplate:false,identityCombatMap:row\.identityCombatMap\|\|null\}\)/);
});

test('template chooser only binds after workbook build and download succeed',()=>{
  const build=html.indexOf('const result=await pcBuildDndTemplateWorkbook(file,draft,{identityCombatMap})');
  const download=html.indexOf("if(downloadBlobFile(result.blob,filename)!==true)throw new Error('浏览器未接受文件下载请求')",build);
  const bind=html.indexOf("pcWorkbookPending={pcId:String(draft.id||''),blob",build);
  assert.ok(build>=0&&download>build&&bind>download,'bind must happen only after successful build/download');
  assert.match(html,/pcFooterDndTemplateInput'\)\?\.addEventListener\('change'.*pcDndExportCheckOpen\(file,draft,\{bindTemplate:true\}\)/s);
});
