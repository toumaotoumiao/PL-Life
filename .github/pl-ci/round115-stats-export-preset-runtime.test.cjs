'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('const STATS_EXPORT_SCOPE_ORDER =');
const end=html.indexOf('function defaultStatsExportState()',start);
assert(start>=0&&end>start,'statistics export preset block missing');
const code=html.slice(start,end);
const ctx={normalizeStatsExportState:(state)=>state};
vm.createContext(ctx);
vm.runInContext(`${code}\nthis.api={STATS_EXPORT_SCOPE_ORDER,STATS_EXPORT_PRESETS,statsExportPresetSelection,statsExportPresetKey};`,ctx);
const api=ctx.api;
const plain=v=>JSON.parse(JSON.stringify(v));

test('statistics export preset helpers are actually defined before runtime use',()=>{
  assert.equal(typeof api.statsExportPresetSelection,'function');
  assert.equal(typeof api.statsExportPresetKey,'function');
  for(const key of ['story','data','all'])assert(html.includes(`data-stats-export-preset="${key}"`),`${key} preset button missing`);
});

test('statistics export presets select the intended stable sections',()=>{
  assert.deepEqual(plain(api.statsExportPresetSelection('story')),['overview','calendar','timeline','footprint','habits']);
  assert.deepEqual(plain(api.statsExportPresetSelection('data')),['overview','habits','people','modules']);
  assert.deepEqual(plain(api.statsExportPresetSelection('all')),plain(api.STATS_EXPORT_SCOPE_ORDER));
});

test('statistics export preset detection tolerates reordering but rejects custom selections',()=>{
  assert.equal(api.statsExportPresetKey({selected:['habits','overview','footprint','calendar','timeline']}),'story');
  assert.equal(api.statsExportPresetKey({selected:['modules','overview','people','habits']}),'data');
  assert.equal(api.statsExportPresetKey({selected:[...api.STATS_EXPORT_SCOPE_ORDER].reverse()}),'all');
  assert.equal(api.statsExportPresetKey({selected:['overview','calendar']}),'');
});

test('unknown preset keys fail safe to the annual-story combination',()=>{
  assert.deepEqual(plain(api.statsExportPresetSelection('unexpected')),plain(api.STATS_EXPORT_PRESETS.story));
});
