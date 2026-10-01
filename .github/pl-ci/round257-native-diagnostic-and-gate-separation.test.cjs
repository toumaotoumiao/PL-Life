'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const browser=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const nativeWorkflow=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
const runner=fs.readFileSync(path.join(root,'.github/pl-ci/round187-native-fullapp-restore-browser.py'),'utf8');
test('Round257 synthetic browser reports Round187 but independent native workflow owns release enforcement',()=>{
  assert.match(browser,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\} \(informational in synthetic regression;/);
  const enforce=browser.slice(browser.indexOf('for check in'),browser.indexOf('done\n          exit "$failed"'));
  assert.doesNotMatch(enforce,/Round187:/);
  assert.match(nativeWorkflow,/if status!='PASS' or actual_commit!=expected_commit or actual_version!=expected_version:/);
  assert.match(nativeWorkflow,/round251-native-result-attestation\.py/);
});
test('Round257 reload failure evidence identifies startup layer without dumping archive contents',()=>{
  for(const token of ['reload_diagnostic','migrationReadOnlyKind','startupError',"out.guard='ok'", "out.integrity='ok'", "out.hydrate='ok'", "out.ensure='ok'",'manualEvidenceMatch']) assert.ok(runner.includes(token),token);
  assert.match(runner,/slice\(0,260\)/);
  assert.doesNotMatch(runner,/reload_diagnostic[^\n]*profiles|reload_diagnostic[^\n]*pcs/);
});
