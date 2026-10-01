'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('const PC_INSANE_PREVIEW_FIELDS=Object.freeze(['),end=html.indexOf('/* Stage55 pure parser end */',start);
assert.ok(start>=0&&end>start);
const supplement=new Function(html.slice(start,end)+'\nreturn pcInsaneSupplementPreviewFromSheets;')();
function mock(){const rows=Array.from({length:55},()=>[]),set=(ref,val)=>{let [,letters,r]=ref.match(/^([A-Z]+)(\d+)$/),c=0;for(const l of letters)c=c*26+l.charCodeAt(0)-64;rows[+r-1][c-1]=val;};
 for(const [ref,val] of [['G1','特技表'],['H16','技能名'],['A20','名字'],['A21','年龄'],['D21','性别'],['A26','职业'],['D22','生命力'],['D23','正气度'],['D24','功绩点'],['E22',6],['E23',5],['I2','示例特技甲'],['K2','示例特技乙'],['M2','示例特技丙'],['O2','示例特技丁'],['Q2','示例特技戊'],['S2','示例特技己'],['H17','基本攻击'],['H20','战场移动'],['B32','镇痛剂'],['E32',0],['B34','武器'],['E34',0],['B36','护身符'],['E36',0],['G39','团务记录'],['H39','模组名'],['K39','PC位'],['L39','结局'],['O39','功绩点'],['P39','备注']])set(ref,val);
 for(const c of ['I','K','M','O','Q','S'])for(let r=3;r<=12;r++)set(c+r,c+'模拟'+r);
 Object.defineProperty(rows,'formulaRefs',{value:new Set()});return {sheets:[{name:'角色表',rows}],set,rows};
}
test('Round203 only selected input cells become specialities, not the whole rule grid',()=>{
 const f=mock();f.set('B29','示例特技甲');f.set('C29','示例特技丁');const r=supplement(f.sheets);
 assert.equal(r.counts.specialties,2);assert.deepEqual(r.groups.specialties.map(x=>x.match?.ref),['I2','O2']);
 assert.ok(!r.groups.specialties.some(x=>x.value.includes('模拟')));
});
test('Round203 non-matching and duplicate skill names never invent a domain',()=>{
 const f=mock();f.set('B29','未列出的自创技能');f.set('C29','示例特技乙');f.set('M2','示例特技乙');const r=supplement(f.sheets);
 assert.equal(r.groups.specialties[0].state,'unresolved');assert.equal(r.groups.specialties[0].match,null);
 assert.equal(r.groups.specialties[1].state,'unresolved');assert.equal(r.groups.specialties[1].match,null);
});
test('Round203 ability formulas are skipped while prefilled abilities are not marked as player inputs',()=>{
 const f=mock();f.set('H18','缓存错误');f.rows.formulaRefs.add('H18');f.set('H21','自定义能力');
 const r=supplement(f.sheets);assert.equal(r.groups.abilities.find(x=>x.ref==='H18').state,'formula');
 assert.equal(r.groups.abilities.find(x=>x.ref==='H18').value,'');
 assert.equal(r.groups.abilities.find(x=>x.ref==='H17').state,'template-default');
 assert.equal(r.groups.abilities.find(x=>x.ref==='H21').value,'自定义能力');
});
test('Round203 explicit blank comparison covers abilities, items and deletion',()=>{
 const b=mock(),f=mock();f.set('H21','自定义能力');f.set('E32',2);
 const r=supplement(f.sheets,b.sheets);
 assert.equal(r.groups.abilities.find(x=>x.ref==='H21').state,'changed');
 assert.ok(!r.groups.abilities.some(x=>x.ref==='H22'));
 assert.equal(r.groups.items.find(x=>x.ref==='E32').state,'changed');
});
test('Round203 history private notes are flags only; no content surfaced in HTML',()=>{
 const f=mock();f.set('H40','合成模组');f.set('K40','2号位');f.set('P40','虚构秘密请勿公开');
 const r=supplement(f.sheets);assert.equal(r.counts.history,1);assert.equal(r.groups.history[0].notePresent,true);
 assert.ok(!JSON.stringify(r).includes('虚构秘密请勿公开'));
 const view=html.slice(html.indexOf('function pcInsaneSupplementPreviewHTML('),html.indexOf('/* Stage55 pure parser end */'));
 assert.match(view,/私人备注已填写（内容隐藏）/);
 assert.doesNotMatch(view,/\.note\.value|\.note\.baseline/);
});
test('Round203 source grid mismatch and item-label mismatch reject comparison',()=>{
 const b=mock(),f=mock();b.set('I2','另一张规则词表');assert.throws(()=>supplement(f.sheets,b.sheets),/特技词表不一致/);
 const b2=mock();b2.set('B32','不同道具');assert.throws(()=>supplement(f.sheets,b2.sheets),/道具标签不同/);
});
test('Round203 UI adds only opt-in read-only supplement; workbook and policy boundaries remain',()=>{
 assert.match(html,/pcInsaneSupplementPreviewHTML\(pcInsaneSupplementPreviewFromSheets\(sheets\)\)/);
 assert.match(html,/const supplement=pcInsaneSupplementPreviewFromSheets\(pcInsanePreviewSheets,blank\)/);assert.match(html,/pcInsaneSupplementPreviewHTML\(supplement\)/);
 assert.match(html,/pc-insane-detail-group/);
 const src=html.slice(html.indexOf('/* Stage57: source-backed'),html.indexOf('/* Stage55 pure parser end */'));
 assert.doesNotMatch(src,/\bsavePc\b|localStorage|indexedDB|pcMediaPut|pcDraft\s*=/);
 for(const f of ['inSANe大判空白卡V2.0数据（自动卡）.xlsx','【新ins】角色卡汉化.pdf'])assert.ok(!fs.existsSync(path.join(root,f)));
 assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=Object\.freeze\(\{\s*'coc:7e'/);
});
