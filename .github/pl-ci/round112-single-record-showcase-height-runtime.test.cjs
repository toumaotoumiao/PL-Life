'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function blockHeightSource(){
  const start=html.indexOf('function recordShowcaseBlockHeight(');
  const end=html.indexOf('\nfunction recordShowcaseLayout(',start);
  assert(start>=0&&end>start,'recordShowcaseBlockHeight source missing');
  return html.slice(start,end).trim();
}

test('single-record showcase height function never glues return to a numeric literal',()=>{
  const src=blockHeightSource();
  assert.doesNotMatch(src,/\breturn\d+/,'return must remain a keyword followed by a numeric expression, not an identifier like return218');
  for(const expected of ['return w<720?284:218;','return 92+Math.max(1,data.schedule.length)*34;','return 92+Math.max(1,data.cast.length)*52;','return 180;']){
    assert(src.includes(expected),`missing explicit numeric return: ${expected}`);
  }
});

test('single-record showcase height function executes every block branch without ReferenceError',()=>{
  const context={Math,recordShowcaseMeasureLines:()=>2};
  vm.createContext(context);
  vm.runInContext(`${blockHeightSource()}\nthis.fn=recordShowcaseBlockHeight;`,context);
  const fn=context.fn;
  assert.equal(fn('summary',500,{schedule:[],cast:[],logs:[],reflection:[]}),284);
  assert.equal(fn('summary',1012,{schedule:[],cast:[],logs:[],reflection:[]}),218);
  assert.equal(fn('schedule',500,{schedule:[1,2],cast:[],logs:[],reflection:[]}),160);
  assert.equal(fn('cast',500,{schedule:[],cast:[1,2,3],logs:[],reflection:[]}),248);
  assert.equal(fn('logs',500,{schedule:[],cast:[],logs:[{label:'L',url:'https://example.invalid'}],reflection:[]}),190);
  assert.equal(fn('reflection',500,{schedule:[],cast:[],logs:[],reflection:[['感想','A'],['备注','B']]}),230);
  assert.equal(fn('unknown',500,{schedule:[],cast:[],logs:[],reflection:[]}),180);
});

test('single-record layout still obtains every placement height from the guarded height function',()=>{
  const start=html.indexOf('function recordShowcaseLayout(');
  const end=html.indexOf('\nfunction drawRecordShowcasePanelBase(',start);
  assert(start>=0&&end>start,'recordShowcaseLayout source missing');
  const src=html.slice(start,end);
  assert.match(src,/item\.h=recordShowcaseBlockHeight\(item\.id,item\.w,data\)/);
  assert.match(src,/baseH:y\+30/);
});
