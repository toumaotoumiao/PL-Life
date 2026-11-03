'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const syn=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const nat=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8'));
function section(full,title,nextTitle){
  const p=full.indexOf('      - name: '+title+'\n');
  assert.ok(p>=0,`missing section ${title}`);
  const n=nextTitle?full.indexOf('      - name: '+nextTitle+'\n',p+5):full.indexOf('\n      - name:',p+5);
  assert.ok(n>p,`missing end of section ${title}`);
  return full.slice(p,n);
}
test('两条必要 CI 工作流均显式固定 Ubuntu 24.04，避免滚动镜像改变依赖',()=>{
  assert.match(syn,/runs-on: ubuntu-24\.04/);
  assert.match(nat,/runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(syn,/runs-on: ubuntu-latest/);
  assert.doesNotMatch(nat,/runs-on: ubuntu-latest/);
});
test('浏览器前置 Node 门禁之前已建立证据目录，失败不能只剩后续 Python 堆栈',()=>{
  const pre=syn.indexOf('name: Prepare browser diagnostics directory before any regression guards');
  const first=syn.indexOf('name: Guard full-app Chromium tests against opaque browser origin');
  const deps=syn.indexOf('name: Install pinned test-only browser runner');
  assert.ok(pre>0 && pre<first && first<deps);
  assert.match(syn.slice(pre,first),/run-context\.txt/);
  assert.match(syn.slice(pre,first),/runner-image\.txt/);
});
test('所有早期 Node 门禁均持有独立状态 ID，确保可定位第一个上游失败步骤',()=>{
  const pre=syn.slice(0,syn.indexOf('name: Install pinned test-only browser runner'));
  const ids=[...pre.matchAll(/id: ci_guard_\d{3}/g)];
  assert.ok(ids.length>=80,`found ${ids.length} guards`);
  assert.equal(new Set(ids.map(x=>x[0])).size,ids.length);
});
test('Python 浏览器依赖安装真实校验 import bs4 与 playwright，并保存安装日志',()=>{
  const part=section(syn,'Install pinned visual-check runner','Stage152 real Chromium isolated search and share component at eight viewports');
  assert.match(part,/id: python_deps/);
  assert.match(part,/beautifulsoup4==4\.13\.4/);
  assert.match(part,/playwright==1\.55\.0/);
  assert.match(part,/import bs4, playwright/);
  assert.match(part,/python-deps\.log/);
  assert.match(part,/set -o pipefail/);
});
test('DND Python 浏览器步骤只在依赖成功安装后运行，不再级联 ModuleNotFoundError',()=>{
  const seg=syn.slice(syn.indexOf('name: Round217 D&D 5e private structure browser layout'),syn.indexOf('name: Round245 independent synthetic XLSX'));
  for(const label of ['Round217','Round218','Round219','Round220','Round221','Round238','Round240','Round242']){
    const needle=new RegExp('name: '+label+'[^\\n]*\\n[\\s\\S]*?if: \\$\\{\\{ always\\(\\) && steps\\.python_deps\\.outcome == \'success\' \\$\\}\\}');
    // Evaluate each step alone to avoid falsely accepting another step's prerequisite.
    const match=seg.indexOf('name: '+label+' ');
    assert.ok(match>=0,label);
    const step=seg.slice(match,seg.indexOf('      - name:',match+4));
    assert.ok(step.includes("steps.python_deps.outcome == 'success'"),label);
  }
});
test('Round245 验证必须依赖 Round242 真正完成；无 Excel 时必须阻断而非抛假的 FileNotFoundError',()=>{
  const sec=section(syn,'Round245 independent synthetic XLSX ZIP and XML verification','Round207 Insane undo and mobile isolated Chromium');
  assert.match(sec,/steps\.round242_browser\.outcome == 'success'/);
  assert.match(sec,/steps\.python_deps\.outcome == 'success'/);
  assert.match(sec,/round242-fiction-workbook\.xlsx/);
});
test('浏览器 CI 结果保留第一个失败前置门禁、所有工具依赖状态及仓库 commit',()=>{
  const part=section(syn,'Record first CI failure and dependency/skip causes','Enforce critical browser results after subsequent checks');
  for(const x of ['first_guard_failure','python_deps','node_browser_deps','node_chromium_deps','round242_browser','ci-step-outcomes.txt','GITHUB_SHA'])assert.ok(part.includes(x),x);
  assert.match(part,/if: always\(\)/);
});
test('故障或跳过依然严格阻断浏览器发布门禁，不通过继续执行来伪造全绿',()=>{
  const part=section(syn,'Enforce critical browser results after subsequent checks','Upload synthetic-only metadata report');
  assert.match(part,/FAILED/);
  assert.match(part,/BLOCKED/);
  assert.match(part,/failed=1/);
  assert.match(part,/exit "\$failed"/);
});
test('原生 ZIP 门禁收集前置 Node 合同运行完整日志，管道保留测试真实退出码',()=>{
  const part=section(nat,'Check full-app native gate contract and recovery guards','Verify production release package preflight');
  assert.match(part,/id: native_node_contract/);
  assert.match(part,/set -o pipefail/);
  assert.match(part,/native-node-guard\.log/);
});
test('原生 ZIP 门禁记录所有预检、Python 安装及 Chromium 依赖日志',()=>{
  const e=['release-preflight.log','fictional-dnd-diff.log','native-result-fixtures.log','python-deps.log','chromium-deps.log','runner-image.txt'];
  for(const x of e)assert.ok(nat.includes(x),x);
});
test('原生 ZIP 门禁允许前置阶段失败，但报告不得把 NOT_RUN 宣称 PASS',()=>{
  const part=section(nat,'Publish truthful result in run summary','Attest native result coverage and checkout identity');
  assert.match(part,/status,phase,count='NOT_RUN'/);
  assert.match(part,/if status!='PASS'/);
  assert.match(nat,/first_failed_native_step/);
  assert.match(nat,/if: always\(\)/);
});
test('CI 修复不改变任何用户存档数据 schema 与目标正式版本',()=>{
  assert.equal(status.current.stage,153);
  assert.equal(status.current.appVersion,'8.1.12.331');
  assert.equal(status.current.schemaVersion,26);
  assert.equal(manifest.appVersion,'8.1.12.331');
  assert.equal(manifest.schemaVersion,26);
});

const os=require('node:os');
const cp=require('node:child_process');
function simulateTrace(source,simulated,pathPart){
  const m=source.match(/python3 - <<'PYCI'\n([\s\S]*?)\n          PYCI/);
  assert.ok(m,'CI prerequisite provenance code missing');
  const code=m[1].split('\n').map(x=>x.replace(/^          /,'')).join('\n');
  const td=fs.mkdtempSync(path.join(os.tmpdir(),'pl153-ci-evidence-'));
  try{
    const destination=path.join(td,pathPart);
    const env={...process.env, GITHUB_SHA:'fictional-commit',RUNNER_TEMP:td,RUNNER_OS:'Linux',REPORT_DIR:path.join(td,'pl-native-restore-evidence'),PL_CI_STEP_OUTCOMES:JSON.stringify(simulated)};
    fs.mkdirSync(env.REPORT_DIR,{recursive:true});
    const run=cp.spawnSync('python',['-c',code],{env,encoding:'utf8',timeout:10000});
    assert.equal(run.status,0,run.stderr);
    return fs.readFileSync(path.join(destination,'ci-step-outcomes.txt'),'utf8');
  }finally{fs.rmSync(td,{recursive:true,force:true});}
}
test('真实执行浏览器 CI 失败汇总：定位首个失败门禁，后续依赖明确标记 skipped',()=>{
  const result=simulateTrace(syn,{'ci_guard_003':{outcome:'success'},'ci_guard_017':{outcome:'failure'},'ci_guard_018':{outcome:'skipped'},'python_deps':{outcome:'skipped'},'round242_browser':{outcome:'skipped'},'round245_independent':{outcome:'skipped'}},'pl-synthetic-report');
  assert.match(result,/first_guard_failure=ci_guard_017/);
  assert.match(result,/failed_pre_browser_guards=ci_guard_017/);
  assert.match(result,/round245_independent=skipped/);
  assert.doesNotMatch(result,/PRIVATE|password|secret/);
});
test('真实执行原生 ZIP 失败汇总：原生恢复未运行时，记录独立前置失败根节点',()=>{
  const result=simulateTrace(nat,{'native_node_contract':{outcome:'failure'},'native_release_preflight':{outcome:'skipped'},'native_restore':{outcome:'skipped'}},'pl-native-restore-evidence');
  assert.match(result,/first_failed_native_step=native_node_contract/);
  assert.match(result,/native_restore=skipped/);
});
