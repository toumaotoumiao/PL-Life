'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),adapter=fs.readFileSync(path.join(root,'field-adapters.js'),'utf8');
const a=html.indexOf('/* Stage67: D&D 5e LOCAL numeric candidates, distinct from player-entered facts.'),b=html.indexOf('async function pcDndStructurePreviewFile(',a);
assert.ok(a>0&&b>a,'D&D source-only parser found');
const cell=(sheet,ref)=>{const m=/^([A-Z]+)(\d+)$/.exec(ref);let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;return sheet?.rows?.[Number(m[2])-1]?.[col-1]??'';};
const dnd=new Function('pcInsaneSheetCell',html.slice(a,b)+'\nreturn {parse:pcDndStructurePreviewFromSheets,render:pcDndStructurePreviewHTML,profiles:PC_DND_STRUCTURE_LAYOUTS};')(cell);
const keys=['力量','敏捷','体质','智力','感知','魅力'];
function workbook(count){const rows=Array.from({length:30},()=>[]),refs=count===21?dnd.profiles['layout-21'].refs:dnd.profiles['layout-8'].refs;for(let i=0;i<keys.length;i++){const m=/(\d+)$/.exec(refs[i]);rows[+m[1]-1][2]=keys[i];}
 rows[2][1]='SYNTHETIC_PRIVATE_CHARACTER_VALUE';rows[3][3]='SYNTHETIC_PRIVATE_NOTE';Object.defineProperty(rows,'formulaRefs',{value:new Set(['D3',...dnd.profiles[count===21?'layout-21':'layout-8'].companionFormulas])});return Array.from({length:count},(_,i)=>({name:i===1?'SYNTHETIC_PRIVATE_SHEET_NAME':'worksheet'+i,rows:i===1?rows:[]}));}
