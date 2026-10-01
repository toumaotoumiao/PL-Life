'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const profile=JSON.parse(fs.readFileSync(path.join(__dirname,'insane-source-profile.json'),'utf8'));
const start=html.indexOf('const TRPG_RULE_FAMILIES=Object.freeze([');
const end=html.indexOf('/* Read-only full-text aliases.',start);
const fnStart=html.indexOf('function defaultModuleRuleMeta(',end);
const fnEnd=html.indexOf('function moduleCocRecruitment(',fnStart);
assert.ok(start>=0&&end>start&&fnStart>end&&fnEnd>fnStart,'full source catalog and normalizer found');
const api=new Function(html.slice(start,end)+'\n'+html.slice(fnStart,fnEnd)+'\nreturn {TRPG_RULE_SYSTEM_MAP,normalizeModuleRuleMeta,moduleRuleDisplay,moduleRuleIdentity};')();
const insane=api.TRPG_RULE_SYSTEM_MAP.get('insane');
const old={familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true};
const mapped=(editionId)=>({...old,editionId});
test('Round200 Insane old and 2025 rulebook editions are explicit options without default reassignment',()=>{
 assert.deepEqual(insane.editions.map(({id,label})=>[id,label]),[['2013-original','旧版（2013）'],['2025-revised','新版（2025）']]);
 assert.equal(api.normalizeModuleRuleMeta(old).editionId,'');
 assert.equal(api.normalizeModuleRuleMeta(mapped('2013-original')).editionId,'2013-original');
 assert.equal(api.normalizeModuleRuleMeta(mapped('2025-revised')).editionId,'2025-revised');
 assert.equal(api.normalizeModuleRuleMeta(mapped('unverified')).editionId,'');
});
test('Round200 separate edition identities, current display and search catalog without altering old identity',()=>{
 const unchanged=api.moduleRuleIdentity({ruleMeta:old});
 assert.notEqual(unchanged,api.moduleRuleIdentity({ruleMeta:mapped('2013-original')}));
 assert.notEqual(unchanged,api.moduleRuleIdentity({ruleMeta:mapped('2025-revised')}));
 assert.notEqual(api.moduleRuleIdentity({ruleMeta:mapped('2013-original')}),api.moduleRuleIdentity({ruleMeta:mapped('2025-revised')}));
 assert.match(api.moduleRuleDisplay(mapped('2025-revised')),/新版（2025）/);
 assert.match(api.moduleRuleDisplay(mapped('2013-original')),/旧版（2013）/);
 assert.equal(api.moduleRuleDisplay(old),insane.label);
});
test('Round200 unimplemented rule does not falsely promise Excel after edition selection',()=>{
 assert.match(html,/sys\.editions\?\.length&&!m\.editionId&&Object\.keys\(PC_EXCEL_EXPORT_ADAPTERS\)\.some\(key=>key\.startsWith\(m\.systemId\+':'\)\)/);
 assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=Object\.freeze\(\{\s*'coc:7e'/);
});
test('Round200 CoC7/export rules and the existing Insane template are not displaced',()=>{
 const coc=api.TRPG_RULE_SYSTEM_MAP.get('coc');
 assert.deepEqual(coc.editions.map(x=>x.id),['7e','6e']);
 assert.match(html,/insane:\{title:'Insane',groups:\{traits:'核心资源',skills:'特技',resources:'能力(?:与道具)?'\},defaults:\{traits:\['生命力','正气度'\]/);
 assert.match(html,/function pcRuleIsCoc\(pc\).*?m\.systemId==='coc'&&m\.editionId==='7e'/);
});
test('Round200 research profile preserves original source identity but not copyrighted rule tables',()=>{
 assert.equal(profile.template,'insane');assert.equal(profile.editionInference,'manual-only');
 assert.equal(profile.inputSources.length,2);
 for(const s of profile.inputSources){assert.match(s.sha256,/^[0-9a-f]{64}$/);assert.ok(s.sizeBytes>0);}
 assert.equal(profile.inputSources[0].sheets.length,7);
 assert.equal(profile.inputSources[1].pages,2);
 assert.ok(profile.importPolicy.some(x=>x.includes('Do not auto-assign')));
 assert.ok(!fs.existsSync(path.join(root,'inSANe大判空白卡V2.0数据（自动卡）.xlsx')));
 assert.ok(!fs.existsSync(path.join(root,'【新ins】角色卡汉化.pdf')));
});
test('Round200 version and cache consistency plus both CI gates retain Round187',()=>{
 const current=html.match(/const APP_UI_VERSION = "(8\.1\.12\.\d+)"/)?.[1];
 assert.ok(current,'current UI version present');
 assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp('v'+current.replaceAll('.','\\.')));
 assert.match(html,/<strong class="version-log-version">v8\.1\.12\.233<\/strong>/,'Stage54 release history retained');
 for(const f of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml']){
  const wf=fs.readFileSync(path.join(root,'.github/workflows',f),'utf8');
  assert.match(wf,/round200-insane-edition-source-contract\.test\.cjs/);
  assert.match(wf,/round187-native-fullapp-restore/);
 }
});
