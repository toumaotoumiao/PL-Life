'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('annual planner display mode has three buttons and exactly three desktop columns',()=>{
  const m=html.match(/<div class="stats-segmented planner-year-mode-switch"[\s\S]*?<\/div>/);
  assert(m,'planner year switch missing');
  assert.equal((m[0].match(/<button\b/g)||[]).length,3);
  assert.match(html,/\.planner-year-mode-switch\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(html,/\.planner-year-mode-switch\{[^}]*grid-template-columns:1fr 1fr!important/);
});

test('annual planner mobile mode does not wrap the third choice onto its own row',()=>{
  assert.match(html,/@media\(max-width:430px\)\{\.planner-year-mode-switch\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}/);
  assert.doesNotMatch(html,/@media\(max-width:430px\)\{\.planner-year-mode-switch\{grid-template-columns:1fr!important\}/);
});

test('PL KP organizer 1 2 3 column selector also uses three columns',()=>{
  const m=html.match(/<div class="stats-segmented ho-export-style-switch">[\s\S]*?<\/div>/);
  assert(m,'organizer column switch missing');
  assert.equal((m[0].match(/<button\b/g)||[]).length,3);
  assert.match(html,/\.ho-export-style-switch,\.ho-export-detail-switch\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(html,/\.ho-export-style-switch,\.ho-export-detail-switch\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
});
