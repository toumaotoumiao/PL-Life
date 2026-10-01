'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const a=html.indexOf('/* Stage80: read-only recheck'),b=html.indexOf('async function pcExportExcelCard(',a);
assert.ok(a>0&&b>a);
const compare=new Function('pcDndRuleExportRows',html.slice(a,b)+'\nreturn pcDndCompareStandaloneRows;')(
 pc=>({edition:pc.edition,rows:[['D&D 5e 已填规则数据','','',''],['PC 名称',pc.name,'',''],['版次',pc.edition,'',''],['范围','当前版次已填规则字段；不含未经确认的 Excel 来源候选或原始工作簿','',''],['','','',''],['分类','字段','内容','说明'],...pc.rows]})
);
const pc={edition:'2024',name:'合成角色',rows:[['属性','力量','14',''],['豁免与技能','重名技能','+2','第一次'],['豁免与技能','重名技能','+3','第二次'],['身份、战斗与装备','生命值','024','']]};
const sheet=(body=pc.rows)=>[{name:'DND规则数据',rows:[['D&D 5e 已填规则数据','','',''],['PC 名称',pc.name,'',''],['版次',pc.edition,'',''],['范围','当前版次已填规则字段；不含未经确认的 Excel 来源候选或原始工作簿','',''],['','','',''],['分类','字段','内容','说明'],...body.map(r=>[...r])]}];
test('Round249 worksheet sorting does not create false differences or mutate the PC',()=>{
 const before=JSON.stringify(pc),res=compare(sheet([pc.rows[3],pc.rows[1],pc.rows[0],pc.rows[2]]),pc);
 assert.equal(res.exact,true);assert.equal(res.matching,4);assert.equal(res.changed,0);assert.equal(JSON.stringify(pc),before);
});
test('Round249 duplicate labels remain separate; edited duplicate counts as one changed field',()=>{
 const edited=pc.rows.map(r=>[...r]);edited[2][2]='+4';const x=compare(sheet(edited.reverse()),pc);
 assert.deepEqual([x.matching,x.changed],[3,1]);
 const gone=compare(sheet(pc.rows.filter((_,i)=>i!==2)),pc);
 assert.deepEqual([gone.matching,gone.changed],[3,1]);
 const added=compare(sheet([...pc.rows,pc.rows[1]]),pc);
 assert.deepEqual([added.matching,added.changed],[4,1]);
});
test('Round249 large internally generated D&D rule sheets remain eligible for recheck',()=>{
 const large={...pc,rows:Array.from({length:307},(_,i)=>['豁免与技能','虚构技能 '+i,String(i),''])};
 const actual=sheet(large.rows),out=compare(actual,large);assert.equal(out.exact,true);assert.equal(out.matching,307);
 const broken=sheet();broken[0].rows[6][0]='未知分类';assert.throws(()=>compare(broken,pc),/分类/);
});
