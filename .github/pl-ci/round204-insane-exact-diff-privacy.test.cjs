'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const from=html.indexOf('const PC_INSANE_PREVIEW_FIELDS=Object.freeze(['),to=html.indexOf('/* Stage55 pure parser end */',from);
assert.ok(from>=0&&to>from);
const get=new Function('escapeHTML',html.slice(from,to)+'\nreturn {sup:pcInsaneSupplementPreviewFromSheets,base:pcInsaneComparePreviewSheets,view:pcInsaneSupplementPreviewHTML};')(x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
function fixture(){const rows=Array.from({length:52},()=>[]);const set=(ref,value)=>{const m=ref.match(/^([A-Z]+)(\d+)$/);let c=0;for(const x of m[1])c=c*26+x.charCodeAt(0)-64;rows[+m[2]-1][c-1]=value;};
 for(const [r,v] of [['G1','特技表'],['H16','技能名'],['A20','名字'],['A21','年龄'],['D21','性别'],['A26','职业'],['D22','生命力'],['D23','正气度'],['D24','功绩点'],['E22',6],['E23',5],['H17','基本攻击'],['H20','战场移动'],['B32','镇痛剂'],['E32',0],['B34','武器'],['E34',0],['B36','护身符'],['E36',0]])set(r,v);
 for(const c of ['I','K','M','O','Q','S'])for(let r=2;r<=12;r++)set(c+r,c+'合成词'+r);
 Object.defineProperty(rows,'formulaRefs',{value:new Set()});return {sheets:[{name:'角色表',rows}],rows,set};}
test('Round204 compares a full long ability value with blank despite the 160 character display limit',()=>{
 const a=fixture(),b=fixture(),prefix='长能力'.repeat(70);a.set('H21',prefix+'新结尾');const out=get.sup(a.sheets,b.sheets),field=out.groups.abilities.find(x=>x.ref==='H21');
 assert.equal(field.state,'changed');assert.ok(field.value.length<=161);assert.ok(field.baseline.length<=161);
});
test('Round204 private history note is compared with blank without returning content',()=>{
 const a=fixture(),b=fixture(),prefix='虚构私人内容'.repeat(40),secret='保密后半段新值',old='保密后半段旧值';a.set('H40','合成团务');a.set('P40',prefix+secret);
 const out=get.sup(a.sheets,b.sheets),entry=out.groups.history[0];assert.equal(entry.notePresent,true);assert.equal(entry.noteChanged,true);
 assert.ok(!JSON.stringify(out).includes(secret));assert.ok(!JSON.stringify(out).includes(old));assert.ok(!JSON.stringify(out).includes(prefix));
 const view=get.view(out);assert.ok(!view.includes(secret)&&!view.includes(old)&&!view.includes(prefix));
});
test('Round204 whitespace-only source change is recognized while preserving bounded display',()=>{
 const a=fixture(),b=fixture();a.set('H22',' ');b.set('H22','  ');
 const out=get.sup(a.sheets,b.sheets).groups.abilities.find(x=>x.ref==='H22');assert.equal(out.state,'changed');assert.equal(out.whitespaceOnly,true);
});
test('Round204 label mismatch after a common 160-char prefix rejects unsafe baseline',()=>{
 const a=fixture(),b=fixture(),prefix='道具'.repeat(70);a.set('B32',prefix+'不同');b.set('B32',prefix+'原版');
 assert.throws(()=>get.sup(a.sheets,b.sheets),/道具标签不同/);
});
test('Round204 formula caches and private formula text never become user content',()=>{
 const a=fixture(),b=fixture();a.set('H21','公式缓存内容');a.rows.formulaRefs.add('H21');a.set('P40','私密公式缓存');a.rows.formulaRefs.add('P40');a.set('H40','合成团务');
 const out=get.sup(a.sheets,b.sheets);assert.equal(out.groups.abilities.find(x=>x.ref==='H21').state,'formula');assert.ok(!JSON.stringify(out).includes('公式缓存内容'));assert.ok(!JSON.stringify(out).includes('私密公式缓存'));assert.equal(out.groups.history[0].notePresent,false);
});
test('Round204 source read remains read-only and does not expose private original templates',()=>{
 const source=html.slice(html.indexOf('/* Stage57: source-backed'),html.indexOf('/* Stage55 pure parser end */'));
 assert.doesNotMatch(source,/savePc\s*\(|localStorage\.|indexedDB\.|pcDraft\s*=/);
 for(const name of ['inSANe大判空白卡V2.0数据（自动卡）.xlsx','【新ins】角色卡汉化.pdf'])assert.ok(!fs.existsSync(path.join(root,name)));
 assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=Object\.freeze\(\{\s*'coc:7e'/);
});

test('Round204 core identity comparison detects whitespace-only source differences',()=>{
 const a=fixture(),b=fixture();a.set('B20',' ');b.set('B20','  ');const r=get.base(a.sheets,b.sheets).rows.find(x=>x.ref==='B20');assert.equal(r.state,'changed');assert.equal(r.whitespaceOnly,true);
});
test('Round204 isolated mobile preview resets inherited section/header margins',()=>{
 assert.match(html,/#pcInsanePreviewBackdrop \.pc-manage-dialog\{margin:0;padding:0;min-height:0\}/);
 assert.match(html,/#pcInsanePreviewBackdrop \.pc-manage-head\{margin:0\}/);
 assert.match(html,/@media\(max-width:720px\)\{#pcInsanePreviewBackdrop \.pc-manage-dialog\{height:100dvh;max-height:100dvh\}\}/);
});
