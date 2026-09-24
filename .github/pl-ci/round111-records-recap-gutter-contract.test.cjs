'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('records recap modal owns one shared desktop gutter contract',()=>{
  assert.match(html,/\.records-recap-modal\{--records-recap-gutter-x:16px;--records-recap-gutter-y:12px;/);
  assert.match(html,/\.records-recap-modal>\.export-center-head\{padding-left:var\(--records-recap-gutter-x\);padding-right:var\(--records-recap-gutter-x\)\}/);
  assert.match(html,/\.records-recap-body\{min-height:0;overflow:hidden;padding:var\(--records-recap-gutter-y\) var\(--records-recap-gutter-x\)\}/);
  assert.match(html,/\.records-recap-modal>\.export-center-foot\{padding-left:var\(--records-recap-gutter-x\)!important;padding-right:var\(--records-recap-gutter-x\)!important\}/);
});

test('records recap grid stays inside the padded body instead of touching modal edges',()=>{
  assert.match(html,/\.records-recap-modal \.export-composer-grid\{height:100%;min-height:0;grid-template-columns:minmax\(300px,340px\) minmax\(0,1fr\);gap:14px;align-items:stretch\}/);
  assert.doesNotMatch(html,/\.records-recap-body\{min-height:0;overflow:hidden\}\.records-recap-modal \.export-composer-grid/);
});

test('focus preview reuses the same body gutter rather than replacing it',()=>{
  assert.match(html,/\.records-recap-modal\.preview-focus \.export-composer-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.doesNotMatch(html,/preview-focus \.records-recap-body\{[^}]*padding\s*:\s*0/);
});

test('mobile recap gutter shrinks deliberately instead of disappearing',()=>{
  assert.match(html,/@media\(max-width:760px\)\{[\s\S]*?\.records-recap-modal\{--records-recap-gutter-x:10px;--records-recap-gutter-y:10px;/);
  assert.doesNotMatch(html,/@media\(max-width:760px\)\{[\s\S]*?\.records-recap-body\{[^}]*padding\s*:\s*0/);
});
