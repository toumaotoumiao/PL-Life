'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('const PC_RULE_SHEET_TEMPLATES=Object.freeze({');
const end=html.indexOf('/* Reorder only the active rule sheet.',start);
assert.ok(start>0&&end>start);
const api=new Function('clone','normalizePcRuleData',html.slice(start,end)+ '\nreturn {templates:PC_RULE_SHEET_TEMPLATES,key:pcRuleTemplateKey,current:pcRuleCurrentData,freeze:pcRuleFreezeBeforeSwitch};')(
 structuredClone, x=>structuredClone(x||{traits:[],skills:[],resources:[]}));
const fields=['背景','种族／物种','阵营','等级','熟练加值','先攻','生命值'];
const pc=edition=>({ruleMeta:{systemId:'dnd',familyId:'d20-osr',editionId:edition,confirmed:true},ruleSheets:{__genericScopedV1:true},ruleData:{traits:[],skills:[],resources:[]}});
test('Round238 new confirmed D&D 2014/2024 PCs expose seven independently editable manual fields',()=>{
 for(const edition of ['5e-2014','5e-2024']){
  const p=pc(edition),sheet=api.current(p);assert.deepEqual(sheet.resources.map(x=>x.label),fields);
  assert.ok(sheet.resources.every(x=>x.value===''));
  sheet.resources[3].value='4';
  assert.equal(api.current(p).resources[3].value,''); // read-only defaults, not saved by viewing
  assert.deepEqual(api.templates['dnd:'+edition].defaults.resources,fields);
 }
});
test('Round238 manually recorded values are isolated by edition, and no opposite edition is inferred',()=>{
 const p=pc('5e-2014');p.ruleSheets['dnd:5e-2014']={traits:[],skills:[],resources:[{label:'等级',value:'4',future:{keep:true}}]};
 assert.equal(api.current(p).resources[0].value,'4');
 p.ruleMeta.editionId='5e-2024';assert.deepEqual(api.current(p).resources.map(x=>x.value),Array(7).fill(''));
 p.ruleMeta.editionId='';assert.equal(api.key(p),'');
 p.ruleMeta.editionId='5e-2014';assert.equal(api.current(p).resources[0].future.keep,true);
});
test('Round238 existing D&D ruleSheets and historical generic values are not overwritten by defaults',()=>{
 const p=pc('5e-2014');p.ruleSheets['dnd:5e-2014']={traits:[],skills:[],resources:[],extension:{unknown:[0,false,'']}};
 assert.equal(api.current(p).resources.length,0);assert.equal(api.current(p).extension.unknown[1],false);
 delete p.ruleSheets['dnd:5e-2014'];p.ruleSheets["generic:v1:"+JSON.stringify(['d20-osr','dnd','5e-2014','',''])]={traits:[],skills:[],resources:[{label:'旧值',value:'保留'}]};
 assert.equal(api.current(p).resources[0].value,'保留');
});
test('Round238 manual defaults never become D&D source-cell mapping or automatic import',()=>{
 const x=html.slice(html.indexOf('/* Stage67: D&D 5e LOCAL numeric candidates'),html.indexOf('async function pcDndStructurePreviewFile('));
 assert.match(x,/inputCell:'unmapped'/);assert.match(x,/readOnly:true/);
 assert.doesNotMatch(x,/pcWorkbookPut\(/);
});
