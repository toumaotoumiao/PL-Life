'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`${start} source not found`);return html.slice(a,b);};
const definitions=between('const TRPG_RULE_FAMILIES=','let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();')+'\n'+between('function defaultModuleRuleMeta(','function normalizeModuleRating(');
function runtime(extra={}){const ctx={...extra};vm.runInNewContext(definitions+'\nthis.api={moduleRuleDisplay,moduleRulesMatch,moduleRuleIdentity,moduleCocRecruitment,moduleRecruitmentBlocksForExport,moduleHistoryRuleLabel,sameRuleNamedModules,ruleSearchTerms,normalizeModuleRuleMeta};',ctx);return {ctx,...ctx.api};}
const coc=(e='7e')=>({familyId:'brp',systemId:'coc',editionId:e});
const brp={familyId:'brp',systemId:'brp-generic',editionId:''};
const insane={familyId:'saikoro-fiction',systemId:'insane',editionId:''};
const m=(id,ruleMeta)=>({id,name:'同名模组',ruleMeta,rules:'原规则备注',background:'简介',recommendedSkills:'侦查',recommendedOccupations:'调查员',cardRequirements:'创建人物',lostRate:'50%',recruitmentNotes:'备注'});
test('同名不同规则是不同档案，同规则的确认为一组；古风武侠只是题材',()=>{
 const {ctx,...api}=runtime();ctx.modules=[m('a',coc()),m('b',brp),m('c',coc()),m('d',insane)];ctx.modulesByNormalizedName=()=>ctx.modules;
 assert.equal(api.sameRuleNamedModules(ctx.modules[0]).length,2);
 assert.equal(api.sameRuleNamedModules(ctx.modules[1]).length,1);
 assert.equal(api.moduleRulesMatch(m('a',coc()),m('b',brp)),false);
 assert.equal(api.moduleRulesMatch(m('a',coc()),m('x',coc('6e'))),false);
 assert.equal(api.moduleRulesMatch(m('b',brp),m('d',insane)),false);
 assert(!html.includes("{id:'wuxia',label:'古风武侠'"));
});
test('模组招募和独立招募页不会带出非 CoC 的旧推荐职业与 Lost 数据，原档仍在',()=>{
 const a=m('a',coc()),b=m('b',brp),c=m('c',insane),rt=runtime();
 for(const x of [b,c])assert.deepEqual(Array.from(rt.moduleRecruitmentBlocksForExport(x),row=>row[0]),['模组简介','推荐技能','车卡要求','招募备注']);
 assert(Array.from(rt.moduleRecruitmentBlocksForExport(a),row=>row[0]).includes('推荐职业'));
 assert.equal(b.recommendedOccupations,'调查员');assert.equal(b.lostRate,'50%');
 const body=between('function nativeModuleRecruitmentText(m) {','function moduleRatingHasValue');
 vm.runInNewContext(body+'\nthis.copy=nativeModuleRecruitmentText;',rt.ctx);
 assert(rt.ctx.copy(a).includes('LOST 概率：50%'));
 for(const x of [b,c]){const text=rt.ctx.copy(x);assert(!text.includes('LOST 概率'));assert(!text.includes('推荐职业：调查员'));assert(text.includes('规则：'));}
});
test('历史桌缺规则或不同规则时必须单独提示，不因模组当前规则改写旧桌',()=>{
 const a=m('a',coc()),rt=runtime();
 assert.equal(rt.moduleHistoryRuleLabel(a,{ruleMeta:null}),'规则未记录');
 assert.equal(rt.moduleHistoryRuleLabel(a,{ruleMeta:brp}),rt.moduleRuleDisplay(brp));
 assert.equal(rt.moduleHistoryRuleLabel(a,{ruleMeta:coc()}),'');
 assert.match(html,/ruleLabel:moduleHistoryRuleLabel\(m,e\)/);
 assert.match(html,/r\.cast\|\|r\.ruleLabel/);
 assert.match(html,/\[r\.ruleLabel,r\.cast\]\.filter\(Boolean\)/);
});
test('所有合并与回收站真实提交路径在合并前先隔离规则',async()=>{
 const snippet=between('async function mergeModuleFieldsInto(','async function mergeDuplicateModules');
 const r=runtime();vm.runInNewContext(snippet+'\nthis.mergeModuleFieldsInto=mergeModuleFieldsInto;',r.ctx);
 await assert.rejects(()=>r.ctx.mergeModuleFieldsInto(m('a',coc()),m('b',insane),'main'),/规则不同/);
 assert.match(html,/const group=sameRuleNamedModules\(seed\)/);
 assert.match(html,/sources\.some\(m=>!moduleRulesMatch\(m,primary\)\)/);
 assert.match(html,/const linked=sourceIds\.has\(String\(run\.moduleId\)\)\|\|run\.moduleId===primary\.id;/);
 assert.match(html,/function prepareTrashRestore\(entry,choice\)[\s\S]*?const conflict=modules\.find\(x=>x\.id===m\.id&&moduleRulesMatch\(x,m\)\)/);
 assert.match(html,/function findModuleMergeTarget\(raw\)[\s\S]*?const same = modules\.filter\(m => normalizedEntityNameKey\(m\.name\) === titleKey&&moduleRulesMatch\(m,raw\)\)/);
});
test('模组和桌次通过高级工具桥接时规则身份保留；模组选择可按别名检索',()=>{
 assert.match(html,/function moduleToLegacyBridge\(m\)[\s\S]*?ruleMeta: clone\(m\.ruleMeta\), rules:/);
 assert.match(html,/function centralRunToModuleRun\(r\)[\s\S]*?_central: \{[\s\S]*?ruleMeta: clone\(r\.ruleMeta\), sessionSlots:/);
 assert.match(html,/if\(!existing\)base\.ruleMeta=run\?\._central\?\.ruleMeta\?normalizeRunRuleSnapshot/);
 assert.match(html,/function planModulePickerMatches\(query\)[\s\S]*?ruleSearchTerms\(m\.ruleMeta\)/);
 const rt=runtime();assert(rt.ruleSearchTerms(coc()).includes('CoC7'));
 assert(rt.ruleSearchTerms(insane).some(x=>/Insane|インセイン/i.test(x)));
});
test('新建模组去重仅针对同规则，切换规则会立即更新提示；不同规则同名不建议合并',()=>{
 assert.match(html,/const dup = modulesByNormalizedName\(name, nativeModuleEditingId\)\.find\(m=>moduleRulesMatch\(m,nativeModuleDraft\)\)/);
 assert.match(html,/const sameName = modulesByNormalizedName[\s\S]*?rows=sameName\.filter\(m=>moduleRulesMatch\(m,nativeModuleDraft\)\)/);
 assert.match(html,/input\.dataset\.antiError = rows\.length/);
 assert.match(html,/function applyNativeModuleRulePatch\(patch\)[\s\S]*?updateModuleAntiMistakeHint\(\)/);
 assert.match(html,/const dup = sameRuleNamedModules\(m\)\.length > 1/);
 assert.match(html,/只合并同规则的重复档案/);
});
test('导入预估与正式合并均区分规则；异规则同编号只允许两份都保留并重新分配编号',()=>{
 assert.match(html,/const moduleNameCollisions = incoming\.modules\.filter\(m =>[\s\S]*?moduleRulesMatch\(current,m\)/);
 assert.match(html,/const nameIdx = result\.modules\.findIndex\(m => normalizedEntityNameKey\(m\.name\) === normalizedEntityNameKey\(im\.name\)&&moduleRulesMatch\(m,im\)\)/);
 assert.match(html,/if\(!moduleRulesMatch\(result\.modules\[idx\],im\)\)/);
 assert.match(html,/if\(policy!=="both"\)throw new Error/);
 assert.match(html,/const originalId=im\.id; im\.id=uid\(\)/);
 assert.match(html,/modules\.some\(current=>normalizedEntityNameKey\(current\.name\)===normalizedEntityNameKey\(m\.name\)&&moduleRulesMatch\(current,m\)\)/);
 assert.match(html,/modulesByLooseName\(nativeModuleDraft\.name,[^\n]*\.filter\(m=>moduleRulesMatch\(m,nativeModuleDraft\)\)/);
});
test('导入合并实际运行：同名不同规则均保留，同编号冲突拒绝覆盖并正确重映射桌次',()=>{
 const api=runtime(),ctx=api.ctx;
 let nextId=10;
 Object.assign(ctx,{
  profiles:[],pcs:[],runPlans:[],runRecords:[],modules:[m('legacy',coc())],settings:{moduleArchive:{}},
  clone:x=>JSON.parse(JSON.stringify(x)),uid:()=>`generated-${nextId++}`,
  normalizedEntityNameKey:x=>String(x||'').trim().toLowerCase(),
  rawProfileName:p=>p.name||'',isSelfProfile:()=>false,
  normalizeRichModule:x=>x,normalizeProfile:x=>x,normalizePcArchive:x=>x,
  normalizeRunPlan:x=>x,normalizeRunRecord:x=>x,ensureSelfProfileAndLinks:x=>x
 });
 vm.runInNewContext(between('function importConflictInfo(incoming) {','function openImportPreview(incoming, label = "备份")')+'\n'+between('function mergeIncomingState(incoming, policy = "current", useIncomingSettings = false) {','async function assertIncomingJsonAttachmentsAvailable(incoming)')+'\nthis.actualMerge=mergeIncomingState;',ctx);
 const archive=items=>({settings:{moduleArchive:{}},profiles:[],pcs:[],modules:items,runPlans:[],runRecords:[]});
 const withOther=ctx.actualMerge(archive([m('new',brp)]),'current');
 assert.equal(withOther.modules.length,2);assert.equal(withOther.modules[0].id,'legacy');assert.equal(withOther.modules[1].id,'new');
 assert.equal(ctx.actualMerge(archive([m('new',brp)]),'both').modules.length,2);
 const collision=archive([m('legacy',brp)]);
 collision.runRecords=[{id:'run-1',moduleId:'legacy',plIds:[],participantAssignments:[],ruleMeta:brp}];
 assert.throws(()=>ctx.actualMerge(collision,'incoming'),/编号.*其他规则/);
 const retained=ctx.actualMerge(collision,'both');
 assert.equal(retained.modules.length,2);assert.equal(retained.modules[0].id,'legacy');
 assert.notEqual(retained.modules[1].id,'legacy');
 assert.equal(retained.runRecords[0].moduleId,retained.modules[1].id);
 assert.equal(retained.runRecords[0].ruleMeta.systemId,'brp-generic');
});
test('完整档案、卡片、长图与招募页共用规则字段排除口径',()=>{
 assert.match(html,/function moduleProfileCanvas\(m,state\)[\s\S]*?moduleCocRecruitment\(m\.ruleMeta\)\?\[\['Lost 率',m\.lostRate\]\]/);
 assert.match(html,/function moduleCompleteBlocks\(m,state,continuous=false\)[\s\S]*?const textBlocks=moduleRecruitmentBlocksForExport\(m\)/);
 assert.match(html,/function moduleRecruitBlocks\(m\)[\s\S]*?const source=moduleRecruitmentBlocksForExport\(m\)/);
 assert.match(html,/if\(id==='recruit'&&moduleRecruitmentBlocksForExport\(m\)\.length\)/);
 const version=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1]; assert.ok(version,'current program version missing');
 assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE_NAME=`\$\{CACHE_PREFIX\}v([\d.]+)`;/)[1],version);
});
