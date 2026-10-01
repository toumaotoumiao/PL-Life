'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const extract=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start,`${a} segment missing`);return html.slice(start,end);};
const harness=`let pcWorkbookPending=null,pcDraft=null; async function pcWorkbookGet(){return null;} function pcRuleTemplateKey(pc){const id=String(pc?.ruleMeta?.systemId||'');if(id==='dnd'){const edition=String(pc?.ruleMeta?.editionId||'');return ['5e-2014','5e-2024'].includes(edition)?'dnd:'+edition:'';}return id;}`;
const code=[harness,extract('const TRPG_RULE_FAMILIES=Object.freeze(', 'let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();'),extract('function defaultModuleRuleMeta(', 'function normalizeModuleRating('),extract('function pcRuleIsCoc(', 'function pcGenericRuleEditorHTML(')].join('\n');
const ui={};for(const id of ['pcFooterExportExcelBtn','pcFooterExcelExportStatus'])ui[id]={hidden:true,disabled:false,textContent:'',dataset:{},title:''};
const api=new Function('document',code+'\nreturn {pcExcelExportAvailability,syncPcExcelExportUi,PC_EXCEL_EXPORT_ADAPTERS,pcRuleIsCoc};')({getElementById:id=>ui[id]||null});
const rule=(familyId,systemId,editionId='',confirmed=true,extra={})=>({ruleMeta:{familyId,systemId,editionId,confirmed,source:confirmed?'user-selected':'legacy-pc-default',...extra},name:'合成PC',id:'synthetic'});
test('only confirmed CoC7 and D&D template-filled character-card adapters are executable',()=>{
 assert.deepEqual(Object.keys(api.PC_EXCEL_EXPORT_ADAPTERS),['coc:7e','dnd:5e-2014','dnd:5e-2024']);
 for(const edition of ['5e-2014','5e-2024']){const x=api.pcExcelExportAvailability(rule('d20-osr','dnd',edition));assert.equal(x.status,'ready');assert.equal(x.adapterId,'dnd-template');assert.match(x.label,/角色 Excel 卡/);}
 assert.equal(api.pcExcelExportAvailability(rule('brp','coc','7e')).status,'ready');
 for(const pc of [rule('brp','coc','6e'),rule('brp','brp-generic'),rule('saikoro-fiction','insane'),rule('saikoro-fiction','shinobigami'),rule('custom','custom','',true,{customName:'私制TRPG'})]){
  const s=api.pcExcelExportAvailability(pc);assert.equal(s.status,'developing',JSON.stringify(pc));assert.match(s.label,/开发中/);assert.equal(s.adapterId,undefined);
 }
});
test('unconfirmed legacy default and incomplete rule/edition cannot masquerade as CoC7',()=>{
 assert.equal(api.pcExcelExportAvailability(rule('brp','coc','7e',false)).status,'unconfirmed');
 assert.equal(api.pcExcelExportAvailability({name:'旧角色'}).status,'unconfirmed');
 assert.equal(api.pcExcelExportAvailability(rule('brp','coc','')).status,'edition-required');
 assert.equal(api.pcExcelExportAvailability(rule('d20-osr','dnd','')).status,'edition-required');
 assert.equal(api.pcExcelExportAvailability(rule('d20-osr','dnd','5e-2024',false)).status,'unconfirmed');
 assert.equal(api.pcExcelExportAvailability(rule('brp','','')).status,'rule-required');
 assert.equal(api.pcExcelExportAvailability(rule('custom','custom','',true,{customName:''})).status,'rule-required');
});
test('export menu always explains current rule and keeps image export intact',async()=>{
 for(const [pc,expected] of [[rule('brp','coc','7e'),'ready'],[rule('brp','coc','6e'),'developing'],[rule('saikoro-fiction','insane'),'developing'],[rule('d20-osr','dnd','5e-2014'),'ready'],[rule('brp','coc','7e',false),'unconfirmed']]){
  const data=structuredClone(pc),state=api.syncPcExcelExportUi(pc),btn=ui.pcFooterExportExcelBtn,note=ui.pcFooterExcelExportStatus;
  assert.equal(state.status,expected);assert.equal(btn.disabled,expected!=='ready');assert.equal(btn.hidden,false);
  assert.equal(note.hidden,expected==='ready');assert.deepEqual(pc,data,'rendering never alters PC or Excel source');
  await Promise.resolve();
 }
 assert.match(html,/id="pcFooterExportImageBtn"/);assert.match(html,/id="pcFooterExcelExportStatus" role="status"/);
 assert.match(html,/data-pc-confirm-rule/);assert.match(html,/pcDraft\.ruleMeta=\{\.\.\.m,confirmed:true,source:'user-confirmed'\}/);
});
test('the executable export path rechecks the router, never downloads for other rules',()=>{
 const body=extract('async function pcExportExcelCard(', '/* ---------- PC CoC7 Excel 导入：');
 assert.match(body,/pcExcelExportAvailability\(pc\)/);assert.match(body,/route.adapterId==='dnd-template'/);assert.match(body,/route\.status!=='ready'\|\|route\.adapterId!=='coc7'/);
 assert.match(body,/pc=clone\(pc\)/);assert.match(body,/pcExcelValidateExport\(zip,files\)/);
 assert.match(html,/if\(pcExcelExportAvailability\(pcDraft\)\.status!=='ready'\)return/);
 assert.match(html,/syncPcExcelExportUi\(pcDraft\)/);
});
test('current release and CI connect new static and browser regression without altering storage schema',()=>{
 const v=html.match(/const APP_UI_VERSION = "([\d.]+)"/)[1];assert.match(v,/^8\.1\.12\.\d+$/);assert(sw.includes(`v${v}`));
 assert(fs.existsSync(path.join(root,'.github/pl-ci/round160-pc-excel-rule-router-browser.py')));
 const yml=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert(yml.includes('round160-pc-excel-rule-router.test.cjs'));assert(yml.includes('round160-pc-excel-rule-router-browser.py'));
 assert.match(html,/DATA_SCHEMA_VERSION\s*=\s*26/);
});
