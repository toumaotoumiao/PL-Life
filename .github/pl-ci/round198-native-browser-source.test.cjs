'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const runner=read('.github/pl-ci/round187-native-fullapp-restore-browser.py');
const native=read('.github/workflows/pl-native-restore-gate.yml');
const full=read('.github/workflows/pl-browser-synthetic.yml');

test('Round198 hosted CI selects its installed Playwright Chromium, not a system binary',()=>{
  for(const source of [native,full])assert.match(source,/PL_NATIVE_BROWSER_MODE: bundled/);
  assert.match(native,/python -m playwright install --with-deps chromium/);
  assert.match(runner,/mode == 'auto' and Path\('\/usr\/bin\/chromium'\)\.exists\(\)/);
  assert.match(runner,/mode = os\.environ\.get\('PL_NATIVE_BROWSER_MODE', 'auto'\)/);
  assert.match(runner,/browser_source/);
});
test('Round198 local tests keep ordinary system browser policy and cannot report blocked navigation as PASS',()=>{
  assert.match(runner,/if mode not in \('auto', 'bundled'\):/);
  assert.match(runner,/ERR_BLOCKED_BY_ADMINISTRATOR/);
  assert.match(runner,/report\['status'\]='BLOCKED'/);
  assert.match(runner,/if report\['status'\]!='PASS':raise SystemExit\(1\)/);
  assert.doesNotMatch(runner,/--no-managed-policy|--disable-policy|--ignore-certificate-errors/);
});
test('Round198 full app errors keep useful bounded diagnostics and fictional-only image evidence',()=>{
  assert.match(runner,/report\['restore_failure'\]/);
  assert.match(runner,/\[:300\]/);
  assert.match(runner,/round187-last-page\.png/);
  assert.match(runner,/report\['screenshot'\]='unavailable'/);
  assert.match(runner,/report\['phase'\] = 'navigate-native-local-origin'/);
  assert.doesNotMatch(runner,/PL收集梦想生活_完整备份_20\d\d|toumaotoumiao\.github\.io/);
});
test('Round198 native result must stay a mandatory non-skippable release gate',()=>{
  assert.match(native,/if status!='PASS' or actual_commit!=expected_commit or actual_version!=expected_version:/);
  assert.match(native,/if-no-files-found: error/);
  assert.match(full,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
  assert.match(native,/PL_NATIVE_BROWSER_MODE: bundled/);
  assert.match(native,/round198-native-browser-source\.test\.cjs/);
  assert.match(full,/round198-native-browser-source\.test\.cjs/);
});
