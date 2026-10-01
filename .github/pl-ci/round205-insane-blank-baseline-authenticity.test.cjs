'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const from=html.indexOf('const PC_INSANE_PREVIEW_FIELDS=Object.freeze(['),to=html.indexOf('/* Stage55 pure parser end */',from);
assert.ok(from>=0&&to>from);
const api=new Function(html.slice(from,to)+'\nreturn {validate:pcInsaneValidateBlankBaseline,compare:pcInsaneComparePreviewSheets,supplement:pcInsaneSupplementPreviewFromSheets};')();
function sheet(){const rows=Array.from({length:52},()=>[]),set=(ref,value)=>{const m=ref.match(/^([A-Z]+)(\d+)$/);let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;rows[+m[2]-1][col-1]=value;};
 for(const [ref,v] of [['G1','特技表'],['H16','技能名'],['A20','名字'],['A21','年龄'],['D21','性别'],['A26','职业'],['D22','生命力'],['D23','正气度'],['D24','功绩点'],['E22',6],['E23',5],['H17','基本攻击'],['H20','战场移动'],['E32',0],['E34',0],['E36',0],['B32','镇痛剂'],['B34','武器'],['B36','护身符']])set(ref,v);
 for(const c of ['I','K','M','O','Q','S'])for(let r=2;r<=12;r++)set(c+r,c+'测试词'+r);
 Object.defineProperty(rows,'formulaRefs',{value:new Set()});return {sheets:[{name:'角色表',rows}],set,rows};}
test('Round205 verified untouched blank baseline is accepted',()=>{const b=sheet();assert.equal(api.validate(b.sheets),true);assert.equal(api.compare(b.sheets,b.sheets).changedCount,0);});
test('Round205 second populated PC cannot be passed as blank',()=>{const b=sheet(),f=sheet();b.set('B20','另一位调查员');f.set('B20','本次调查员');assert.throws(()=>api.compare(f.sheets,b.sheets),/空白卡的 B20/);});
test('Round205 selected specialities, ability names and item usage are rejected from baseline',()=>{for(const [ref,v] of [['B29','伪特技'],['H21','已填能力'],['D32',1],['E34',2]]){const b=sheet(),f=sheet();b.set(ref,v);assert.throws(()=>api.supplement(f.sheets,b.sheets),new RegExp('空白卡的 '+ref));}});
test('Round205 baseline must have default resource values',()=>{for(const [ref,v] of [['E22',4],['E23',3],['E32','']]){const b=sheet();b.set(ref,v);assert.throws(()=>api.validate(b.sheets),new RegExp('空白卡的 '+ref));}});
test('Round205 private note in second filled card is rejected without exposing note text',()=>{const b=sheet(),f=sheet(),secret='模拟私人内容禁止显示';b.set('P40',secret);let error='';try{api.compare(f.sheets,b.sheets);}catch(e){error=e.message;}assert.match(error,/空白卡的 P40/);assert.ok(!error.includes(secret));});
test('Round205 formula in editable baseline slot is never accepted as a blank',()=>{const b=sheet();b.rows.formulaRefs.add('B20');assert.throws(()=>api.validate(b.sheets),/空白卡的 B20/);});
test('Round205 user filled file is still accepted as read-only source, without PC writes',()=>{const b=sheet(),f=sheet();f.set('B20','虚构填写角色');f.set('B29','模拟候选特技');f.set('P40','不可展示私密文本');const r=api.compare(f.sheets,b.sheets),sup=api.supplement(f.sheets,b.sheets);assert.equal(r.rows.find(x=>x.ref==='B20').state,'changed');assert.ok(!JSON.stringify(sup).includes('不可展示私密文本'));const source=html.slice(from,to);assert.doesNotMatch(source,/\bsavePc\s*\(|localStorage\.|indexedDB\.|pcDraft\s*=/);});
test('Round205 reference originals are not part of public program',()=>{for(const name of ['inSANe大判空白卡V2.0数据（自动卡）.xlsx','【新ins】角色卡汉化.pdf'])assert.ok(!fs.existsSync(path.join(root,name)));assert.match(html,/pcInsaneValidateBlankBaseline\(blankSheets\)/);});
