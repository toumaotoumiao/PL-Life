'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const source=html.slice(html.indexOf('let modalHistorySlotIdle = false;'),html.indexOf('const modalSurfaceLifecycleObserved'));
function fixture(){
  const timers=[],events=[],open=new Set();
  const stack=[{tag:'app',view:'pcs'}];let index=0;
  const history={get state(){return stack[index]},pushState(state){stack.splice(index+1);stack.push(state);index++;events.push('push')},replaceState(state){stack[index]=state;events.push('replace')},back(){events.push('PROGRAMMATIC_BACK')}};
  const context={history,location:{href:'about:blank'},HISTORY_STATE_TAG:'app',currentView:'pcs',systemBackClosingSurfaceId:'',topOpenHistorySurfaceId:()=>[...open].at(-1)||'',historySurfaceIsOpen:id=>open.has(id),setTimeout:fn=>{timers.push(fn);return timers.length}};
  vm.createContext(context);
  vm.runInContext(source+'\nthis.open=pushSurfaceHistory;this.consume=consumeSurfaceHistory;this.idle=()=>modalHistorySlotIdle;this.setIdle=v=>{modalHistorySlotIdle=v}',context);
  return {context,history,stack,open,events,browserBack:()=>{if(index>0)index--;events.push('BROWSER_BACK')},tick:()=>{for(const fn of timers.splice(0))fn();}};
}
test('rapid close A and open B reuses guard without an asynchronous programmatic Back',()=>{
 const f=fixture();f.open.add('pcEditorBackdrop');f.context.open('pcEditorBackdrop');
 f.open.delete('pcEditorBackdrop');f.context.consume('pcEditorBackdrop');
 f.open.add('planEditorBackdrop');f.context.open('planEditorBackdrop');f.tick();
 assert.equal(f.history.state.modal,'planEditorBackdrop');assert.equal(f.stack.length,2);
 assert.equal(f.events.includes('PROGRAMMATIC_BACK'),false);
});
test('repeated ordinary closes reuse idle modal slot without growing browser history',()=>{
 const f=fixture();
 for(let i=0;i<8;i++){
  const id=i%2?'planEditorBackdrop':'pcEditorBackdrop';
  f.open.add(id);f.context.open(id);f.open.delete(id);f.context.consume(id);f.tick();
  assert.equal(f.history.state.modal,undefined);assert.equal(f.context.idle(),true);
 }
 assert.equal(f.stack.length,2);assert.equal(f.events.includes('PROGRAMMATIC_BACK'),false);
});
test('stale history marker does not call browser Back again, even without an open modal',()=>{
 const handler=html.slice(html.indexOf('if (targetModal && !historySurfaceIsOpen(targetModal) && !topId) {'),html.indexOf('if (closeTopSurfaceFromSystemBack())'));
 assert.match(handler,/history\.replaceState/);
 assert.doesNotMatch(handler,/\bhistory\.back\(/);
});
test('System Back still restores guard when dirty editor refuses to close',()=>{
 const closing=html.slice(html.indexOf('let systemBackClosingSurfaceId = "";'),html.indexOf('function initSystemBackNavigation()'));
 assert.match(closing,/const active = topOpenHistorySurfaceId\(\)/);
 assert.match(closing,/restorePoppedSurfaceGuard\(active\)/);
});
test('a delayed idle signal cannot replace the app base entry after a real Back',()=>{
 const f=fixture();f.open.add('pcEditorBackdrop');f.context.open('pcEditorBackdrop');
 f.open.delete('pcEditorBackdrop');f.context.consume('pcEditorBackdrop');f.tick();
 f.browserBack();f.context.setIdle(true);
 const base=f.history.state;
 f.open.add('planEditorBackdrop');f.context.open('planEditorBackdrop');
 assert.equal(f.stack[0],base);
 assert.equal(f.stack.length,2);
 assert.equal(f.events.at(-1),'push');
 f.browserBack();
 assert.equal(f.history.state.modal,undefined);
 assert.equal(f.history.state.view,'pcs');
});
test('a legacy modal-like state without the app guard marker is never replaced',()=>{
 const f=fixture();f.history.replaceState({tag:'app',view:'pcs',modal:'staleModal'});
 f.open.add('planEditorBackdrop');f.context.open('planEditorBackdrop');
 assert.equal(f.events.at(-1),'push');
 assert.equal(f.stack.length,2);
});
