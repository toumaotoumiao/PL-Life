'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const createPc=require('../../pc-query-bridge.js').create;
const createModule=require('../../module-query-bridge.js').createArchive;
function meta(familyId,systemId,editionId=''){return {familyId,systemId,editionId,confirmed:true};}
function fixture(){return {profiles:[],pcs:[{id:'pc-old',name:'旧卡'},{id:'pc-coc',name:'第六版',ruleMeta:meta('brp','coc','6e')},{id:'pc-brp',name:'BRP',ruleMeta:meta('brp','brp-generic')},{id:'pc-insane',name:'Insane',ruleMeta:meta('saikoro-fiction','insane')}],modules:[{id:'m-old',name:'旧模组'},{id:'m-brp',name:'自制BRP',ruleMeta:meta('brp','brp-generic')},{id:'m-insane',name:'Insane',ruleMeta:meta('saikoro-fiction','insane')}],plans:[],records:[]};}
const env={now:'2026-09-26T20:00',selfId:'',settings:{}};
const sort=x=>Array.from(x).sort();
test('first-stage taxonomy initializes before restoring legacy module archives',()=>{
 assert.ok(html.indexOf('const TRPG_RULE_FAMILY_MAP=')<html.indexOf('let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();'));
 assert.ok(html.includes("source:'legacy-unmatched'"));
 assert.ok(html.includes("ruleMeta: raw?.ruleMeta ? normalizeModuleRuleMeta"));
});
test('PC and module use identical source taxonomy and shared family/system/version filters',()=>{
 for(const p of ['pc','module'])for(const suffix of ['Family','System','Edition'])assert.match(html,new RegExp(`id="${p}Rule${suffix}Filter"`));
 assert.match(html,/function populateRuleFilterGroup\(prefix/);
 assert.match(html,/function setupRuleFilters\(\)/);
 assert.match(html,/id="pcRuleMenu"/);
 assert.match(html,/nativeModuleRulePopoverHTML\(pcDraft\.ruleMeta\)/);
 assert.doesNotMatch(html,/id:'(?:wuxia|gufeng)'|label:'(?:古风武侠|古風武俠)'/);
});
test('read-only bridges filter exact rules and editions, and preserve old CoC7 fallback',()=>{
 const data=fixture(),pc=createPc(),module=createModule();
 const pq=legacy=>sort(pc.query({...env,data,legacy}).ids),mq=legacy=>sort(module.query({...env,data,legacy}).ids);
 assert.deepEqual(pq({ruleFamily:'brp'}),['pc-brp','pc-coc','pc-old']);
 assert.deepEqual(pq({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'7e'}),['pc-old']);
 assert.deepEqual(pq({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'6e'}),['pc-coc']);
 assert.deepEqual(pq({ruleFamily:'saikoro-fiction',ruleSystem:'insane'}),['pc-insane']);
 assert.deepEqual(mq({ruleFamily:'brp'}),['m-brp','m-old']);
 assert.deepEqual(mq({ruleFamily:'brp',ruleSystem:'coc',ruleEdition:'7e'}),['m-old']);
 assert.deepEqual(mq({ruleFamily:'saikoro-fiction',ruleSystem:'insane'}),['m-insane']);
 assert.deepEqual(pq({}),['pc-brp','pc-coc','pc-insane','pc-old']);
});
test('generic PC data saves independently and old CoC7 data stays intact in normalization',()=>{
 assert.match(html,/ruleData: normalizePcRuleData\(raw\?\.ruleData\)/);
 assert.match(html,/coc:normalizePcCoc\(raw&&raw\.coc\)/);
 assert.match(html,/excelEdits:migratedTime\.excelEdits/);
 assert.match(html,/function pcGenericArchiveBlocks\(pc,state/);
 assert.match(html,/if\(!pcRuleIsCoc\(pc\)\)return pcGenericArchiveBlocks/);
 assert.match(html,/if\(!pcRuleIsCoc\(pc\)\)return pcFullArchiveImageCanvases/);
 assert.match(html,/if\(!pcRuleIsCoc\(pcDraft\)\)\{appNotice\('PC 档案 → Excel 导入/);
 assert.match(html,/route\.status!=='ready'\|\|route\.adapterId!=='coc7'/); // CoC7 export is guarded by the current confirmed rule/edition route
 assert.match(html,/if\(!pcRuleIsCoc\(pc\)\)return html;let rows=/);
 assert.match(html,/pcRuleIsCoc\(pc\)\?pcArchiveSection\("CoC7 核心数值"/);
 assert.match(html,/if\(!pcRuleIsCoc\(pc\)\)\{/);
});
test('mobile and desktop filtering, rollback and release metadata stay synchronized',()=>{
 assert.match(html,/pcDraftSelect\("pcRuleFamilyFilter"/);
 assert.match(html,/mobileProxySelect\("moduleRuleFamilyFilter"/);
 assert.match(html,/moduleRuleFamilyFilter','规则大类/);
 assert.match(html,/pcRuleFamilyFilter','规则大类/);
 const version=html.match(/const APP_UI_VERSION = "([^"]+)";/)?.[1];
 assert.equal(version,sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1]);
 assert.ok(/^8\.1\.12\.\d+$/.test(version));
 assert.equal((html.match(/version-log-version">v([^<]+)/)||[])[1],version);
 assert.match(html,/version-log-version">v8\.1\.12\.210/);
});
