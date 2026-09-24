'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const siteRoot=fs.existsSync(path.join(root,'site','index.html'))?path.join(root,'site'):root;
const html=fs.readFileSync(path.join(siteRoot,'index.html'),'utf8');
function source(from,to){const i=html.indexOf(from),j=html.indexOf(to,i+from.length);assert(i>=0&&j>i,from);return html.slice(i,j);}
function harness(){const c={TextDecoder,TextEncoder,Uint8Array,Map,Set,console};vm.createContext(c);
 vm.runInContext(source('function pcExcelXmlEscape(','function pcExcelWorkbookSheetPath('),c);return c;}

test('WPS UTF-16LE/BE XML is decoded without corrupting original package bytes',()=>{
 const c=harness(),text='<?xml version="1.0"?><safe/>';
 for(const [encoding,bom] of [['utf-16le',[255,254]],['utf-16be',[254,255]]]){
  const bytes=[...bom];for(const ch of text){const n=ch.charCodeAt(0);if(encoding==='utf-16le')bytes.push(n&255,n>>8);else bytes.push(n>>8,n&255);}
  assert.equal(c.pcExcelDecodeXml(Uint8Array.from(bytes)),text);
 }
 assert.equal(c.pcExcelDecodeXml(new TextEncoder().encode(text)),text);
 assert.throws(()=>c.pcExcelDecodeXml(Uint8Array.from([0xff,0xff,0xff])),/encoded|valid|encoding|utf/i);
});

test('XML text serialization preserves carriage returns rather than changing character backstory',()=>{
 const c=harness();assert.equal(c.pcExcelXmlEscape('A\r\nB'), 'A&#xD;\nB');
 assert.equal(c.pcExcelXmlEscape('<&>'), '&lt;&amp;&gt;');
});

function fakeDocument(xml){
 const isCell=xml.includes('<worksheet');
 const formula=xml.includes('<f>');
 const value=xml.includes('#VALUE!')?'#VALUE!':'';
 const cell={getAttribute:k=>k==='r'?'AF10':k==='t'?'e':'',getElementsByTagNameNS:(_,name)=>name==='v'?[{textContent:value}]:name==='f'&&formula?[{}]:[]};
 return {getElementsByTagName:()=>[],getElementsByTagNameNS:(_,name)=>isCell&&name==='c'?[cell]:[]};
}
function crossCheckHarness(formula){
 const c={TextDecoder,TextEncoder,Uint8Array,Map,Set,console,DOMParser:class {parseFromString(x){return fakeDocument(x);}},
  pcExcelUnzip:async()=>({'xl/worksheets/sheet1.xml':new TextEncoder().encode(`<worksheet><c r="AF10" t="e">${formula?'<f>1+2</f>':''}<v>#VALUE!</v></c></worksheet>`)}),
  pcExcelWorkbookSheetPath:()=> 'xl/worksheets/sheet1.xml',
  pcExcelAuditValueEqual:(a,b)=>String(a)===String(b),
  pcExcelCell:(rows,ref)=>ref==='AF10'?'#VALUE!':'',
  pcExcelCellNumber:()=>'',pcExcelKaguraSkillName:()=>'',pcExcelKaguraSkillValue:()=>'',normalizedEntityNameKey:s=>String(s).toLowerCase()};
 vm.createContext(c);
 vm.runInContext(source('function pcExcelDecodeXml(','function pcExcelWorkbookSheetPath('),c);
 vm.runInContext(source('const PC_CARD_TIME_REFS=','function pcNormalizeCardTime('),c);
 vm.runInContext(source('async function pcExcelCrossCheckFixed(','function pcExcelReadOwnSupplement('),c);
 const pc={name:'',era:'',occupation:'',age:'',gender:'',residence:'',birthplace:'',coc:{},background:{}};
 return {c,pc};
}
test('a verified formula with #VALUE! cache does not abort an otherwise intact card',async()=>{
 const {c,pc}=crossCheckHarness(true);const check=await c.pcExcelCrossCheckFixed(new ArrayBuffer(0),{name:'人物卡',rows:[]},pc);
 assert.equal(JSON.stringify(check.formulaCacheIssues),JSON.stringify(['AF10']));
});
test('a literal invalid numeric field without formula remains blocked',async()=>{
 const {c,pc}=crossCheckHarness(false);
 await assert.rejects(c.pcExcelCrossCheckFixed(new ArrayBuffer(0),{name:'人物卡',rows:[]},pc),/无效数值/);
});
