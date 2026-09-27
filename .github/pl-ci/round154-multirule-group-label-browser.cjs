'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const between=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`missing ${a}`);return html.slice(i,j);};
const ruleSource=between('const TRPG_RULE_FAMILIES=','let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();')+'\n'+between('function defaultModuleRuleMeta(','function normalizeModuleRating(');
const groupedSource=between('function groupedRunRecordsForDisplay(){',"let selectedRecordGroupKey='';");
const recordSource=fs.readFileSync(path.join(root,'record-group.js'),'utf8');
const setup=`${recordSource}\n${ruleSource}\nconst modules=[{id:'coc-seven',name:'同名模组',ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e'}},{id:'brp-general',name:'同名模组',ruleMeta:{familyId:'brp',systemId:'brp-generic',editionId:''}}];
const runRecords=[{id:'one',moduleId:'coc-seven',moduleName:'同名模组'},{id:'two',moduleId:'brp-general',moduleName:'同名模组'}];
function moduleById(id){return modules.find(m=>m.id===id)||null;}
function compareRunChronology(a,b){return a.id.localeCompare(b.id);}
${groupedSource}
const groups=groupedRunRecordsForDisplay();document.getElementById('sidebar').innerHTML=groups.map(g=>'<button class="module-tab"><span class="module-tab-name">'+g[0]+'</span><span class="module-tab-count">'+g[3]+' 桌</span></button>').join('');
window.__round154={labels:groups.map(g=>g[0]),keys:groups.map(g=>g[5]),ambiguous:groups.map(g=>g[8])};`;
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0"><main style="box-sizing:border-box;width:min(100%,800px);padding:12px"><aside id="sidebar" class="module-sidebar"></aside></main></body>`;
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
try{for(const [width,height] of [[1440,900],[390,844],[320,680]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{await page.setContent(fixture);await page.evaluate(`(()=>{${setup}})()`);
 const x=await page.evaluate(()=>({data:window.__round154,overflow:document.documentElement.scrollWidth-innerWidth,sidebar:{right:document.getElementById('sidebar').getBoundingClientRect().right,scrollWidth:document.getElementById('sidebar').scrollWidth,clientWidth:document.getElementById('sidebar').clientWidth,overflowX:getComputedStyle(document.getElementById('sidebar')).overflowX},rects:[...document.querySelectorAll('.module-tab')].map(e=>({width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height}))}));
 assert.deepEqual(errors,[]);assert.equal(x.data.labels.length,2);assert(x.data.labels.some(s=>s.includes('CoC')));assert(x.data.labels.some(s=>s.includes('BRP')));assert.notEqual(x.data.keys[0],x.data.keys[1]);assert(x.data.ambiguous.every(Boolean));assert(x.overflow<=1,JSON.stringify(x));assert(x.sidebar.right<=width+1,JSON.stringify(x));assert(x.rects.every(r=>r.width>=80&&r.height>=42),JSON.stringify(x));assert(x.rects.every(r=>r.right<=width+1)||x.sidebar.overflowX==='auto',JSON.stringify(x));
 console.log(`Round154 ${width}x${height}: separated CoC/BRP labels, no overflow, usable row PASS`);
 }catch(err){const dir=process.env.PL_SYNTHETIC_REPORT_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`round154-${width}x${height}-failure.png`)});}throw err;}finally{await page.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
