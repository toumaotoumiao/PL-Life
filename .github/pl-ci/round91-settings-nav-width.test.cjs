'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const audit=fs.readFileSync(path.join(__dirname,'round88-settings-live-browser.cjs'),'utf8');
test('desktop and tablet Settings use one navigation width contract',()=>{
 const defs=[...html.matchAll(/grid-template-columns:var\(--settings-sidebar-width\) minmax\(0,1fr\)/g)];
 assert.equal(defs.length,2,'both desktop Settings grid declarations must share one width');
 assert.match(html,/\.settings-modal\{--settings-sidebar-width:clamp\(208px,19vw,220px\)\}/);
 assert.doesNotMatch(html,/grid-template-columns:170px minmax\(0,1fr\)/);
});
test('mobile navigation remains an independent full-width four-column layout',()=>{
 assert.match(html,/@media\(max-width:760px\)\{\s*\.settings-modal \.settings-nav\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});
test('browser acceptance checks physical navigation, content and primary controls',()=>{
 for(const fragment of ['r.width<200','r.right>content.left+2','content.width<400','nav.scrollWidth>nav.clientWidth+3','b.right>innerWidth+2','settings-layout-audit.json'])assert(audit.includes(fragment),fragment);
});
