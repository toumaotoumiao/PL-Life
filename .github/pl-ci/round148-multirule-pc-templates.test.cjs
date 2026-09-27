'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('function normalizePcRuleData('),b=html.indexOf('function normalizePcArchive(',a),c=html.indexOf('function pcGenericRuleEditorHTML('),d=html.indexOf('function pcProfileEditorHTML(',c);
assert.ok(a>0&&b>a&&c>0&&d>c);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const api=new Function('clone','moduleRuleDisplay','escapeHTML',`${html.slice(a,b)}\n${html.slice(c,d)}\nreturn {normalizePcRuleData,normalizePcRuleSheets,pcRuleTemplateKey,pcRuleCurrentData,pcRuleEditableData,pcGenericRuleEditorHTML,PC_RULE_SHEET_TEMPLATES};`)(structuredClone,m=>m.systemId||'规则',esc);
const pc=(systemId='coc',editionId='7e')=>({ruleMeta:{familyId:systemId==='coc'?'brp':'saikoro-fiction',systemId,editionId},ruleData:{traits:[],skills:[],resources:[]},ruleSheets:{},coc:{str:65,hp:12,san:63},excelEdits:[{sheet:'角色卡',ref:'A1',value:'旧数据'}],background:{description:'人物历史'}});
test('officially distinct BRP, Insane and Shinobigami templates contain only core archival fields',()=>{
 const keys=Object.keys(api.PC_RULE_SHEET_TEMPLATES).sort();
 assert.deepEqual(keys,['brp-generic','insane','shinobigami']);
 assert.deepEqual(api.PC_RULE_SHEET_TEMPLATES.insane.defaults.traits,['生命力','正气度']);
 assert.deepEqual(api.PC_RULE_SHEET_TEMPLATES.shinobigami.defaults.traits,['流派','阶级','生命力']);
 for(const template of Object.values(api.PC_RULE_SHEET_TEMPLATES)){
  const fields=JSON.stringify(template.defaults);
  assert.doesNotMatch(fields,/秘密|使命|狂气卡|HO\d|SAN/i);
 }
 assert.doesNotMatch(html,/id:'(?:wuxia|gufeng)'|label:'(?:古风武侠|古風武俠)'/);
});
test('switching sheets does not overwrite CoC values, Excel or other rule templates',()=>{
 const x=pc(), original=structuredClone({coc:x.coc,excelEdits:x.excelEdits});
 x.ruleMeta.systemId='brp-generic';let brp=api.pcRuleEditableData(x);
 assert.deepEqual(brp.traits.map(r=>r.label),['STR','CON','SIZ','INT','POW','DEX','APP']);brp.traits[0].value='55';
 x.ruleMeta.systemId='insane';let insane=api.pcRuleEditableData(x);
 assert.deepEqual(insane.traits.map(r=>r.label),['生命力','正气度']);insane.traits[0].value='6';
 x.ruleMeta.systemId='shinobigami';let shin=api.pcRuleEditableData(x);shin.resources.push({label:'忍法',value:'已记录'});
 x.ruleMeta.systemId='brp-generic';assert.equal(api.pcRuleCurrentData(x).traits[0].value,'55');
 x.ruleMeta.systemId='insane';assert.equal(api.pcRuleCurrentData(x).traits[0].value,'6');
 x.ruleMeta.systemId='shinobigami';assert.equal(api.pcRuleCurrentData(x).resources[0].value,'已记录');
 assert.deepEqual({coc:x.coc,excelEdits:x.excelEdits},original);
 x.ruleMeta.systemId='coc';assert.equal(api.pcRuleTemplateKey(x),'');
});
test('v213 generic data and future unknown templates remain untouched',()=>{
 const x=pc('insane','');x.ruleData.traits.push({label:'旧标签',value:'保留原值'});
 assert.deepEqual(api.pcRuleCurrentData(x).traits.map(r=>r.label),['生命力','正气度']);
 const old=structuredClone(x.ruleData);api.pcRuleEditableData(x).traits[0].value='5';
 assert.deepEqual(x.ruleData,old);
 assert.match(api.pcGenericRuleEditorHTML(x),/原有通用规则数据（仅在编辑器查看）/);
 const newer={traits:[{label:'未来字段',value:'未改写'}],skills:[],resources:[],extra:{future:25}};
 assert.deepEqual(api.normalizePcRuleSheets({'future-template':newer})['future-template'],newer);
});
test('normal PC archive round-trip preserves specialized sheets and extra future fields',()=>{
 const begin=html.indexOf('function normalizePcArchive('),end=html.indexOf('function pcValidateArchiveInput(',begin);
 const code=`${html.slice(a,b)}\n${html.slice(begin,end)}\nreturn normalizePcArchive;`;
 const scope=`const PC_STATUS_VALUES=['active','dead','archived'];const PC_BACKGROUND_KEYS=[];
 function uid(){return 'synthetic-id';}function normalizeModuleRuleMeta(v){return v;}function defaultModuleRuleMeta(){return {systemId:'coc',editionId:'7e'};}
 function pcPromoteLegacyCardTime(raw){return {cardTime:raw.cardTime||{},excelEdits:raw.excelEdits||[]};}
 function normalizePcCoc(v){return v||{};}function normalizePcSkills(v){return v||[];}function normalizePcWeapons(v){return v||[];}
 function normalizePcBackground(v){return v||{};}function normalizePcStoredSnapshots(v){return v||[];}`;
 const normalize=new Function('clone',scope+'\n'+code)(structuredClone);
 const src=pc('insane','');src.id='character-1';src.ruleSheets.insane={traits:[{label:'生命力',value:'6',futureMark:'keep'}],skills:[],resources:[],futureSection:{notes:'preserve'}};
 src.ruleSheets['future-version']={traits:[{label:'未认识字段',value:'原样'}],extra:{keep:1}};
 const restored=normalize(JSON.parse(JSON.stringify(src)));
 assert.equal(restored.ruleSheets.insane.traits[0].futureMark,'keep');
 assert.equal(restored.ruleSheets.insane.futureSection.notes,'preserve');
 assert.deepEqual(restored.ruleSheets['future-version'],src.ruleSheets['future-version']);
 assert.deepEqual(restored.coc,src.coc);assert.deepEqual(restored.excelEdits,src.excelEdits);
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(restored))).ruleSheets,restored.ruleSheets);
});
test('HTML escapes all user-written values and does not solicit private secrets',()=>{
 const x=pc('insane','');api.pcRuleEditableData(x).traits[0].value='<img src=x onerror=alert(1)>';
 const out=api.pcGenericRuleEditorHTML(x);
 assert.doesNotMatch(out,/<img src=x/);assert.match(out,/&lt;img src=x/);
 assert.match(out,/本页不收集秘密或使命等私有资料/);
 assert.doesNotMatch(out,/data-pc-generic-field="secret"/);
});
test('normalization, input handlers, export and search use current template, not inactive values',()=>{
 for(const needle of [
  'ruleSheets: normalizePcRuleSheets(raw?.ruleSheets)',
  'pcRuleEditableData(pcDraft)[key][index][genericField]=e.target.value',
  'pcRuleEditableData(pcDraft)[key].push({label:',
  'pcRuleEditableData(pcDraft)[key].splice(index,1)',
  'const genericData=pcRuleCurrentData(pc)',
  'const rd=pcRuleCurrentData(pc),tpl=PC_RULE_SHEET_TEMPLATES',
  "if(!pcRuleIsCoc(pc))return pcGenericArchiveBlocks(pc,state,innerWidth)",
  '...ruleSearchTerms(pc.ruleMeta)',
  "const selectedSheet=special?(pc.ruleSheets?.[pc.ruleMeta?.systemId]||{}):pc.ruleData"
 ])assert.ok((html+fs.readFileSync(path.join(root,'field-adapters.js'),'utf8')).includes(needle),needle);
 assert.match(html,/sheet=clone\(pcRuleCurrentData\(pcDraft\)\)/);
 assert.match(html,/本次没有复制任何字段/);
 assert.doesNotMatch(html,/id="(?:selfIntro|intro)(?:Played|WantRules|HostRules|FamiliarRules)/i);
});
