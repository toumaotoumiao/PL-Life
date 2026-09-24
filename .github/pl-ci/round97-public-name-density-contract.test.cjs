'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'showcase-core.js'),'utf8');

function extractFunction(name){
  const start=html.indexOf(`function ${name}(`);assert(start>=0,`${name} missing`);
  let i=html.indexOf('{',start),depth=0;
  for(;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`${name} not closed`);
}

test('PL publicName is an optional persisted identity field and does not replace archive name',()=>{
  assert(html.includes('id="publicNameInput"'));
  assert.match(html,/公开名[\s\S]{0,180}仅用于公开展示图片/);
  assert.match(html,/function normalizeProfileWithSettings\([\s\S]*?publicName:/);
  assert.match(html,/function canonicalProfileFromRuntime\([\s\S]*?identity:[\s\S]*?publicName:/);
  assert.match(html,/function runtimeProfileFromCanonical\([\s\S]*?publicName: raw\?\.identity\?\.publicName/);
  assert.match(html,/function profileDirtySnapshot\([\s\S]*?publicName:/);
  const rawBlock=extractFunction('rawProfileName');
  assert(!rawBlock.includes('publicName'),'archive display/search identity must not silently replace raw PL name');
});

test('public-name helper has four presentation modes with safe fallback',()=>{
  const ctx={privacyMaskEnabled:false,isSelfProfile:()=>false,selfDisplayLabel:()=> 'SELF',rawProfileName:p=>p.name||'未命名 PL',displayProfileName:p=>p.name||'未命名 PL'};
  vm.createContext(ctx);
  vm.runInContext(extractFunction('publicProfileName')+'\n'+extractFunction('showcaseProfileName'),ctx);
  const p={name:'档案名',publicName:'公开名'};
  assert.equal(ctx.publicProfileName(p),'公开名');
  assert.equal(ctx.showcaseProfileName(p,'public',0,'PL'),'公开名');
  assert.equal(ctx.showcaseProfileName(p,'name',0,'PL'),'档案名');
  assert.equal(ctx.showcaseProfileName(p,'anonymous',1,'PL'),'PL 02');
  assert.equal(ctx.showcaseProfileName(p,'hidden',0,'PL'),'');
  assert.equal(ctx.publicProfileName({name:'只有档案名'}),'只有档案名');
  ctx.privacyMaskEnabled=true;
  assert.equal(ctx.showcaseProfileName(p,'public',0,'PL'),'PL 01');
});

test('all public people-oriented image exports expose public/name/anonymous/hidden choices',()=>{
  for(const id of ['statsExportNameMode','recordShowcaseNameMode','recordsRecapNameMode','entityModPersonMode'])assert(html.includes(`id="${id}"`),`${id} missing`);
  assert((html.match(/value="public"/g)||[]).length>=4,'public-name option should be available across export surfaces');
  assert.match(html,/function modulePersonName\([\s\S]*?showcaseProfileName/);
  assert.match(html,/function recordShowcaseName\([\s\S]*?showcaseProfileName/);
  assert.match(html,/function statsExportPersonLabel\([\s\S]*?showcaseProfileName/);
  assert(html.includes('publicProfileName(profile) · PL 参团')||html.includes('`${publicProfileName(profile)} · PL 参团`'));
});

test('density 2.0 exposes compact standard relaxed and shares a core density profile',()=>{
  assert.match(core,/function normalizeDensity\([\s\S]*?compact[\s\S]*?standard[\s\S]*?relaxed/);
  assert.match(core,/function densityProfile\([\s\S]*?pageHeight:3200[\s\S]*?pageHeight:2600/);
  for(const marker of ['data-stats-export-density="compact"','data-stats-export-density="standard"','data-stats-export-density="relaxed"','data-records-recap-density="relaxed"','data-entity-pc-density="relaxed"','data-entity-mod-density="relaxed"'])assert(html.includes(marker),`${marker} missing`);
  assert.match(html,/pageHeight=layout\.normalized\.density==="compact"\?3200:layout\.normalized\.density==="relaxed"\?2600:2800/);
});

test('schema 26 and query adapters carry publicName through current archive/search maintenance',()=>{
  assert.match(html,/const DATA_SCHEMA_VERSION = 26;/);
  assert.match(html,/schemaVersion\) >= 26[\s\S]*?identity\?\.publicName/);
  const adapters=fs.readFileSync(path.join(root,'field-adapters.js'),'utf8');
  const statsBridge=fs.readFileSync(path.join(root,'stats-query-bridge.js'),'utf8');
  const recordBridge=fs.readFileSync(path.join(root,'record-query-bridge.js'),'utf8');
  const pcBridge=fs.readFileSync(path.join(root,'pc-query-bridge.js'),'utf8');
  assert.match(adapters,/publicName:'text'/);
  assert.match(adapters,/directText=\[p\.name,display\(p\),p\.publicName/);
  assert.match(statsBridge,/r\.publicName/);
  assert.match(recordBridge,/p\?\.publicName/);
  assert.match(pcBridge,/row\?\.publicName/);
});

test('migration guard accepts schema 26 and still blocks future schema 27',()=>{
  const guardSource=fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8');
  const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(guardSource,ctx);
  assert.equal(ctx.PLDataMigrationGuard.MAX_SCHEMA,26);
  const base={format:'tomato-pl-archive',schemaVersion:26,data:{profiles:[],modules:[],pcs:[],runs:[]}};
  assert.equal(ctx.PLDataMigrationGuard.inspect(base).kind,'canonical');
  const future={...base,schemaVersion:27};
  assert.equal(ctx.PLDataMigrationGuard.inspect(future).kind,'future');
});


test('public-facing self export titles prefer the public name unless archive-name mode is chosen',()=>{
  assert.match(html,/openPlannerYearShowcasePreview\(\)[\s\S]*?publicProfileName\(profile\)/);
  assert.match(html,/buildWeeklyAvailabilityCanvas\(\)[\s\S]*?publicProfileName\(profile\)/);
  assert.match(html,/exportWeeklyAvailabilityImage\(\)[\s\S]*?publicProfileName\(profile\)/);
  assert.match(html,/exportStatsImage=async function\(\)[\s\S]*?nameMode===\"public\"\?publicProfileName\(profile\)/);
});
