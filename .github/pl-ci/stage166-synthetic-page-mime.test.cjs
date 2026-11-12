'use strict';
// Regression for Stage165 Github Chromium CI: page.goto(index.html) must
// navigate to HTML, not trigger a binary-file download. Never uses user data.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {prepareSyntheticOrigin}=require('./synthetic-browser-origin.cjs');

test('shared local synthetic server serves actual HTML documents for browser navigation',async()=>{
  let origin;
  const fakePage={
    goto:async url=>{origin=new URL(url).origin;},
    evaluate:async()=>origin
  };
  const result=await prepareSyntheticOrigin(fakePage);
  assert.equal(result,origin);
  for(const pathname of ['/index.html','/module-tools.html','/storage-diagnostic.html']){
    const response=await fetch(origin+pathname);
    assert.equal(response.status,200,pathname);
    assert.match(response.headers.get('content-type')||'',/^text\/html(?:;|$)/,pathname);
    assert.notEqual(response.headers.get('content-disposition'),'attachment',pathname);
    const body=await response.text();
    assert.match(body,/<html\b|<!doctype html/i,pathname);
  }
});

test('shared local origin keeps script, service worker, manifest and missing paths correct',async()=>{
  let origin;
  await prepareSyntheticOrigin({goto:async url=>{origin=new URL(url).origin;},evaluate:async()=>origin});
  for(const [file,mime] of [['/sw.js','text/javascript'],['/module-query-bridge.js','text/javascript'],['/manifest.webmanifest','application/manifest+json'],['/icon-192.png','image/png']]){
    const response=await fetch(origin+file);
    assert.equal(response.status,200,file);
    assert.ok((response.headers.get('content-type')||'').startsWith(mime),file);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff',file);
  }
  assert.equal((await fetch(origin+'/nonexistent-stage166-asset.html')).status,404);
  // The local origin must not serve parent-directory files.
  assert.equal((await fetch(origin+'/../nonexistent-stage166-asset.html')).status,404);
});

const fs=require('node:fs');
const path=require('node:path');
test('Round290 Python exit status is preserved by GitHub CI and final release gate',()=>{
  const workflow=fs.readFileSync(path.resolve(__dirname,'../workflows/pl-browser-synthetic.yml'),'utf8');
  assert.match(workflow,/id: round290_browser\n\s*continue-on-error: true\n\s*shell: bash\n\s*run: \|\n\s*set -o pipefail/);
  assert.match(workflow,/"Round290:\$\{\{ steps\.round290_browser\.outcome \}\}"/);
  assert.match(workflow,/node --test \.github\/pl-ci\/stage166-synthetic-page-mime\.test\.cjs/);
});

test('all four formerly blocked Chromium suites open an HTML document from the shared origin',()=>{
  for(const file of ['module-toolbar-actions-browser.cjs','backup-location-actions-browser.cjs','stage163-ui-copy-browser.cjs','stage165-responsive-copy-browser.cjs']){
    const script=fs.readFileSync(path.join(__dirname,file),'utf8');
    assert.match(script,/await prepareSyntheticOrigin\(page\)/,file);
    assert.match(script,/page\.goto\(origin\+'\/index\.html'/,file);
  }
});
