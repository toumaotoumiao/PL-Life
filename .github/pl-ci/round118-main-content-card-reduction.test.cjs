'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('third UI reduction layer exists and covers all five main content cards',()=>{
  assert(html.includes('id="content-card-reduction-v180"'));
  for(const token of ['#profilesView .card','#pcsView .pc-card','#modulesView .native-module-card','#plansView .plan-list-item','#recordsView .table-record']){
    assert(html.includes(token),`${token} missing from v180 UI layer`);
  }
  assert.match(html,/border-radius:13px!important;box-shadow:none!important/);
});

test('PL list defaults to four rated items while preserving explicit expand-all action',()=>{
  assert.match(html,/ratedFields\.slice\(0, 4\)/);
  assert.match(html,/ratingFields\.length > 4 && ratedCount/);
  assert.match(html,/显示全部 \$\{ratingFields\.length\} 项评分/);
  assert.match(html,/#profilesView \.score-badge \.updated-chip\{display:none!important\}/);
});

test('PC list keeps only five provided core values and leaves detail archive untouched',()=>{
  assert.match(html,/pcCoreStats\(pc\)\.filter\(\(\[,v\]\)=>pcStatProvided\(v\)\)\.slice\(0,5\)/);
  assert.match(html,/#pcsView \.pc-core-stat\{[^}]*border:0!important/);
});

test('module compact list keeps three summary tags while card shows all filled metadata; long notes stay folded',()=>{
  assert.match(html,/native-module-row-tags">\$\{tags\.slice\(0, 3\)/);
  assert.match(html,/const metaHTML=`<div class="native-module-tags">\$\{tags\.map\(t =>/);
  assert.match(html,/const noteHTML=noteText\?`<details class="native-module-note">/);
  assert.match(html,/#modulesView details\.native-module-note>summary/);
});

test('plan list gives horizontal space back to content while drag remains accessible',()=>{
  assert.match(html,/#plansView \.plan-list-item\{grid-template-columns:38px minmax\(0,1fr\) auto!important/);
  assert.match(html,/#plansView \.plan-drag-label\{position:absolute!important;width:1px!important/);
  assert.match(html,/aria-label="拖动 \$\{escapeHTML\(title\)\} 到日历安排"/);
});

test('record list stops emitting an empty Log chip but still reports real log content',()=>{
  assert.match(html,/if \(logCount \|\| draftNotes\) chips\.push/);
  const block=html.slice(html.indexOf('function recordHeaderSummaryChips'),html.indexOf('function recordHeaderTitle'));
  assert(!block.includes('"无 Log"'),'empty Log chip should be removed from list header');
  assert(block.includes('"有 Log"'),'real Log indicator should remain');
  assert.match(html,/#recordsView \.record-collapse-strip-hint\{display:none!important\}/);
});
