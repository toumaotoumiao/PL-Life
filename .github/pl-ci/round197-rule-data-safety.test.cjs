'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function functionSource(name){
 const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} exists`);
 const brace=html.indexOf('{',start);let depth=0,quote='',escape=false,line=false,block=false;
 for(let i=brace;i<html.length;i++){
  const c=html[i],n=html[i+1];
  if(line){if(c==='\n')line=false;continue;}
  if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
  if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&n==='/'){line=true;i++;continue;}
  if(c==='/'&&n==='*'){block=true;i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if(c==='{')depth++;
  if(c==='}'&&--depth===0)return html.slice(start,i+1);
 }
 throw Error(`unterminated ${name}`);
}
const ctx=vm.createContext({clone:v=>JSON.parse(JSON.stringify(v)),PC_RULE_SHEET_TEMPLATES:Object.freeze({'brp-generic':{},insane:{},shinobigami:{}})});
for(const name of ['pcPreserveUnknownJsonProps','normalizePcRuleData','normalizePcRuleSheets'])vm.runInContext(functionSource(name),ctx);
const normalizeData=ctx.normalizePcRuleData,normalizeSheets=ctx.normalizePcRuleSheets;
function safe(record){return Object.getPrototypeOf(record)===vm.runInContext('Object.prototype',ctx) && !['__proto__','constructor','prototype'].some(k=>Object.hasOwn(record,k));}
const hazard=()=>JSON.parse('{"__proto__":{"polluted":true},"constructor":{"bad":true},"prototype":{"bad":true}}');
test('Round197 generic rule data rejects reserved object keys without dropping valid future fields',()=>{
 const input={...hazard(),traits:[{label:'STR',value:12,detail:'保留',future:{zero:0},...hazard()}],skills:[],resources:[],futureSection:{flag:false}};
 const source=JSON.stringify(input),out=normalizeData(input);
 assert.equal(JSON.stringify(input),source,'normalization must not mutate source');
 assert.ok(safe(out),'rule data structure must be plain and free of reserved keys');
 assert.ok(safe(out.traits[0]),'rule row must be plain and free of reserved keys');
 assert.equal(out.traits[0].label,'STR');assert.equal(out.traits[0].value,'12');assert.equal(out.traits[0].future.zero,0);
 assert.equal(out.futureSection.flag,false);assert.equal(({}).polluted,undefined);
});
test('Round197 template map filters reserved keys and preserves both known and unknown templates',()=>{
 const input=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"bad":true},"prototype":1,"insane":{"traits":[{"label":"生命力","value":6,"future":{"keep":false},"__proto__":{"row":true}}],"skills":[],"resources":[],"futureGroup":{"keep":0}},"future-system":{"traits":[],"skills":[],"resources":[],"future":{"keep":"yes"}}}');
 const source=JSON.stringify(input),out=normalizeSheets(input);
 assert.equal(JSON.stringify(input),source);assert.ok(safe(out));assert.ok(safe(out.insane));assert.ok(safe(out.insane.traits[0]));
 assert.equal(out.insane.traits[0].future.keep,false);assert.equal(out.insane.futureGroup.keep,0);
 assert.equal(out['future-system'].future.keep,'yes');assert.equal(({}).polluted,undefined);
});
test('Round197 ordinary edit -> normalize -> canonical JSON keeps unknown safe fields',()=>{
 const original={traits:[{label:'体力',value:'8',futureRow:{keep:''}}],skills:[],resources:[],futureGroup:{keep:false}};
 const before=normalizeSheets({insane:original,'future-system':{future:1}});
 before.insane.traits[0].value='9';const after=normalizeSheets(JSON.parse(JSON.stringify(before)));
 assert.equal(after.insane.traits[0].value,'9');assert.equal(after.insane.traits[0].futureRow.keep,'');
 assert.equal(after.insane.futureGroup.keep,false);assert.equal(after['future-system'].future,1);
});
test('Round197 gate is included in all-node CI and does not replace Round187',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(workflow,/round197-rule-data-safety\.test\.cjs/);
 assert.match(workflow,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
 const independent=fs.readFileSync(path.join(root,'.github/workflows/pl-native-restore-gate.yml'),'utf8');
 assert.match(independent,/round197-rule-data-safety\.test\.cjs/);
});
