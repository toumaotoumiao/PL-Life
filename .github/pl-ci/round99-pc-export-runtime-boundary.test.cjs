const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function script(id){
  const m=html.match(new RegExp(`<script id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
  assert.ok(m,`missing script ${id}`);
  return m[1];
}

test('PC snapshot helpers cross the private-IIFE boundary through a read-only bridge',()=>{
  assert.match(html,/window\.PLPCSnapshotTools=Object\.freeze\(\{normalize:normalizePcSnapshots,hasData:pcSnapshotHasData\}\)/);
  const entity=script('showcase-stage5-entity-js');
  assert.match(entity,/function entityPcSnapshots\(pc\)\{const tools=window\.PLPCSnapshotTools/);
  assert.match(entity,/function entityPcSnapshotHasData\(s\)\{const tools=window\.PLPCSnapshotTools/);
  assert.doesNotMatch(entity,/\bnormalizePcSnapshots\(/,'entity showcase must not call the private PC helper directly');
  assert.doesNotMatch(entity,/\.filter\(pcSnapshotHasData\)/,'entity showcase must not call the private snapshot predicate directly');
});

test('PC/module live preview traps runtime failures instead of staying on loading forever',()=>{
  const entity=script('showcase-stage5-entity-js');
  assert.match(entity,/async function renderUnsafe\(\)/);
  assert.match(entity,/async function render\(\)\{\s*try\{return await renderUnsafe\(\);\}/);
  assert.ok(entity.includes('档案图片实时预览未生成'));
  assert.ok(entity.includes('ENTITY-PREVIEW-RUNTIME'));
  assert.ok(entity.includes('data-entity-preview-retry'));
  assert.ok(entity.includes('当前档案、未保存草稿和图库均未因本次预览被改写'));
});

test('compatibility runtime error banner is dismissible and can surface later errors again',()=>{
  const boot=script('compatBootstrap');
  assert.ok(boot.includes('data-compat-error-close'));
  assert.ok(boot.includes('关闭异常提示'));
  assert.ok(boot.includes('技术详情（可复制）'));
  assert.match(boot,/box\.remove\(\);shown=false/);
  assert.match(boot,/if\(existing\)\{var detail=existing\.querySelector/);
});

test('current release keeps snapshot/export fixes in presentation-only code',()=>{
  const entity=script('showcase-stage5-entity-js');
  for(const forbidden of ['pcs=','modules=','runRecords=','saveState(','localStorage.setItem(STORAGE_KEY']){
    assert.equal(entity.includes(forbidden),false,`entity export must remain read-only: ${forbidden}`);
  }
});
