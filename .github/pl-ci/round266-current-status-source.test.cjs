const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const status=JSON.parse(read('CURRENT_PROJECT_STATUS.json'));
const manifest=JSON.parse(read('production-release-manifest.json'));
const html=read('index.html'),sw=read('sw.js'),readme=read('README.md'),guide=read('PRODUCTION_RELEASE_GUIDE.md');

test('CURRENT_PROJECT_STATUS is the unique declared current-state source',()=>{
  assert.equal(status.format,'pl-life-current-project-status');
  assert.equal(status.sourceOfTruth,true);
  assert.equal(status.statusPolicy.authoritativeFile,'CURRENT_PROJECT_STATUS.json');
  assert.match(status.statusPolicy.historicalStageReports,/not_current_status/);
  assert.ok(status.doNotInferCurrentStatusFrom.includes('STAGE*.md'));
  assert.match(readme,/CURRENT_PROJECT_STATUS\.json.*唯一的当前项目状态源/s);
  assert.match(guide,/当前状态的唯一来源[\s\S]*CURRENT_PROJECT_STATUS\.json/);
  assert.match(guide,/currentVersionAcceptance\.release\.artifactNames/);
  assert.doesNotMatch(guide,/Stage\d+_正式仓库完整同步包\.zip/);
});

test('current status, app, service worker and production manifest versions are consistent',()=>{
  const app=html.match(/const APP_UI_VERSION\s*=\s*"([^"]+)"/)?.[1];
  const schema=Number(html.match(/const DATA_SCHEMA_VERSION\s*=\s*(\d+)/)?.[1]);
  const cache=sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1];
  assert.ok(Number.isInteger(status.current.stage)&&status.current.stage>=91);
  assert.equal(status.current.appVersion,app);
  assert.equal(status.current.schemaVersion,schema);
  assert.equal(manifest.appVersion,app);
  assert.equal(manifest.schemaVersion,schema);
  assert.equal(cache,app);
});

test('production package contains the current state but excludes internal Stage snapshots',()=>{
  assert.ok(manifest.rootFiles.includes('CURRENT_PROJECT_STATUS.json'));
  const stage=Number(status.current.stage);
  for(const n of [stage-2,stage-1,stage])assert.ok(manifest.generatedOrInternalRootPrefixesForbidden.includes(`STAGE${n}_`));
  assert.ok((status.currentVersionAcceptance.release.artifactNames||[]).every(name=>name.startsWith(`Stage${stage}_`)));
  assert.ok(!manifest.rootFiles.some(name=>/^STAGE\d+_/.test(name)&&name!=='STAGE48_NATIVE_RECOVERY_WINDOWS.md'));
});

test('status separates baseline acceptance from current-version targeted real-device checks',()=>{
  assert.equal(status.acceptedBaselines.realDeviceGeneral.state,'accepted');
  assert.equal(status.currentVersionAcceptance.realDevice.state,'targeted-checks-pending');
  assert.ok(status.currentVersionAcceptance.realDevice.pending.length>=2);
  assert.equal(status.workstreams.imageExport.realDevice,'targeted-check-pending');
  assert.notEqual(status.workstreams.imageExport.automatedTests,'real-device-pass');
});
