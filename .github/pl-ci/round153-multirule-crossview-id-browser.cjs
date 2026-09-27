'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
function between(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start);return html.slice(start,end);}
const ruleSource=between('const TRPG_RULE_FAMILIES=','let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();')+'\n'+between('function defaultModuleRuleMeta(','function normalizeModuleRating(');
const cardSource=between('function currentOrPendingModule(ref) {','function moduleIntentSection(kind, title, desc) {');
const setup=`
function escapeHTML(value){return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));}
${ruleSource}
const modules=[{id:'coc-7',name:'同名模组',ruleMeta:{familyId:'brp',systemId:'coc',editionId:'7e'}},{id:'brp-custom',name:'同名模组',ruleMeta:{familyId:'brp',systemId:'brp-generic',editionId:''}}],selfIntroPendingModules=[];
${cardSource}
document.getElementById('host').innerHTML=modules.map(m=>moduleIntentCard({moduleId:m.id,name:m.name,note:'备注'},'want')).join('');`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body style="margin:0"><main id="host" style="box-sizing:border-box;width:min(100%,740px);margin:auto;padding:12px;display:grid;gap:10px"></main></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PL_CI_CHROMIUM_EXECUTABLE?{executablePath:process.env.PL_CI_CHROMIUM_EXECUTABLE}:{})});
 try{for(const [width,height] of [[1440,900],[390,844],[320,680]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{await page.setContent(fixture);await page.evaluate(`(()=>{${setup}})()`);
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,cards:[...document.querySelectorAll('.intro-module-chip')].map(card=>({label:card.querySelector('small')?.textContent,id:card.querySelector('button')?.dataset.moduleId,aria:card.querySelector('button')?.getAttribute('aria-label'),height:card.querySelector('button')?.getBoundingClientRect().height,width:card.querySelector('button')?.getBoundingClientRect().width,cardRight:card.getBoundingClientRect().right}))}));
   assert.deepEqual(errors,[]);assert.equal(result.cards.length,2);assert(result.overflow<=1,`${width}px overflow: ${JSON.stringify(result)}`);
   assert(result.cards[0].label.includes('CoC')&&result.cards[1].label.includes('BRP'));
   assert(result.cards.every(c=>c.height>=42&&c.width>=42&&c.cardRight<=width+1));
   assert.notEqual(result.cards[0].id,result.cards[1].id);assert(result.cards.every(c=>c.aria.includes('同名模组')));
   console.log(`Round153 ${width}x${height}: two distinct rule cards, 42px buttons, no overflow PASS`);
  }catch(err){const dir=process.env.PL_SYNTHETIC_REPORT_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,`round153-${width}x${height}-failure.png`)});}throw err;}finally{await page.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
