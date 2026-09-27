'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const between=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`missing ${a}`);return html.slice(i,j);};
const source=fs.readFileSync(path.join(root,'record-group.js'),'utf8')+'\n'+between('function statsModuleAggregates(runs) {','function statsCurrentPlanSummary() {')+'\n'+between('function statsModuleRowsHTML(rows,mode,view,displayMode="partial") {','function statsPeriodKey(')+'\n'+between('function openStatsModuleRecordGroup(groupKey,moduleId,moduleName){','document.addEventListener("click", e => {');
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>body{margin:0!important}main{box-sizing:border-box;width:100%;max-width:960px;margin:auto;padding:12px}.stats-panel{width:100%;min-width:0}#table,#bars{width:100%;min-width:0}</style><main><section class="stats-panel"><div id="table"></div><div id="bars"></div><div id="group"></div><div id="notice"></div></section></main>`;
const setup=`const modules=[{id:'co-id',name:'同名模组',ruleMeta:{systemId:'coc'}},{id:'br-id',name:'同名模组',ruleMeta:{systemId:'brp-generic'}}];
const runRecords=[{id:'co-run',moduleId:'co-id',moduleName:'同名模组'},{id:'br-run',moduleId:'br-id',moduleName:'同名模组'},{id:'old-run',moduleId:'missing-id',moduleName:'同名模组'},{id:'legacy-run',moduleId:'',moduleName:'同名模组'}];
const escapeHTML=s=>String(s||''),statsRunRoles=()=>({kp:true,pl:false}),statsRecordDate=()=> '2026-09-01',statsParticipantRefs=()=>[],statsKpRef=()=>null;
function moduleById(id){return modules.find(m=>m.id===id)||null;}
function moduleRuleDisplay(meta){return meta.systemId==='coc'?'CoC · 第七版':'BRP 通用';}
function normalizedEntityNameKey(s){return String(s||'').trim().toLowerCase();}
function i18nCompareText(a,b){return String(a).localeCompare(String(b));}
function statsFormatDate(){return '2026.09.01';}function statsVisibleCountNote(){return '';}
const STATS_PANEL_PARTIAL_LIMITS={modules:10};let selectedRecordGroupKey='',selectedModuleName='',recordSpotlightId='';
const groups=window.PLRecordGroups.group(runRecords,modules).map(g=>[g.label,g.records,0,g.records.length,null,g.key,g.name,g.moduleId,g.ambiguous]);
function groupedRunRecordsForDisplay(){return groups;}const idSet=new Set(['co-run']);function recordQueryArchive(){return{idSet};}
function switchView(v){document.body.dataset.view=v;}function renderRunRecords(){document.getElementById('group').textContent=selectedRecordGroupKey+(recordSpotlightId?' · 临时查看 '+recordSpotlightId:'');}function showToast(x){document.getElementById('notice').textContent=x;}
const rows=statsModuleAggregates(runRecords);document.getElementById('table').innerHTML=statsModuleRowsHTML(rows,'all','rank','all');document.getElementById('bars').innerHTML=statsModuleRowsHTML(rows,'all','bar','all');
document.addEventListener('click',e=>{const btn=e.target.closest('[data-stats-module]');if(btn)openStatsModuleRecordGroup(btn.dataset.statsModuleGroupKey||'',btn.dataset.statsModule||'',btn.dataset.statsModuleName||'');});
window.round155={rows:rows.map(r=>({key:r.groupKey,name:r.displayName,moduleId:r.moduleId})),state:()=>({selectedRecordGroupKey,recordSpotlightId})};`;
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
try{for(const [width,height] of [[1440,900],[390,844],[320,680]]){const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{await page.setContent(fixture);await page.evaluate(code=>(0,eval)(code),source+'\n'+setup);
const data=await page.evaluate(()=>({rows:window.round155.rows,overflow:document.documentElement.scrollWidth-innerWidth,count:document.querySelectorAll('#table [data-stats-module-group-key]').length}));
assert.deepEqual(errors,[]);assert.equal(data.rows.length,4);assert.equal(data.count,4);assert(data.overflow<=1,JSON.stringify(data));
assert.equal(data.rows[2].key,'missing:missing-id');assert.equal(data.rows[2].moduleId,'');
await page.locator('#table [data-stats-module-group-key="id:br-id"]').click({force:true});assert.deepEqual(await page.evaluate(()=>window.round155.state()),{selectedRecordGroupKey:'id:br-id',recordSpotlightId:'br-run'});
await page.locator('#bars [data-stats-module-group-key="id:co-id"]').click({force:true});assert.deepEqual(await page.evaluate(()=>window.round155.state()),{selectedRecordGroupKey:'id:co-id',recordSpotlightId:''});
console.log(`Round155 ${width}x${height}: per-rule labels, exact click target, filter preservation and no horizontal overflow PASS`);
}catch(err){const dir=process.env.PL_SYNTHETIC_REPORT_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`round155-${width}x${height}-failure.png`)});}throw err;}finally{await page.close();}}}finally{await browser.close();}})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
