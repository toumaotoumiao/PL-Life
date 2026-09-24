'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const projectRoot=path.resolve(__dirname,'../..');
const siteRoot=fs.existsSync(path.join(projectRoot,'site','index.html'))?path.join(projectRoot,'site'):projectRoot;
const html=fs.readFileSync(path.join(siteRoot,'index.html'),'utf8');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'coc7-blank-variants-round73.json'),'utf8'));
function code(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`source ${a}`);return html.slice(i,j);}
function index(col){let n=0;for(const ch of col)n=n*26+ch.charCodeAt(0)-64;return n-1;}
function rows(cells){const result=[];for(const [ref,v] of Object.entries(cells)){const m=ref.match(/^([A-Z]+)(\d+)$/);const r=+m[2]-1,c=index(m[1]);if(!result[r])result[r]=[];result[r][c]=v;}return result;}
function sheet(f){return {name:'人物卡',rows:rows(f.main.cells)};}
function context(){
 const original=fixtures[0],ctx={Map,Set,Date,console,TextEncoder,pcExcelColIndex:index,pcExcelNonEmpty:v=>v!==null&&v!==undefined&&String(v).trim()!=='',uid:()=> 'synthetic',
   pcBlankWorkbookBytes:()=>({buffer:'embedded'}),
   pcExcelReadXlsx:async()=>fixtures[0].sheets.map(s=>s.name==='人物卡'?sheet(original):{name:s.name,rows:[]}),
   pcExcelUnzip:async v=>({tag:v}),
   pcExcelFormulaDefinitions:(files,name)=>name==='人物卡'?new Map(Object.entries((files.tag==='embedded'?original:ctx.current||original).main.formulas)):new Map(),
   pcExcelPatchKaguraRows:(base,pc)=>({changes:new Map([['E3',pc.name],['U3',pc.coc?.str]].filter(([,v])=>v!==undefined&&v!==''))}),
   pcExcelColumnName:i=>{let n=i+1,r='';while(n){r=String.fromCharCode(65+(n-1)%26)+r;n=Math.floor((n-1)/26);}return r;},
   pcExcelKaguraSkills:rs=>[{name:'会计',value:rs[15]?.[17]??5}],
   pcExcelKaguraWeapons:rs=>rs[53]?.[6]?[{name:String(rs[53][6]),skill:'',damage:'',attacks:'',ammo:''}]:[],
   normalizedEntityNameKey:s=>String(s).trim().toLowerCase()
 };
 vm.createContext(ctx);
 vm.runInContext(code('const PC_EXCEL_KAGURA_TEMPLATE=', '/* 固定模板填写差异'),ctx);
 vm.runInContext("let pcExcelBlankSheetPromise=null;",ctx);
 vm.runInContext(code('const PC_EXCEL_KAGURA_MAPPED_REFS=', 'function pcExcelFormulaCellRefs('),ctx);
 vm.runInContext(code('function pcExcelAuditValueEqual(', '/* v8.1.11.83'),ctx);
 vm.runInContext(code('function pcExcelRoleInputRef(', 'function pcExcelPatchExtraCells('),ctx);
 return ctx;
}
test('三份空白卡各自具有独立结构指纹，版本日期不由文件名猜测',()=>{
 const c=context();for(const f of fixtures){const got=c.pcExcelKnownTemplate([sheet(f)]);assert(got, f.name);assert.equal(got.variant.id,f.id);assert.equal(f.main.cells.B147,f.marker);assert.equal(f.main.cells.B2,'调查员信息');}
 const falseName=sheet(fixtures[1]);falseName.rows[146][1]='第三方未知卡';assert.equal(c.pcExcelKnownTemplate([falseName]),null);
});
test('三个版本的空白主表能从原版加精简差异重建，公式变化也能逐项还原',()=>{
 const c=context();const original=fixtures[0];for(const f of fixtures){const variant=c.pcExcelVerifiedVariant(sheet(f));assert(variant);const rebuilt=c.pcExcelVariantBaseRows(rows(original.main.cells),variant);
   for(const ref of new Set([...Object.keys(original.main.cells),...Object.keys(f.main.cells)])){
     const m=ref.match(/^([A-Z]+)(\d+)$/),v=rebuilt[+m[2]-1]?.[index(m[1])]??'',wanted=f.main.cells[ref]??'';
     assert.equal(String(v),String(wanted),`${f.id}:${ref}`);
   }
   const formula=Object.fromEntries(c.pcExcelVariantBaseFormulas(new Map(Object.entries(original.main.formulas)),variant));
   assert.deepEqual(formula,f.main.formulas,`formula ${f.id}`);
 }
});
test('三种空白卡默认技能/武器/数值不冒充角色填写内容，模板中的背景提示不导入',async()=>{
 for(const f of fixtures){const c=context(),sh=sheet(f),variant=c.pcExcelVerifiedVariant(sh),original=c.pcExcelKaguraSkills(sh.rows),weapons=c.pcExcelKaguraWeapons(sh.rows);
   const parsed={name:'',age:'',gender:'',occupation:'',residence:'',birthplace:'',coc:{str:sh.rows[2]?.[20]??''},skills:original,weapons,background:{notes:sh.rows[78]?.[22]??''},importSource:{}};
   await c.pcExcelFilterFixedDefaults(parsed,sh,variant);
   assert.deepEqual(parsed.skills,[],`${f.id} preset skills`);assert.deepEqual(parsed.weapons,[],`${f.id} preset weapons`);
   assert.equal(parsed.coc.str,'',`${f.id} 0 attribute`);
   if(f.id!=='2020-05')assert.equal(parsed.background.notes,'',`${f.id} help placeholder`);
   assert.equal(parsed.importSource.templateVariant,f.id);
 }
});
test('各版本用户已填姓名与属性能够提取，同时不把标准技能误作用户特长',async()=>{
 for(const f of fixtures){const c=context(),sh=sheet(f);sh.rows[2][4]='虚构测试角色';sh.rows[2][20]=77;sh.rows[15][17]=42;
   const parsed={name:'虚构测试角色',age:'',occupation:'',gender:'',residence:'',birthplace:'',coc:{str:77},skills:c.pcExcelKaguraSkills(sh.rows),weapons:c.pcExcelKaguraWeapons(sh.rows),background:{notes:''},importSource:{}};
   await c.pcExcelFilterFixedDefaults(parsed,sh,c.pcExcelVerifiedVariant(sh));
   assert.equal(parsed.name,'虚构测试角色');assert.equal(parsed.coc.str,77);assert.equal(parsed.skills.length,1);assert.equal(parsed.skills[0].value,42);
 }
});
test('三份空白卡不制造上千条 Excel 其他填写项，版本公式和参考表保留原件',async()=>{
 for(const f of fixtures){const c=context();c.current=f;const sheets=f.sheets.map(s=>s.name==='人物卡'?sheet(f):{name:s.name,rows:[]});
   const r=await c.pcExcelCollectExtraEdits(sheets,'candidate');
   assert.equal(r.edits.length,0,`${f.id} extra`);
   assert.equal(r.audit.formula,0,`${f.id} formulas`);
   assert.equal(r.audit.templateDifferences,0,`${f.id} text`);
   assert.equal(r.audit.unverified,0,`${f.id} unknown`);
   if(f.id!=='2020-05')assert.equal(r.audit.requiresOriginal,true);
 }
});
test('其他版的真正新增文字只记录该字段，不把已有样例和说明文字识别为用户填写',async()=>{
 const f=fixtures[1],c=context(),sh=sheet(f),original=sh.rows[129]?.[22];assert(original);sh.rows[129][22]='虚构填写的重要之人';c.current=f;
 const r=await c.pcExcelCollectExtraEdits(f.sheets.map(x=>x.name==='人物卡'?sh:{name:x.name,rows:[]}), 'candidate');
 assert.equal(r.edits.length,1);assert.equal(r.edits[0].ref,'W130');assert.equal(r.edits[0].value,'虚构填写的重要之人');
});
test('不同版或未知版原文件必须保留，不能依旧版空白卡差异去生成假填写项',async()=>{
 const f=fixtures[1],c=context(),sh=sheet(f);sh.rows[146][1]='未知作者衍生版本';c.current=f;
 const r=await c.pcExcelCollectExtraEdits(f.sheets.map(x=>x.name==='人物卡'?sh:{name:x.name,rows:[]}), 'candidate');
 assert.equal(r.audit.requiresOriginal,true);assert.equal(r.audit.extra,0);assert.equal(r.audit.unverified>0,true);
});
test('模板缺格的导出只在明确允许时跳过，并保留未命中单元格清单',()=>{
 const ctx={Map,Set,pcExcelXmlEscape:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')};vm.createContext(ctx);
 vm.runInContext(code('function pcExcelPatchCells(', 'function pcExcelWriteIfChanged('),ctx);
 const xml='<worksheet><c r="A1" t="inlineStr"><is><t>旧值</t></is></c><c r="B2"><f>SUM(A1)</f><v>0</v></c></worksheet>';
 const changes=new Map([['A1','新值'],['B2',7],['Z99',13]]);assert.throws(()=>ctx.pcExcelPatchCells(xml,changes),/Z99/);
 const missing=new Set(),out=ctx.pcExcelPatchCells(xml,changes,{allowMissing:true,missingRefs:missing});assert.match(out,/新值/);assert.match(out,/<f>SUM\(A1\)<\/f>/);assert.deepEqual([...missing],['Z99']);
 assert.match(html,/导出覆盖报告/);assert.match(html,/缺少目标单元格/);assert.match(html,/完整网页档案已通过回读/);
});
test('未知卡只自动接受唯一来源；多个相同值及零值需核对',()=>{
 const c=context();vm.runInContext(code('function pcExcelPrepareGenericReview(', 'function pcExcelMappingReviewHTML('),c);
 Object.assign(c,{PC_EXCEL_FIELD_ALIASES:{'identity:name':['姓名'],'coc:str':['力量']},pcExcelLabelFingerprint:()=> 'coc7-label-12345678',pcExcelGetPathValue:(pc,path)=>path==='identity:name'?pc.name:pc.coc.str,pcExcelSetPathValue:(pc,path,v)=>{if(path==='identity:name')pc.name=String(v);else pc.coc.str=v;},pcExcelGenericCandidates:()=>({'identity:name':[{value:'甲',sheet:'人物卡',ref:'A2',labelRef:'A1',label:'姓名',source:'人物卡!A2'},{value:'甲',sheet:'简表',ref:'B2',labelRef:'B1',label:'姓名',source:'简表!B2'}],'coc:str':[{value:0,sheet:'人物卡',ref:'C2',labelRef:'C1',label:'力量',source:'人物卡!C2'}]})});
 const parsed={name:'甲',coc:{str:0}},review=c.pcExcelPrepareGenericReview(parsed,[],[]);
 assert.equal(Object.keys(review.auto).length,0);assert.equal(review.issues.length>=2,true);assert.equal(parsed.name,'');
});
test('未知卡的中英双语组合标签可识别，同时拒绝占位值、非法性别和数字姓名',()=>{
 const c={pcExcelNorm:s=>String(s??'').toLowerCase().replace(/\s+/g,''),PC_EXCEL_FIELD_ALIASES:{'identity:name':['姓名','name'],'coc:str':['力量','str'],'identity:gender':['性别','gender']}};
 vm.createContext(c);vm.runInContext(code('function pcExcelGenericLabelMatches(', 'function pcExcelGenericCandidates('),c);
 assert.equal(c.pcExcelGenericLabelMatches('力量 STR',['力量','STR']),true);
 assert.equal(c.pcExcelGenericLabelMatches('力量 STR',['敏捷','DEX']),false);
 assert.equal(c.pcExcelValidCandidate('identity:name','999'),false);
 assert.equal(c.pcExcelValidCandidate('identity:name','请填写'),false);
 assert.equal(c.pcExcelValidCandidate('identity:gender','123'),false);
 assert.equal(c.pcExcelValidCandidate('identity:gender','女性'),true);
 assert.equal(c.pcExcelValidCandidate('coc:str',79),true);
 assert.equal(c.pcExcelValidCandidate('coc:str',301),false);
});
