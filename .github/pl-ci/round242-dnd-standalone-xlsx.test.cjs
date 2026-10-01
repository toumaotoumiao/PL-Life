'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('/* D&D standalone rule-data XLSX.'),end=html.indexOf('async function pcExportExcelCard(',start);
assert.ok(start>0&&end>start);
const src=html.slice(start,end);
const rows=new Function('pcRuleTemplateKey','pcRuleCurrentData','pcRuleDisplayLabel',src+'\nreturn pcDndRuleExportRows;')(
 p=>p.ruleMeta.confirmed&&['5e-2014','5e-2024'].includes(p.ruleMeta.editionId)?'dnd:'+p.ruleMeta.editionId:'',
 p=>p.sheet,(r,i)=>String(r.label||'').trim()||`未命名字段 ${i+1}`);
const pc=(edition='5e-2024')=>({name:'合成角色',ruleMeta:{systemId:'dnd',editionId:edition,confirmed:true},sheet:{traits:[{label:'力量',value:'15'}],skills:[{label:'察觉',value:'=3+2'}],resources:[{label:'背景',value:'',detail:''},{label:'等级',value:'4',detail:'\u25b3'}]}});
test('Round242 confirmed 2014/2024 export only active filled rule fields and retain text-like formula values',()=>{
 for(const edition of ['5e-2014','5e-2024']){const p=pc(edition),old=JSON.stringify(p),out=rows(p);assert.equal(out.edition,edition.slice(3));assert.equal(out.rows.length,9);assert.ok(out.rows.some(r=>r[0]==='豁免与技能'&&r[2]==='=3+2'));assert.ok(out.rows.some(r=>r[1]==='等级'&&r[2]==='4'&&r[3]==='△'));assert.ok(!out.rows.some(r=>r[1]==='背景'));assert.equal(JSON.stringify(p),old);}
});
test('Round242 rejects unconfirmed, incorrect edition, invalid XML and long text before export',()=>{
 const p=pc();p.ruleMeta.confirmed=false;assert.throws(()=>rows(p),/确认/);p.ruleMeta.confirmed=true;p.ruleMeta.editionId='';assert.throws(()=>rows(p),/确认/);p.ruleMeta.editionId='5e-2024';p.sheet.resources[1].value='a\u0000b';assert.throws(()=>rows(p),/无损/);p.sheet.resources[1].value='x'.repeat(32761);assert.throws(()=>rows(p),/超长/);
});
test('Round242 standalone XLSX remains internal while primary D&D export uses template fill',()=>{
 assert.match(html,/id:'dnd-template',label:'D&D 角色 Excel 卡'/);
 assert.doesNotMatch(html,/id:'dnd-manual',label:'导出 D&D 已填规则数据 XLSX'/);
 assert.match(src,/pcRuleCurrentData\(pc\)/);
 assert.doesNotMatch(src,/pcExcelPatchKaguraRows|pcWorkbookPut|pcDndStructurePreviewFile|pcDndAbilityCandidates/);
 assert.match(src,/pcExcelReadXlsx\(await blob.arrayBuffer\(\)\)/);
 assert.match(src,/t="inlineStr"/);
 assert.match(html,/if\(route.status==='ready'&&route.adapterId==='dnd-template'\)return pcExportDndCharacterCard\(pc\)/);
 assert.match(html,/if\(verifyButton\)verifyButton.hidden=true/);
});
test('Round245 rejects a filled rule row without its original field name instead of inventing export identity',()=>{
 const p=pc();p.sheet.resources.push({label:'',value:'fictional nonempty',detail:''});
 assert.throws(()=>rows(p),/缺少字段名/);
 assert.equal(p.sheet.resources.at(-1).label,'');
});
