'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const part=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,`missing source ${a}`);return html.slice(i,j)};
const rules=part('function normalizePcRuleData(','function normalizePcArchive(');
const card=part('  async function buildPcRuleShowcaseCardCanvas(pc,state){','  async function buildPcShowcaseCardCanvas(pc,state){');
const page=part('  function pcFullArchiveImageCanvases(pc,state){','  function entityContinuousLongCanvas(');
const fixture=()=>({id:'synthetic',name:'虚构角色',status:'active',era:'现代',occupation:'档案员',ruleMeta:{systemId:'insane'},ruleData:{traits:[],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[{label:'已填技能',value:'65'},{label:'',value:'',detail:'仅公开说明；原样保留'},{label:'',value:'9',detail:''},{label:'空白模板',value:'',detail:''}],resources:[{label:'正气度',detail:'测试描述',value:''}],future:{record:'keep'}}},coc:{san:66},excelEdits:[{sheet:'原卡',ref:'B2',value:'保留'}]});
function runtime(){
 const drawn=[],headings=[],canvas={width:2160,height:2060};
 const ctx={fillText(text){drawn.push(String(text))},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},save(){},restore(){},scale(){}};
 const makeCanvas=(w,h)=>({canvas:{width:w*2,height:h*2},ctx});
 const header=(c,w,t,title,name,subtitle,stats)=>{headings.push({title,name,subtitle,stats});return 176};
 const panel=(c,x,y,w,h,t,title,subtitle)=>{drawn.push(title,subtitle||'');return y+(subtitle?72:58)};
 const logic=rules+'\n'+card+'\n'+page+ '\nreturn {pcRuleFilledCount,pcRuleCurrentData,pcFullArchiveImageCanvases,buildPcRuleShowcaseCardCanvas};';
 const api=new Function('clone','makeCanvas','theme','header','panel','footer','canvasFillRound','canvasTextFit','moduleRuleDisplay','pcRuleIsCoc','pcStatusLabel','pcOwnerProfile','pcOwnerName','publicProfileName','privacyMaskEnabled','pcFullArchiveBlocks',logic)(structuredClone,makeCanvas,()=>({bg:'#fff',muted:'#555',text2:'#333',ink:'#111',line:'#ddd'}),header,panel,()=>{},()=>{},(c,text)=>String(text),m=>m?.systemId||'规则',()=>false,v=>String(v||''),()=>null,()=>'虚构PL',()=>'',false,()=>[{h:40,title:'已填数据',draw(){}}]);
 return {api,drawn,headings};
}
test('Rule card is bounded, clearly labeled summary, and counts detail-only/unnamed rows',async()=>{
 const p=fixture(),unchanged=JSON.stringify(p),{api,drawn,headings}=runtime(),card=await api.buildPcRuleShowcaseCardCanvas(p,{showOwner:false});
 assert.deepEqual([api.pcRuleFilledCount(p,'traits'),api.pcRuleFilledCount(p,'skills'),api.pcRuleFilledCount(p,'resources')],[1,3,1]);
 assert.equal(card.width,2160);assert.ok(card.height>=1520&&card.height<2060);assert.equal(headings[0].title,'PC · 角色简卡');
 assert.ok(drawn.some(s=>s==='展示 3 / 3 项'));assert.ok(drawn.includes('未命名字段 2'));assert.ok(drawn.some(s=>s.includes('仅公开说明')));
 assert.ok(!drawn.includes('空白模板'));assert.equal(JSON.stringify(p),unchanged);
});
test('Full-archive header uses the exact same filled-field count; switching rules preserves stored sheets',()=>{
 const p=fixture(),raw=JSON.stringify(p),{api,headings}=runtime();let canvases=api.pcFullArchiveImageCanvases(p,{density:'standard'});
 assert.equal(canvases.length,1);assert.ok(headings[0].stats.includes('3 项技能'));
 p.ruleMeta.systemId='shinobigami';p.ruleSheets.shinobigami={traits:[],skills:[{label:'特技',value:''}],resources:[]};const other=runtime();other.api.pcFullArchiveImageCanvases(p,{density:'standard'});assert.ok(other.headings[0].stats.includes('0 项技能'));
 p.ruleMeta.systemId='insane';assert.equal(JSON.stringify(p.ruleSheets.insane),JSON.stringify(JSON.parse(raw).ruleSheets.insane));
 assert.equal(p.excelEdits[0].value,'保留');assert.equal(p.coc.san,66);
});
test('Continuous picture header also uses filled counts; CoC7 export remains routed by exact version',()=>{
 const body=part('  function entityContinuousLongCanvas(kind,entity,state,pages){','  async function buildPcPages(pc,state){');
 assert.match(body,/pcRuleFilledCount\(entity,'skills'\)/);
 assert.match(html,/if\(!pcRuleIsCoc\(pc\)\)return buildPcRuleShowcaseCardCanvas\(pc,state\)/);
 assert.ok(html.includes('const adapter=PC_EXCEL_EXPORT_ADAPTERS[`${m.systemId}:${m.editionId}`]'));
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
