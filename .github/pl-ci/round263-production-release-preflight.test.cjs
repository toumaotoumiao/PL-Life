const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),sw=read('sw.js');
const manifest=JSON.parse(read('production-release-manifest.json'));

test('production release manifest tracks current app, schema and cache version',()=>{
  const app=html.match(/const APP_UI_VERSION\s*=\s*["']([^"']+)/)?.[1];
  const schema=Number(html.match(/const DATA_SCHEMA_VERSION\s*=\s*(\d+)/)?.[1]);
  const cache=sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1];
  assert.equal(manifest.appVersion,app);
  assert.equal(manifest.schemaVersion,schema);
  assert.equal(cache,app);
});

test('every service-worker app-shell asset is in production release root allowlist and exists',()=>{
  const block=sw.match(/const APP_SHELL=\[(.*?)\];/s)?.[1]||'';
  const shell=[...block.matchAll(/["'](\.\/[^"']+)["']/g)].map(x=>x[1].replace(/^\.\//,''));
  assert.ok(shell.length>=20);
  const allow=new Set(manifest.rootFiles);
  for(const rel of shell){
    assert.ok(allow.has(rel),`release manifest missing APP_SHELL asset ${rel}`);
    assert.ok(fs.existsSync(path.join(root,rel)),`repository missing APP_SHELL asset ${rel}`);
  }
});

test('production release explicitly keeps CI and native recovery portability assets',()=>{
  for(const rel of [
    '.github/workflows/pl-browser-synthetic.yml',
    '.github/workflows/pl-native-restore-gate.yml',
    '.github/pl-ci/round187-native-fullapp-restore-browser.py',
    '.github/pl-ci/round251-native-result-attestation.py',
    'RUN_STAGE48_NATIVE_RECOVERY.cmd',
    'STAGE48_NATIVE_RECOVERY_WINDOWS.md'
  ]) assert.ok(fs.existsSync(path.join(root,rel)),`missing ${rel}`);
  assert.ok(manifest.includeDirectories.includes('.github'));
  assert.ok(manifest.rootFiles.includes('RUN_STAGE48_NATIVE_RECOVERY.cmd'));
  assert.ok(manifest.rootFiles.includes('STAGE48_NATIVE_RECOVERY_WINDOWS.md'));
});

test('production release forbids private workbook/media/archive source extensions',()=>{
  const forbidden=new Set(manifest.privateExtensionsForbidden.map(x=>x.toLowerCase()));
  for(const rel of manifest.rootFiles)assert.ok(!forbidden.has(path.extname(rel).toLowerCase()),`forbidden extension in root allowlist: ${rel}`);
  assert.ok(forbidden.has('.xlsx'));
  assert.ok(forbidden.has('.pdf'));
  assert.ok(forbidden.has('.mov'));
  assert.ok(forbidden.has('.mp4'));
  assert.ok(forbidden.has('.zip'));
});
