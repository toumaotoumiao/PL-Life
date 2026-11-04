"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const root = __dirname;
const fullAppSyntheticScripts = fs.readdirSync(root).filter(name => name.endsWith(".py") && /(?:page|\bpage)\.set_content/.test(fs.readFileSync(path.join(root,name),"utf8")) && fs.readFileSync(path.join(root,name),"utf8").includes("set_content(html") && fs.readFileSync(path.join(root,name),"utf8").includes("index.html"));

test("full-app synthetic Chromium tests use same-machine storage-capable origin", () => {
  // Round162 exercises actual browser history by navigating to the real index.html
  // instead of rewriting a bootstrap document with set_content().
  assert.ok(fullAppSyntheticScripts.length >= 40, "Expected full legacy browser suite, not a reduced test set");
  for (const name of fullAppSyntheticScripts) {
    const source=fs.readFileSync(path.join(root,name),"utf8");
    assert.match(source, /from synthetic_browser_origin import prepare_synthetic_origin/, `${name}: missing origin helper`);
    assert.match(source, /prepare_synthetic_origin\(page\);page\.set_content\(html/, `${name}: must establish origin before rendering`);
    assert.ok(!source.includes("page.set_content(html") || source.indexOf("prepare_synthetic_origin(page);page.set_content(html") !== -1,
      `${name}: origin setup bypassed`);
  }
  const historyScript=fs.readFileSync(path.join(root,"round162-modal-history-race-browser.py"),"utf8");
  assert.match(historyScript,/from synthetic_browser_origin import prepare_synthetic_origin/);
  assert.match(historyScript,/origin=prepare_synthetic_origin\(page\)/);
  assert.match(historyScript,/page\.goto\(origin\+'\/index\.html'/);
  assert.doesNotMatch(historyScript,/page\.set_content\(/);
});
test("origin helper serves loopback bootstrap without bypassing browser errors", () => {
 const helper=fs.readFileSync(path.join(root,"synthetic_browser_origin.py"),"utf8");
 assert.match(helper, /ThreadingHTTPServer\(\("127\.0\.0\.1", 0\)/);
 assert.match(helper, /page\.goto\(origin \+ _BOOTSTRAP/);
 assert.doesNotMatch(helper, /page\.on\(['"]pageerror|preventDefault\(|window\.onerror\s*=|unhandledrejection/);
});
test("synthetic browser scripts remain valid Python and import helper", () => {
 const program = "import ast,sys,pathlib;[ast.parse(pathlib.Path(p).read_text(encoding='utf8')) for p in sys.argv[1:]]";
 const scriptNames=[...new Set([...fullAppSyntheticScripts,"round162-modal-history-race-browser.py"])];
 const run=spawnSync("python3",["-c",program,...scriptNames.map(n=>path.join(root,n))],{encoding:"utf8",timeout:10000});
 assert.equal(run.status,0,run.stderr || run.error?.message);
});

test("Node synthetic full-app tests also initialize a real loopback origin", () => {
 const cases = [
   "round136-editor-export-flow-browser.cjs",
   "round137-stats-preview-runtime-browser.cjs",
   "round138-objective-copy-browser.cjs",
   "round139-stats-panel-collapse-browser.cjs",
   "round140-stats-panel-scope-browser.cjs"
 ];
 for (const name of cases) {
   const source=fs.readFileSync(path.join(root,name),"utf8");
   assert.match(source,/require\(['"]\.\/synthetic-browser-origin\.cjs['"]\)/);
   assert.match(source,/await prepareSyntheticOrigin\(page\);await page\.setContent\(html/);
 }
 const helper=fs.readFileSync(path.join(root,"synthetic-browser-origin.cjs"),"utf8");
 assert.match(helper,/server\.listen\(0,"127\.0\.0\.1"/);
 assert.doesNotMatch(helper,/preventDefault\(|unhandledrejection|page\.on\(['"]pageerror/);
});
