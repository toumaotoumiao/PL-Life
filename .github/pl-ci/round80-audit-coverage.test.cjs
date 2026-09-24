"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=fs.readFileSync(path.join(__dirname,'round78-ui-browser-audit.cjs'),'utf8');
test('onboarding modal must be dismissed before UI screenshots',()=>{
 assert.match(file,/onboardingLaterBtn/);
 assert.match(file,/onboarding-still-blocks-page/);
 assert.match(file,/await page\.waitForTimeout\(850\)/);
});
test('mobile navigation must use the visible bottom nav, not hidden desktop button click',()=>{
 assert.match(file,/#mobileBottomNav \[data-view-target/);
 assert.match(file,/page\.locator\(selector\)\.click/);
 assert.doesNotMatch(file,/page\.evaluate\(id=>document\.getElementById\(id\)\?\.click\(\),button\)/);
});
test('failed navigation must preserve diagnostics and a screenshot',()=>{
 assert.match(file,/physical-view-switch-failed/);
 assert.match(file,/visibleViews/);
 assert.match(file,/ui-failure-/);
});

test('sensitive image export audit must open the composer directly and verify inline privacy control through the visible switch',()=>{
 assert.match(file,/verifyInlineExportPrivacy/);
 assert.match(file,/data-export-inline-privacy-toggle/);
 assert.match(file,/export-inline-privacy-switch/);
 assert.match(file,/switchLabel\.click/);
 assert.match(file,/privacy-inline-control-missing/);
 assert.match(file,/privacy-inline-control-did-not-restore/);
 assert.match(file,/privacy-preflight-unexpectedly-blocking/);
 assert.doesNotMatch(file,/toggle\.click\(\{timeout:5000\}\)/);
 assert.doesNotMatch(file,/completeSensitiveExportPreflight/);
});
