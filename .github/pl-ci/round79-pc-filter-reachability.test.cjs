'use strict';
// Synthetic DOM only. Regression for the two distinct PC controls sharing data-mobile-page-sheet="pcs".
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const site=fs.existsSync(path.join(root,'site/index.html'))?path.join(root,'site'):root;
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const source=html.match(/function updatePcArchiveControlDensity\([\s\S]*?\n  \}\n  \/\/ 仅用于 PC/);
assert(source,'PC archive control-density function must be present');
const fn=source[0].replace(/\n  \/\/ 仅用于 PC[\s\S]*$/,'');
function simulate(total,query=''){
  const filter={hidden:false},more={hidden:false},batch={hidden:false},reset={hidden:false};
  const queries=[];
  const toolbar={querySelector(sel){queries.push(sel);return sel==='.mobile-page-tools-btn[data-mobile-page-sheet="pcs"]'?more:null;}};
  const document={getElementById(id){return id==='pcBatchToggleBtn'?batch:null;}};
  const context={pcToolbarMain:toolbar,document,pcFilterActiveText:{textContent:''},pcFilterResetBtn:reset,
    els:{pcSort:{hidden:false}},pcLayoutSwitch:{hidden:false},pcs:Array.from({length:total},()=>({})),pcBatchMode:false};
  vm.runInNewContext(fn+'\nupdatePcArchiveControlDensity({q:'+JSON.stringify(query)+'});',context,{timeout:1000});
  return {filter,more,batch,reset,queries};
}
test('empty archive never hides PC filter by mistaking it for the mobile More button',()=>{
  const r=simulate(0);assert.equal(r.filter.hidden,false);assert.equal(r.more.hidden,true);
  assert.deepEqual(r.queries,['.mobile-page-tools-btn[data-mobile-page-sheet="pcs"]']);
});
test('single PC leaves filter accessible while redundant More remains hidden',()=>{
  const r=simulate(1);assert.equal(r.filter.hidden,false);assert.equal(r.more.hidden,true);
});
test('multiple PCs keep filter accessible, expose mobile More',()=>{
  const r=simulate(2);assert.equal(r.filter.hidden,false);assert.equal(r.more.hidden,false);
});
test('active search leaves filter available regardless of record count',()=>{
  const r=simulate(0,'角色');assert.equal(r.filter.hidden,false);assert.equal(r.more.hidden,false);
});
test('batch insertion locates the genuine More control, not the adjacent filter trigger',()=>{
  assert.match(html,/const mobileBtn=pcToolbarMain\.querySelector\('\.mobile-page-tools-btn\[data-mobile-page-sheet="pcs"\]'\)/);
  assert.doesNotMatch(html,/document\.querySelector\('\[data-mobile-page-sheet="pcs"\]'\)/);
});
