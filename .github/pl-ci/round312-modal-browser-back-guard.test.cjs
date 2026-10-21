'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const closing=html.slice(html.indexOf('let systemBackClosingSurfaceId = "";'),html.indexOf('function initSystemBackNavigation()'));
const consuming=html.slice(html.indexOf('function consumeSurfaceHistory(id) {'),html.indexOf('const modalSurfaceLifecycleObserved'));
assert.ok(closing.startsWith('let systemBackClosingSurfaceId'));
assert.ok(consuming.startsWith('function consumeSurfaceHistory'));
function simulate({refuse=false}={}) {
 let open=true,backCalls=0,guards=[],tasks=[];
 const scope={
  queueMicrotask:fn=>tasks.push(fn),
  setTimeout:fn=>fn(),
  history:{state:{tag:'pl',modal:'pcEditorBackdrop'},back:()=>backCalls++,replaceState:()=>{}},
  HISTORY_STATE_TAG:'pl', currentView:'pcs',
  topOpenHistorySurfaceId:()=>open?'pcEditorBackdrop':'',
  closeHistorySurfaceById:()=>{if(!refuse){open=false;scope.consumeSurfaceHistory('pcEditorBackdrop');}return true;},
  restorePoppedSurfaceGuard:id=>guards.push(id),
  historySurfaceIsOpen:()=>open
 };
 vm.createContext(scope);
 vm.runInContext(`${closing}\n${consuming}\nthis.consumeSurfaceHistory=consumeSurfaceHistory;this.runBack=closeTopSurfaceFromSystemBack;`,scope);
 scope.runBack();for(const fn of tasks)fn();
 return {backCalls,guards,open};
}
test('system Back closes an already-popped PC modal without issuing an extra history.back',()=>{
 assert.deepEqual(simulate(),{backCalls:0,guards:[],open:false});
});
test('a refused modal close restores its Back guard without losing the editor',()=>{
 assert.deepEqual(simulate({refuse:true}),{backCalls:0,guards:['pcEditorBackdrop'],open:true});
});
test('real browser test retains both viewport and actual Back assertions with explicit document check',()=>{
 const browser=fs.readFileSync(path.resolve(__dirname,'round162-modal-history-race-browser.py'),'utf8');
 for(const phrase of ['for width in (375,1280)','real browser Back dismisses PC editor','real browser Back dismisses plan editor','page did not navigate away from the application']) assert.ok(browser.includes(phrase),phrase);
});