test('Round217 two distinct 21/8-sheet layouts only verify six known static anchors',()=>{
 for(const count of [21,8]){const r=dnd.parse(workbook(count));assert.equal(r.layoutId,count===21?'layout-21':'layout-8');assert.equal(r.sheetCount,count);assert.deepEqual(r.fields.map(x=>x.label),keys);assert.ok(r.fields.every(x=>x.status==='label-match'));assert.equal(r.valuesExposed,false);assert.equal(r.editionInferred,false);assert.equal(r.readOnly,true);}
});
test('Round217 no private sheet name, note, synthetic character value or Excel raw cell enters results',()=>{
 for(const count of [21,8]){const r=dnd.parse(workbook(count)),v=JSON.stringify(r)+dnd.render(r);for(const secret of ['SYNTHETIC_PRIVATE_CHARACTER_VALUE','SYNTHETIC_PRIVATE_NOTE','SYNTHETIC_PRIVATE_SHEET_NAME'])assert.equal(v.includes(secret),false);assert.doesNotMatch(v,/[<]script/i);}
});
test('Round217 mismatched layout, reordered anchor and formula-derived anchor reject before any input reads',()=>{
 assert.throws(()=>dnd.parse(workbook(7)),/不属于已核对/);
 let wb=workbook(8);wb[1].rows[7][2]='任意字段';assert.throws(()=>dnd.parse(wb),/标签/);
 wb=workbook(21);wb[1].rows.formulaRefs.add('C12');assert.throws(()=>dnd.parse(wb),/标签/);
});
test('Round217 PC template keeps D&D 2014, 2024 and edition-not-recorded separate',()=>{
 const start=html.indexOf('const PC_RULE_SHEET_TEMPLATES=Object.freeze({'),end=html.indexOf('/* Stage31:',start);
 const api=new Function(html.slice(start,end)+'\nreturn {templates:PC_RULE_SHEET_TEMPLATES,key:pcRuleTemplateKey};')();
 assert.equal(api.key({ruleMeta:{systemId:'dnd',editionId:'5e-2014'}}),'dnd:5e-2014');
 assert.equal(api.key({ruleMeta:{systemId:'dnd',editionId:'5e-2024'}}),'dnd:5e-2024');
 assert.equal(api.key({ruleMeta:{systemId:'dnd',editionId:''}}),'');
 assert.deepEqual(api.templates['dnd:5e-2014'].defaults.traits,keys);
 assert.deepEqual(api.templates['dnd:5e-2024'].defaults.traits,keys);
 assert.equal(api.key({ruleMeta:{systemId:'insane',editionId:'2013-original'}}),'insane');
 assert.equal(api.key({ruleMeta:{systemId:'coc',editionId:'7e'}}),'');
});
test('Round217 old edition-scoped generic D&D entries stay visible, copy-on-edit, and separate from other edition',()=>{
 const start=html.indexOf('const PC_RULE_SHEET_TEMPLATES=Object.freeze({'),end=html.indexOf('/* Stage31:',start);
 const a=html.indexOf('function pcRuleCurrentData(pc){'),b=html.indexOf('/* Reorder only the active rule sheet.',a);
 const c=html.indexOf('function pcRuleEditableData(pc){'),d=html.indexOf('/* Stage24 reconstructed UI-only state',c);
 const scope="const PC_GENERIC_RULE_SCOPE_MARK='__genericScopedV1';function pcRuleGenericKey(p){const m=p.ruleMeta||{};return 'generic:v1:'+JSON.stringify([String(m.familyId||''),String(m.systemId||''),String(m.editionId||''),String(m.customName||''),String(m.customEdition||'')]);}function normalizePcRuleData(x){return JSON.parse(JSON.stringify(x||{traits:[],skills:[],resources:[]}));}";
 const api=new Function(html.slice(start,end)+scope+html.slice(a,b)+html.slice(c,d)+'\nreturn {key:pcRuleGenericKey,current:pcRuleCurrentData,edit:pcRuleEditableData};')();
 const p={ruleMeta:{familyId:'d20-osr',systemId:'dnd',editionId:'5e-2014'},ruleSheets:{}};let heritageKey=api.key(p);p.ruleSheets[heritageKey]={traits:[{label:'历史自定义条目',value:'SYNTHETIC_OLD_VALUE',extension:{retain:true}}],skills:[],resources:[]};
 assert.equal(api.current(p).traits[0].value,'SYNTHETIC_OLD_VALUE');api.edit(p).traits[0].value='NEW';assert.equal(p.ruleSheets[heritageKey].traits[0].value,'SYNTHETIC_OLD_VALUE');assert.equal(p.ruleSheets['dnd:5e-2014'].traits[0].extension.retain,true);
 p.ruleMeta.editionId='5e-2024';assert.notEqual(api.current(p).traits[0].value,'NEW');api.edit(p).traits[0].value='2024 VALUE';p.ruleMeta.editionId='5e-2014';assert.equal(api.current(p).traits[0].value,'NEW');
});
test('Round217 field adapter indexes only current D&D version and has exact historical scope fallback',()=>{
 assert.match(adapter,/const isDnd=pc\.ruleMeta\?\.systemId==='dnd'/);
 assert.match(adapter,/const dndTemplateKey=\['5e-2014','5e-2024'\]/);
 assert.match(adapter,/pc\.ruleSheets\?\.\[dndTemplateKey\]\|\|pc\.ruleSheets\?\.\[legacyDndKey\]/);
 assert.doesNotMatch(adapter,/pc\.ruleSheets\?\.\['dnd:5e-2014'\].*pc\.ruleSheets\?\.\['dnd:5e-2024'\]/);
});
test('Round217 pre-scope D&D ruleData is visible then frozen only into the original edition',()=>{
 const start=html.indexOf('const PC_RULE_SHEET_TEMPLATES=Object.freeze({'),end=html.indexOf('/* Stage31:',start);
 const a=html.indexOf('const PC_GENERIC_RULE_SCOPE_MARK=',end),b=html.indexOf('function pcRuleRetargetCustomScope(',a);
 const c=html.indexOf('function pcRuleCurrentData(pc){'),d=html.indexOf('/* Reorder only the active rule sheet.',c);
 const normalize=x=>JSON.parse(JSON.stringify(x||{traits:[],skills:[],resources:[]}));
 const fn=new Function('clone','normalizePcRuleData',html.slice(start,end)+html.slice(a,b)+html.slice(c,d)+'return {freeze:pcRuleFreezeBeforeSwitch,current:pcRuleCurrentData};');
 const api=fn(structuredClone,normalize);
 const p={ruleMeta:{familyId:'d20-osr',systemId:'dnd',editionId:'5e-2014'},ruleData:{traits:[{label:'LEGACY_SYNTHETIC',value:'KEEP'}],skills:[],resources:[]},ruleSheets:{}};
 assert.equal(api.current(p).traits[0].value,'KEEP');api.freeze(p);assert.equal(p.ruleSheets['dnd:5e-2014'].traits[0].value,'KEEP');
 p.ruleMeta.editionId='5e-2024';assert.notEqual(api.current(p).traits[0].value,'KEEP');p.ruleMeta.editionId='5e-2014';assert.equal(api.current(p).traits[0].value,'KEEP');
 assert.equal(p.ruleData.traits[0].value,'KEEP');
});
test('Round217 executable search adapter only indexes current edition',()=>{
 const start=adapter.indexOf("    const special=['brp-generic'");
 const end=adapter.indexOf('    const legacyCoc=',start);
 assert.ok(start>0&&end>start);
 const project=new Function('pc',"const t=x=>String(x??'').trim();"+adapter.slice(start,end)+'return selectedSheet;');
 const p={ruleMeta:{familyId:'d20-osr',systemId:'dnd',editionId:'5e-2014',customName:'',customEdition:''},ruleSheets:{'dnd:5e-2014':{skills:[{label:'SYNTHETIC_2014'}]},'dnd:5e-2024':{skills:[{label:'SYNTHETIC_2024'}]}}};
 assert.equal(project(p).skills[0].label,'SYNTHETIC_2014');p.ruleMeta.editionId='5e-2024';assert.equal(project(p).skills[0].label,'SYNTHETIC_2024');
 p.ruleMeta.editionId='';p.ruleSheets['generic:v1:'+JSON.stringify(['d20-osr','dnd','','',''])]={skills:[{label:'SYNTHETIC_UNRECORDED'}]};assert.equal(project(p).skills[0].label,'SYNTHETIC_UNRECORDED');
});
test('Round217 preview is wired to actual local XLSX reader with no import/save or file name in UI',()=>{
 assert.match(html,/data-pc-dnd-preview-open/);assert.match(html,/id="pcDndStructureInput"/);
 assert.match(html,/pcExcelReadXlsx\(await file\.arrayBuffer\(\)\)/);assert.match(html,/pcDndStructurePreviewFromSheets\(sheets\)/);
 assert.match(html,/function pcDndStructurePreviewClose\(\)/);
 assert.doesNotMatch(html.slice(a,html.indexOf('/* Stage55: Insane',a)),/saveState\(|pcWorkbookPut\(|ruleSheets\s*=|file\.name\}\s*·/);
 assert.match(html,/当前草稿和正式档案没有修改/);
});
test('Round217 long-running Round164/181 browser steps have bounded timeout and failure reporting',()=>{
 const ci=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 for(const run of ['round164-unified-final-inspection-browser.py','round181-full-evidence-browser.py'])assert.ok(ci.includes('PYTHONUNBUFFERED=1 timeout --signal=KILL 90s python .github/pl-ci/'+run));
 assert.match(ci,/set -o pipefail/);assert.match(ci,/Round181:\$\{\{ steps\.round181_browser\.outcome \}\}/);
});
test('Round217 static website and both CI entries are versioned without private workbook copies',()=>{
 const version=html.match(/const APP_UI_VERSION = "([^"]+)"/)?.[1];assert.match(version,/^8\.1\.12\.\d+$/);assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes(version));
 for(const f of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml'])assert.match(fs.readFileSync(path.join(root,'.github/workflows',f),'utf8'),/round217-dnd5-private-structure\.test\.cjs/);
 assert.ok(!fs.readdirSync(root).some(x=>/\.xlsx$|\.pdf$/i.test(x)));
});
