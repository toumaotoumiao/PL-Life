'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logic=part('function normalizePcRuleData(', 'function normalizePcArchive(');
const reader=part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){');
const api=new Function('clone','escapeHTML',logic+'\n'+reader+'\nreturn {normalizePcRuleSheets,pcRuleCurrentData,pcRuleFilled,pcRuleNeedsName,pcRuleDisplayLabel,pcRuleSearchText,pcRuleReadingHTML,pcRuleReadingSearchUi};')(structuredClone,escapeHTML);
function fixture(){return {id:'synthetic-pc',name:'虚构PC',ruleMeta:{systemId:'insane'},ruleSheets:{insane:{traits:[{label:'',value:'6',detail:'',future:{test:true}},{label:'生命力',value:'',detail:'长说明\n原样保留 <script>alert(1)</script>'},{label:'',value:'',detail:'末尾说明：第1199行'},{label:'只有名称',value:'',detail:''}],skills:[{label:'',value:'777',detail:'说明保留'}],resources:[],futureSection:{keep:'yes'}},shinobigami:{traits:[{label:'流派',value:'另一规则'}],skills:[],resources:[]}},ruleData:{traits:[{label:'旧字段',value:'42'}],skills:[],resources:[]},coc:{san:55},excelEdits:[{sheet:'旧表',ref:'B2',value:'原始Excel'}]};}
test('Unnamed value/detail fields are visible but blank template placeholders are not treated as filled',()=>{
 const p=fixture(),old=JSON.stringify(p),rows=api.pcRuleCurrentData(p).traits;
 assert.deepEqual(rows.map(api.pcRuleFilled),[true,true,true,false]);
 assert.equal(api.pcRuleNeedsName(rows[0]),true);assert.equal(api.pcRuleNeedsName(rows[2]),true);
 assert.equal(api.pcRuleDisplayLabel(rows[0],0),'未命名字段 1');
 assert.equal(api.pcRuleDisplayLabel(rows[2],2),'未命名字段 3');
 assert.equal(api.pcRuleSearchText(rows[0],0).includes('未命名字段'),true);
 const view=api.pcRuleReadingHTML(p);
 assert.match(view,/未命名字段 1/);assert.match(view,/未命名字段 3/);
 assert.match(view,/待命名 2/);assert.match(view,/第1199行/);
 assert.doesNotMatch(view,/只有名称/);
 assert.ok(view.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.equal(JSON.stringify(p),old);
});
test('Rule switching, legacy generic, Excel, and future-version extensions survive display projection',()=>{
 const p=fixture(),raw=JSON.stringify(p);api.pcRuleReadingHTML(p);
 p.ruleMeta.systemId='shinobigami';assert.match(api.pcRuleReadingHTML(p),/另一规则/);assert.doesNotMatch(api.pcRuleReadingHTML(p),/第1199行/);
 p.ruleMeta.systemId='insane';assert.match(api.pcRuleReadingHTML(p),/第1199行/);
 assert.equal(JSON.stringify({...p,ruleMeta:{systemId:'insane'}}),raw);
 assert.deepEqual(p.ruleSheets.insane.traits[0].future,{test:true});assert.equal(p.excelEdits[0].value,'原始Excel');
});
test('Actual editor and all public export surfaces use the same non-mutating display alias',()=>{
 assert.match(html,/function pcRuleFilled\(row\)\{return Boolean\(String\(row\?\.value/);
 assert.match(html,/data-pc-rule-count[^\n]*待命名/);
 assert.match(html,/class="pc-rule-unnamed-hint"/);
 assert.match(html,/const hint=row\.querySelector\('\.pc-rule-unnamed-hint'\)/);
 assert.match(html,/pcRuleDisplayLabel\(row,index\)/);
 assert.match(html,/const genericSkillRows=genericData\.skills\.map/);
 assert.match(html,/genericSection\(genericData\.traits\)/);
 assert.match(html,/rd\[key\]\.map\(\(x,index\)=>\(\{x,index\}\)\)\.filter/);
 assert.match(html,/\.rule-public-detail\{[^}]*white-space:pre-wrap/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/const APP_UI_VERSION = "\d+(?:\.\d+){3}"/);
});
test('Names stay empty in normalized data; only display text supplies the alias',()=>{
 const p=fixture(),out=api.normalizePcRuleSheets(p.ruleSheets);
 assert.equal(out.insane.traits[0].label,'');assert.equal(out.insane.traits[2].label,'');
 assert.equal(out.insane.traits[2].detail,'末尾说明：第1199行');
 assert.equal(out.insane.futureSection.keep,'yes');
 assert.equal(api.pcRuleDisplayLabel(out.insane.traits[2],2),'未命名字段 3');
});

test('Actual legacy HTML archive builder includes unnamed and detail-only rows without executing markup',async()=>{
 const builder=part('async function buildPcFullArchiveHtml(pc){','/* PC 单角色公开导出已统一为图片档案');
 const maker=new Function('escapeHTML','clone',`const APP_NAME='PL Synthetic',PC_COC_KEYS=[],PC_COC_LABELS={},PC_BACKGROUND_KEYS=[];
 const pcArchiveRunRows=()=>[],pcArchiveMediaRows=async()=>[],pcArchiveText=v=>escapeHTML(String(v||'')),pcArchiveSection=(title,inner,subtitle='')=>'<section><h2>'+title+'</h2>'+inner+'</section>',pcOwnerName=()=>'虚构PL',pcStatusLabel=()=>'在用',pcInitials=()=>'PC',moduleRuleDisplay=()=>'Insane',pcRuleIsCoc=()=>false;
 ${logic}
${builder}
return buildPcFullArchiveHtml;`)(escapeHTML,structuredClone);
 const p=fixture();const original=JSON.stringify(p);const out=await maker(p);
 assert.match(out,/未命名字段 1/);assert.match(out,/未命名字段 3/);
 assert.match(out,/末尾说明：第1199行/);assert.match(out,/长说明/);
 assert.match(out,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(out,/<script>alert\(1\)<\/script>/);
 assert.match(out,/rule-public-detail/);assert.equal(JSON.stringify(p),original);
});
