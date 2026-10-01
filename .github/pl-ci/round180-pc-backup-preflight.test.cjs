'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=source.slice(source.indexOf('function pcArchivePreflightIssues('),source.indexOf('const v8181DataIntegrityReport=dataIntegrityReport;'));
assert(section.startsWith('function pcArchivePreflightIssues('));
function scan(pcs,validator=()=> ''){
 const ctx={pcValidateArchiveInput:validator};vm.createContext(ctx);vm.runInContext(section+'\nglobalThis.check=pcArchivePreflightIssues;',ctx);
 return ctx.check(pcs);
}
const sample=(id,name,extra={})=>({id,name,ruleSheets:{insane:{traits:[],skills:[],resources:[]}},galleryMediaIds:[],...extra});
test('Round180 healthy separate rules and attachments have no false warning',()=>{
 assert.equal(scan([sample('A','甲',{avatarMediaId:'i1'}),sample('B','乙',{avatarMediaId:'i2'})]).length,0);
});
test('Round180 avatar and gallery sharing inside the SAME PC is allowed',()=>{
 assert.equal(scan([sample('A','甲',{avatarMediaId:'i1',galleryMediaIds:['i1','i1']})]).length,0);
});
test('Round180 cross-PC media reuse is detected before export and never auto-fixed',()=>{
 const data=[sample('A','甲',{avatarMediaId:'shared',ruleSheets:{future:{keep:['old']}}}),sample('B','乙',{galleryMediaIds:['shared','shared']})];const before=JSON.stringify(data);
 const found=scan(data);assert.equal(found.length,1);assert.match(found[0].title,/图片关联冲突/);assert.match(found[0].detail,/甲/);assert.match(found[0].detail,/乙/);assert.equal(found[0].pcId,'B');assert.equal(JSON.stringify(data),before);
});
test('Round180 repeated collision across three PCs is reported once per ID',()=>{
 const found=scan([sample('A','甲',{avatarMediaId:'x'}),sample('B','乙',{avatarMediaId:'x'}),sample('C','丙',{avatarMediaId:'x'})]);
 assert.equal(found.filter(x=>x.title==='PC 图片关联冲突').length,1);
});
test('Round180 malformed stored ruleSheets are diagnosed read-only',()=>{
 for(const v of ['bad',[],7]){const pc=sample('A','甲',{ruleSheets:v});const before=JSON.stringify(pc);const found=scan([pc]);assert.equal(found.length,1);assert.match(found[0].title,/规则资料结构异常/);assert.equal(JSON.stringify(pc),before);}
});
test('Round180 existing save validator guards oversized and ambiguous rules in health panel',()=>{
 const found=scan([sample('A','甲')],()=> '规则模板字段过长');assert.equal(found.length,1);assert.match(found[0].detail,/字段过长/);assert.equal(found[0].pcId,'A');
});
test('Round180 validator exception is diagnosed, not swallowed or treated as healthy',()=>{
 const found=scan([sample('A','甲')],()=>{throw new Error('bad');});assert.equal(found.length,1);assert.match(found[0].title,/无法检查/);
});
test('Round180 unknown future data is retained verbatim and not flagged as invalid',()=>{
 const pc=sample('A','甲',{ruleSheets:{'future-template':{fields:[{unseen:{a:1}}]},'__genericScopedV1':true}});const before=JSON.stringify(pc);
 assert.equal(scan([pc]).length,0);assert.equal(JSON.stringify(pc),before);
});
test('Round180 settings report shows issue and opens the exact PC, without unsafe auto-repair',()=>{
 assert.match(source,/for\(const issue of pcArchivePreflightIssues\(pcs\)\)r\.issues\.push\(/);
 assert.match(source,/action:\{view:'pcs',pcId:issue\.pcId\},fix:null/);
 assert.match(source,/else if \(a\.view === "pcs"\) \{\s*const pc=pcs\.find\([\s\S]*?openPcEditor\(pc\.id\)/);
 assert.match(source,/function backupMediaOwnersFromPcs\(list\)[\s\S]*?owner=ids\.size\?backupAttachmentKey\(pc\?\.id,'PC 档案'\)[\s\S]*?owners\.has\(id\)&&owners\.get\(id\)!==owner/);
});
