'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');

test('module toolbar menu actions all reach one document-delegated handler',()=>{
  const menu=html.match(/<details class="module-toolbar-more" id="moduleToolbarMore">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(menu,'toolbar menu is missing');
  const entries=[...menu.matchAll(/data-module-tool="([a-z-]+)"/g)].map(m=>m[1]);
  assert.deepEqual(entries,['image-export','excel-import','excel-export','portable','rating','batch','backup']);
  const handlerStart=html.indexOf('async function handleModuleToolAction(action) {');
  const handlerEnd=html.indexOf('els.profilesViewBtn.addEventListener(',handlerStart);
  assert.ok(handlerStart>0&&handlerEnd>handlerStart);
  const handler=html.slice(handlerStart,handlerEnd);
  assert.match(handler,/document\.addEventListener\("click", e => \{\s*const tool = e\.target\.closest\("\[data-module-tool\]"\)/);
  assert.match(handler,/void handleModuleToolAction\(tool\.dataset\.moduleTool\)/);
  assert.doesNotMatch(html,/moduleToolbarMore\?\.addEventListener\("click",\s*e\s*=>\s*e\.stopPropagation\(\)\)/,'the old propagation trap disables every entry');
  for(const action of entries)assert.ok(handler.includes(`action === "${action}"`),`missing ${action} implementation`);
});

test('click-outside close guard keeps toolbar click events bubbling and closes external clicks',()=>{
  assert.match(html,/if \(els\.moduleToolbarMore && !e\.target\.closest\("#moduleToolbarMore"\)\) els\.moduleToolbarMore\.open = false/);
  assert.match(html,/if \(els\.moduleToolbarMore\) els\.moduleToolbarMore\.open = false/);
  assert.match(html,/const selector='details\.hero-help,details\.module-toolbar-more/);
});

test('all seven dropdown actions are actually dispatched by a click event',()=>{
  const actions=[];const handlers=[];
  const start=html.indexOf('document.addEventListener("click", e => {\n    const tool = e.target.closest("[data-module-tool]");');
  const end=html.indexOf('});',start);
  assert.ok(start>0&&end>start);
  const source=html.slice(start,end+3);
  vm.runInNewContext(source,{
    document:{addEventListener:(type,fn)=>{assert.equal(type,'click');handlers.push(fn);}},
    handleModuleToolAction:action=>actions.push(action)
  });
  assert.equal(handlers.length,1);
  const all=['image-export','excel-import','excel-export','portable','rating','batch','backup'];
  for(const action of all){
    let prevented=false;
    handlers[0]({target:{closest:selector=>selector==='[data-module-tool]'?{dataset:{moduleTool:action}}:null},preventDefault:()=>{prevented=true;}});
    assert.equal(prevented,true,action+' must prevent its default');
  }
  assert.deepEqual(actions,all);
  handlers[0]({target:{closest:()=>null},preventDefault:()=>{throw Error('unexpected preventDefault on ordinary click');}});
  assert.deepEqual(actions,all,'outside click does not call a menu action');
});

test('module-card and record menus have their own handlers instead of relying on toolbar delegation',()=>{
  assert.match(html,/native-module-more-menu/);
  assert.match(html,/data-native-module-duplicate/);
  assert.match(html,/data-native-module-recruit/);
  assert.match(html,/data-mobile-module-tool/);
  assert.match(html,/data-mobile-record-module-more/);
});

test('GitHub Chromium workflow covers the actual toolbar interactions after the old static-only guard',()=>{
  const staticIndex=workflow.indexOf('name: Stage161 module toolbar event routing contract');
  const browserIndex=workflow.indexOf('name: Stage161 real Chromium module toolbar actions');
  assert(staticIndex>0&&browserIndex>staticIndex);
  assert.match(workflow,/node --test \.github\/pl-ci\/module-toolbar-actions\.test\.cjs/);
  assert.match(workflow,/node \.github\/pl-ci\/module-toolbar-actions-browser\.cjs/);
});
