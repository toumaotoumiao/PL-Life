'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('function consumeSurfaceHistory(id)');
const end=html.indexOf('const modalSurfaceLifecycleObserved',start);
assert(start>=0&&end>start,'History lifecycle source missing');
const code=html.slice(start,end);
function makeContext({modal='onboardingBackdrop',successor='',guideIsOpen=false}={}){
 const scheduled=[],events=[];
 const history={state:{tag:'tomato-pl-v8',view:'profiles',modal},
  back(){events.push('back');},
  replaceState(next){events.push('replace');this.state=next;}};
 const context={history,HISTORY_STATE_TAG:'tomato-pl-v8',currentView:'profiles',location:{href:'http://localhost/index.html'},
  historySurfaceIsOpen:id=>id==='onboardingBackdrop'&&guideIsOpen,
  topOpenHistorySurfaceId:()=>successor,
  setTimeout:fn=>{scheduled.push(fn);return scheduled.length;}};
 vm.createContext(context);vm.runInContext(code,context,{timeout:1000});
 return {context,history,events,scheduled,run(){for(const fn of scheduled.splice(0))fn();}};
}
test('closing first-run guide clears stale history marker without navigating back',()=>{
 const env=makeContext();env.context.consumeSurfaceHistory('onboardingBackdrop');env.run();
 assert.deepEqual(env.events,['replace']);
 assert.equal(env.history.state.modal,undefined);
});
test('new Settings window survives a previously scheduled guide-dismissal callback',()=>{
 const env=makeContext({successor:'overlay'});env.context.consumeSurfaceHistory('onboardingBackdrop');env.run();
 assert.deepEqual(env.events,['replace']);
 assert.equal(env.history.state.modal,'overlay');
});
test('guide dismissal never replaces an already-current Settings history entry',()=>{
 const env=makeContext({modal:'overlay',successor:'overlay'});env.context.consumeSurfaceHistory('onboardingBackdrop');env.run();
 assert.deepEqual(env.events,[]);assert.equal(env.history.state.modal,'overlay');
});
test('other modal back-navigation keeps its established behavior',()=>{
 const env=makeContext({modal:'planEditorBackdrop'});env.context.consumeSurfaceHistory('planEditorBackdrop');env.run();
 assert.deepEqual(env.events,['back']);
});
test('the guide still open must never alter navigation history',()=>{
 const env=makeContext({guideIsOpen:true});env.context.consumeSurfaceHistory('onboardingBackdrop');env.run();
 assert.deepEqual(env.events,[]);
});
