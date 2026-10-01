'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const a=html.indexOf('/* Stage80: read-only recheck'),b=html.indexOf('async function pcExportExcelCard(',a);
assert.ok(a>0&&b>a);
const src=html.slice(a,b);
const compare=new Function('pcDndRuleExportRows',src+'\nreturn pcDndCompareStandaloneRows;')(
  pc=>({edition:pc.edition,rows:[['D&D 5e 已填规则数据','','',''],['PC 名称',pc.name,'',''],['版次',pc.edition,'',''],['范围','内容','',''],['','','',''],['分类','字段','内容','说明'],...pc.rows]})
);
const pc={edition:'2024',name:'虚构人物',rows:[['属性','力量','14',''],['身份、战斗与装备','生命值','024','']]};
const sheets=(body=pc.rows)=>[{name:'DND规则数据',rows:[['D&D 5e 已填规则数据','','',''],['PC 名称','虚构人物','',''],['版次','2024','',''],['范围','内容','',''],['','','',''],['分类','字段','内容','说明'],...body.map(x=>[...x])]}];
test('Round247 own exported D&D data can be read back without changing the draft',()=>{
 const before=JSON.stringify(pc),x=compare(sheets(),pc);assert.deepEqual([x.exact,x.matching,x.changed,x.count],[true,2,0,2]);assert.equal(JSON.stringify(pc),before);
});
test('Round247 readback reports mismatches without accepting them as importable fields',()=>{
 let x=compare(sheets([['属性','力量','15',''],pc.rows[1]]),pc);assert.equal(x.exact,false);assert.equal(x.matching,1);assert.equal(x.changed,1);
 x=compare(sheets([...pc.rows,['豁免与技能','观察','+2','']]),pc);assert.equal(x.changed,1);
});
test('Round247 rejects foreign layout, version confusion and invalid field names',()=>{
 assert.throws(()=>compare([{name:'人物卡',rows:sheets()[0].rows}],pc),/本程序/);
 const old=sheets();old[0].rows[2][1]='2014';assert.throws(()=>compare(old,pc),/版次/);
 const invalid=sheets();invalid[0].rows[6][1]='';assert.throws(()=>compare(invalid,pc),/字段名称/);
 const wrong=sheets();wrong[0].rows[6].push('hidden');assert.throws(()=>compare(wrong,pc),/结构/);
 const meta=sheets();meta[0].rows[3][0]='Other';assert.throws(()=>compare(meta,pc),/本程序/);
});
test('Round247 explicit UI is limited to D&D, never persists or imports the compared workbook',()=>{
 assert.match(html,/id="pcFooterVerifyDndXlsxBtn"[^>]*hidden/);
 assert.match(html,/if\(verifyButton\)verifyButton\.hidden=true/);
 assert.match(src,/pcExcelUnzip\(raw\)/);assert.match(src,/pcExcelReadXlsx\(raw\)/);
 assert.doesNotMatch(src,/pcWorkbookPut\(|pcMediaPut\(|saveState\(|pcDraft\s*=\s*(?!target)/);
 assert.match(html,/pcFooterVerifyDndXlsxInput'\)\?\.addEventListener\('change'/);
});
