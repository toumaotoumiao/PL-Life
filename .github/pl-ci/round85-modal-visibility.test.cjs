'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'round82-log-live-browser.cjs'),'utf8');
const strip=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
function parentSectionOf(id){
 const tag=strip.match(new RegExp('<(?:div|section)\\b[^>]*\\bid="'+id+'"[^>]*>'));
 assert(tag,'missing element '+id);
 const start=strip.indexOf(tag[0]);
 const stack=[];const pattern=/<\/?(?:section|div)\b[^>]*>/gi;
 let token;
 while((token=pattern.exec(strip))&&token.index<start){
  if(token[0].startsWith('</'))stack.pop();else stack.push(token[0]);
 }
 return stack.filter(s=>/\bid="(?:profiles|pcs|modules|plans|records|selfIntro|stats)View"/.test(s));
}
test('all modal editors and periodic schedule are outside hidden main views',()=>{
 for(const id of ['planEditorBackdrop','periodicScheduleBackdrop','nativeModuleEditorBackdrop','moduleAdvancedBackdrop'])
  assert.deepEqual(parentSectionOf(id),[],id+' must not inherit hidden main view');
});
test('Log browser test opens a plan from another view and checks physical visibility',()=>{
 assert.match(script,/openPlanEditor\('round82-plan'\)/);
 assert.doesNotMatch(script,/switchView\('plans'\)/);
 assert.match(script,/await plan\.isVisible\(\)/);
 assert.match(script,/hiddenAncestor/);
 assert.match(script,/await record\.isVisible\(\)/);
 assert.match(script,/recordDetailReveal\('round82-record'\)/);
 assert.match(script,/activateRecordEditing\('round82-record'\)/);
 assert.doesNotMatch(script,/recordEditingIds\.add\('round82-record'\)/);
});

test('opening a record editor must locate the actual row and expand default-collapsed body',()=>{
 const source=html.slice(html.indexOf('function activateRecordEditing('),html.indexOf('function flushRecordBeforeEditorMove('));
 assert.match(source,/recordEditingIds\.add\(id\)/);
 assert.match(source,/setRunRecordCollapsed\(id, false, false\)/);
 assert.match(source,/renderRunRecords\(/);
 assert.match(html,/\.table-record\.is-collapsed \.table-record-body\s*\{display:none\}/);
 const otherAdds=[...html.matchAll(/recordEditingIds\.add\(([^)]*)\)/g)];
 assert(otherAdds.length>=3);
 for(const match of otherAdds){
   const follow=html.slice(match.index,match.index+215);
   assert.match(follow,/setRunRecordCollapsed\([^;]*false, false\)/,'editing must expand the targeted record: '+match[0]);
 }
 assert.match(script,/if\(!recordDetailReveal\('round82-record'\)\)/);
 assert.match(script,/if\(!activateRecordEditing\('round82-record'\)\)/);
});
