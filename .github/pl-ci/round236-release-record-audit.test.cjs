'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const expected=require('./round236-legacy-release-baseline.json');
const found={};for (const [,version,copy] of html.matchAll(/<div class="version-log-item"><strong class="version-log-version">v([^<]+)<\/strong><span class="version-log-copy">(.*?)<\/span><\/div>/g)){
 if(!(version in expected))continue;
 (found[version]??=[]).push(crypto.createHash('sha256').update(copy).digest('hex'));
}
test('Round236 historical duplicate release records retain original ordering and content',()=>{for(const [v,hashes] of Object.entries(expected)){assert.ok(hashes.length>1,`expected prior ambiguity for ${v}`);assert.deepEqual(found[v],hashes,`historical release ${v} silently rewritten`);}});
test('Round236 legacy collisions stay explicitly enumerated without relying on stage-report packaging',()=>{const keys=Object.keys(expected).sort();assert.deepEqual(keys,['8.1.12.101','8.1.12.52','8.1.12.69','8.1.12.79'].sort());for(const hashes of Object.values(expected)){assert.ok(hashes.length>1);assert.equal(new Set(hashes).size,hashes.length);}assert.deepEqual(Object.keys(found).sort(),keys);});
