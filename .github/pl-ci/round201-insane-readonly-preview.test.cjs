'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('const PC_INSANE_PREVIEW_FIELDS=Object.freeze(['),end=html.indexOf('/* Stage55 pure parser end */',start);
assert.ok(start>0&&end>start,'Insane preview pure parser source');
const parse=new Function(html.slice(start,end)+'\nreturn pcInsaneExcelPreviewFromSheets;')();
const make=()=>{const rows=Array.from({length:41},()=>[]),set=(ref,value)=>{const [,letters,num]=ref.match(/^([A-Z]+)(\d+)$/);let col=0;for(const c of letters)col=col*26+c.charCodeAt(0)-64;rows[+num-1][col-1]=value;};
 for(const [r,v] of [['G1','特技表'],['H16','技能名'],['A20','名字'],['A21','年龄'],['D21','性别'],['A26','职业'],['D22','生命力'],['D23','正气度'],['D24','功绩点']])set(r,v);
 set('E22',6);set('E23',5);Object.defineProperty(rows,'formulaRefs',{value:new Set()});return {rows,set};};
test('Round201 blank actual-template positions are not misclassified as user input',()=>{
 const t=make(),r=parse([{name:'角色表',rows:t.rows},{name:'职业表',rows:[[999]]}]);
 assert.equal(r.candidateCount,0);assert.equal(r.defaultCount,2);assert.equal(r.editionId,'');
 assert.deepEqual(r.rows.filter(x=>x.state==='template-default').map(x=>x.ref),['E22','E23']);
 assert.equal(r.rows.find(x=>x.key==='name').ref,'B20');assert.equal(r.rows.find(x=>x.key==='occupation').ref,'B26');
});
test('Round201 candidate values are displayed with coordinates but do not claim automatic import',()=>{
 const t=make();t.set('B20','  测试人物  ');t.set('B21',25);t.set('E22',4);
 const r=parse([{name:'角色表',rows:t.rows}]);assert.equal(r.candidateCount,3);
 assert.equal(r.rows.find(x=>x.key==='name').value,'测试人物');assert.equal(r.rows.find(x=>x.key==='life').value,'4');
 assert.equal(r.rows.find(x=>x.key==='sanity').state,'template-default');
});
test('Round201 formulas and cached errors are excluded from human entered data',()=>{
 const t=make();t.set('B20','#NAME?');t.rows.formulaRefs.add('B20');t.set('E22',7);t.rows.formulaRefs.add('E22');
 const r=parse([{name:'角色表',rows:t.rows}]);assert.equal(r.candidateCount,0);assert.equal(r.formulaCount,2);
 assert.equal(r.rows.find(x=>x.key==='name').value,'');assert.equal(r.rows.find(x=>x.key==='life').value,'');
});
test('Round201 wrong template and wrong anchors stop without CoC fallback',()=>{
 const t=make();assert.throws(()=>parse([{name:'人物卡',rows:t.rows}]),/角色表/);
 t.set('A20','别的标签');assert.throws(()=>parse([{name:'角色表',rows:t.rows}]),/联系制作者/);
});
test('Round201 preview interface has no apply/save action and reuses bounded Excel reader',()=>{
 assert.match(html,/data-pc-insane-preview-open>预览 Insane Excel（不保存）/);
 assert.match(html,/function pcInsaneExcelPreviewHTML\(/);assert.match(html,/guardImportFile\(file,16\*1024\*1024,'Insane 角色卡'\)/);
 const reader=html.slice(html.indexOf('async function pcInsanePreviewFile('),html.indexOf("document.addEventListener('click',event=>{",html.indexOf('async function pcInsanePreviewFile(')));
 assert.match(reader,/pcExcelReadXlsx\(await file\.arrayBuffer\(\)\)/);
 assert.doesNotMatch(reader,/pcDraft\s*=|pcWorkbookPending\s*=|localStorage|pcMediaPut|savePc|pcMergeImportedDraft|pcExcelExport/);
 assert.doesNotMatch(html.slice(html.indexOf('<div class="pc-manage-backdrop" hidden id="pcInsanePreviewBackdrop">'),html.indexOf('</section></div>',html.indexOf('<div class="pc-manage-backdrop" hidden id="pcInsanePreviewBackdrop">'))),/合并所选|确认导入/);
});
test('Round201 reference and public source boundaries, edition and version are preserved',()=>{
 const profile=JSON.parse(fs.readFileSync(path.join(root,'.github/pl-ci/insane-source-profile.json'),'utf8'));
 assert.equal(profile.xlsxMainCellHints.name,'角色表!B20');assert.equal(profile.xlsxMainCellHints.life,'角色表!E22');
 assert.equal(profile.readOnlyPreview.writesToPc,false);assert.equal(profile.readOnlyPreview.editionInference,'none');
 for(const file of profile.inputSources)assert.ok(!fs.existsSync(path.join(root,file.file)),'user-supplied original not embedded');
 const current=html.match(/const APP_UI_VERSION = "(8\.1\.12\.\d+)"/)?.[1];assert.ok(current,'current version declared');
 assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp('v'+current.replaceAll('.','\\.')));
 assert.match(html,/function pcRuleIsCoc\(pc\)/);assert.match(html,/const PC_EXCEL_EXPORT_ADAPTERS=Object\.freeze\(\{\s*'coc:7e'/);
});
