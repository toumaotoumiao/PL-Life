'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const begin=html.indexOf('function closeOnboardingTemporarily()');
const end=html.indexOf('/* 全局搜索 */',begin);
assert(begin>=0&&end>begin,'onboarding implementation not found');
const code=html.slice(begin,end);
function sandbox({initiallyOpen=false}={}){
 let modalOpen=initiallyOpen;
 const scheduled=[];
 const guide={hidden:true};
 let marker='';
 const storage={getItem(){return marker;},setItem(_k,v){marker=v;}};
 const context={
  document:{documentElement:{classList:{contains:()=>false}},getElementById:id=>id==='onboardingBackdrop'?guide:{focus(){}}},
  localStorage:storage,ONBOARDING_KEY:'onboarding-test',
  startupDataReport:{source:'fresh'},hasMeaningfulData:()=>false,
  maybeRecoverRedundantStartupData:async()=>false,
  anyModalSurfaceOpen:()=>modalOpen,
  syncModalPageScrollLock:()=>{},requestAnimationFrame:callback=>callback(),
  setTimeout:callback=>{scheduled.push(callback);return scheduled.length;}
 };
 vm.createContext(context);vm.runInContext(code,context,{timeout:1000});
 return {context,guide,storage,scheduled,setModalOpen:value=>{modalOpen=value;}};
}
test('late onboarding callback respects an editor opened during startup and does not set the onboarding-done flag',async()=>{
 const env=sandbox();
 await env.context.maybeShowOnboarding();
 assert.equal(env.scheduled.length,1);
 env.setModalOpen(true);
 env.scheduled[0]();
 assert.equal(env.guide.hidden,true,'welcome guide must not cover an opened dialog');
 assert.equal(env.storage.getItem(),'', 'skipping a guide cannot silently mark it as completed');
});
test('first visit still displays onboarding when the user has not opened a dialog',async()=>{
 const env=sandbox();
 await env.context.maybeShowOnboarding();
 env.scheduled[0]();
 assert.equal(env.guide.hidden,false);
});
test('closing a displayed guide does not affect the user data or completion marker',()=>{
 const env=sandbox();env.guide.hidden=false;
 env.context.closeOnboardingTemporarily();
 assert.equal(env.guide.hidden,true);
 assert.equal(env.storage.getItem(),'');
});
test('already-completed onboarding must not reappear from a previously queued timer',async()=>{
 const env=sandbox();
 await env.context.maybeShowOnboarding();
 assert.equal(env.scheduled.length,1);
 env.storage.setItem('onboarding-test','1');
 env.scheduled[0]();
 assert.equal(env.guide.hidden,true);
});
