'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function pcFooter(){
  const start=html.indexOf('<footer class="pc-editor-foot');
  const end=html.indexOf('</footer>',start);
  assert(start>=0&&end>start,'PC editor footer missing');
  return html.slice(start,end+9);
}

test('PC primary archive export is image-first and old public HTML/package/card buttons are removed',()=>{
  const footer=pcFooter();
  assert(footer.includes('id="pcFooterExportImageBtn"'));
  assert(footer.includes('导出角色档案图片'));
  assert(footer.includes('id="pcFooterExportExcelBtn"'));
  for(const id of ['pcFooterExportFullBtn','pcFooterExportPackageBtn','pcFooterExportCardBtn']){
    assert(!footer.includes(`id="${id}"`),`${id} should not remain in the primary PC export menu`);
  }
  assert(footer.includes('简版／标准／完整档案'));
  assert(footer.includes('HTML 与独立档案压缩包不再作为主导出格式'));
  assert.match(html,/pcFooterExportImageBtn[\s\S]*?PLPCShowcaseOpenDraft/);
});

test('PC complete-image archive covers full dossier content and uses unified final preview',()=>{
  for(const marker of [
    'function pcFullArchiveBlocks',
    'function pcFullArchiveImageCanvases',
    '完整角色档案',
    '角色资料',
    'CoC7 核心数值',
    '全部技能',
    '背景故事',
    '随身物品与资产',
    '武器',
    '跨桌成长记录',
    '跑团经历',
    'PC 备注'
  ]) assert(html.includes(marker),`${marker} missing from PC complete image archive`);
  assert.match(html,/async function buildPcPages\([\s\S]*?pcFullArchiveImageCanvases/);
  assert.match(html,/角色档案导出预览[\s\S]*?PLUnifiedExportPreview/);
  assert(html.includes('data-entity-pc-preset="simple"'));
  assert(html.includes('data-entity-pc-preset="standard"'));
  assert(html.includes('data-entity-pc-preset="complete"'));
  assert(html.includes('data-entity-pc-density="compact"'));
});

test('module complete archive is dense and table history can expose people PC and HO safely',()=>{
  for(const marker of [
    'function moduleCompleteBlocks',
    'function moduleCompleteCanvases',
    '模组整合档案',
    'id="entityModPersonMode"',
    'id="entityModPeople"',
    'id="entityModPc"',
    'id="entityModHo"',
    '桌次显示 KP / PL',
    '桌次显示 PC',
    '桌次显示 HO'
  ]) assert(html.includes(marker),`${marker} missing from module complete archive`);
  assert.match(html,/function moduleEntities\([\s\S]*?moduleId/,'module history should be based on stable module relation');
  assert.match(html,/function moduleCastSummary\([\s\S]*?personMode/,'module table cast should obey person display mode');
  assert.match(html,/personMode==='hidden'[\s\S]*?return''/,'hidden person mode should not fall back to raw names');
  assert.match(html,/function defaultMod\(\)[\s\S]*?density:'compact'/,'module export should default to compact density');
  assert.match(html,/模组档案导出预览[\s\S]*?PLUnifiedExportPreview/);
});

test('PC/module export 2.0 remains display-only and does not replace formal archives',()=>{
  const start=html.indexOf('<script id="showcase-stage5-entity-js">');
  const end=html.indexOf('</script>',start);
  assert(start>=0&&end>start,'entity showcase script missing');
  const block=html.slice(start,end);
  assert(!/\brunRecords\s*=/.test(block),'entity export must not replace runRecords');
  assert(!/\bpcs\s*=/.test(block),'entity export must not replace PC archive array');
  assert(!/\bmodules\s*=/.test(block),'entity export must not replace module archive array');
  assert(block.includes('window.PLPCShowcaseOpenDraft'));
  assert(block.includes('window.PLUnifiedExportPreview'));
});
