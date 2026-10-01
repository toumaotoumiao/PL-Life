'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const baseline=require('./round234-release-history-baseline.json');
const match=source.match(/const APP_UI_VERSION\s*=\s*"([^"]+)"/);
const version=match?.[1];
const entries=[...source.matchAll(/<div class="version-log-item"><strong class="version-log-version">v([^<]+)<\/strong><span class="version-log-copy">(.*?)<\/span><\/div>/g)];
test('Round234 current displayed version, application version and cache match without pinning future releases',()=>{
 assert.ok(version,'APP_UI_VERSION missing');assert.equal(entries[0]?.[1],version);
 assert.ok(source.includes(`当前版本 v${version}`));
 assert.ok(source.includes(`id="settingsOverviewVersion">v${version}`));
 assert.ok(sw.includes(`v${version}`));
});
test('Round234 prior release notes stay immutable when the current version advances',()=>{
 const found=new Map();for(const entry of entries){
  const group=found.get(entry[1])||[];group.push(entry[2]);found.set(entry[1],group);
 }
 // Pre-existing historical collisions belong to a separate archival review;
 // do not rewrite legacy release numbers just to make this contract green.
 for(const [v,sha] of Object.entries(baseline)){
  assert.equal(found.get(v)?.length,1,`recent historical entry ${v} missing or duplicated`);
  assert.equal(crypto.createHash('sha256').update(found.get(v)[0]).digest('hex'),sha,`historical entry ${v} unexpectedly changed`);
 }
});
