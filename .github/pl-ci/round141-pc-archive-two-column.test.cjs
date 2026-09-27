'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function extract(from,to){const i=html.indexOf(from),j=html.indexOf(to,i+from.length);assert.ok(i>=0&&j>i,`missing ${from}`);return html.slice(i,j);}
const block=extract('  function pcArchiveTextLines(ctx,text,maxW,maxLines=999', '  function pcFullArchiveImageCanvases(pc,state){');
function fixture(density='compact',count=14){
 const panels=[],drawn=[],ctx={font:'',fillStyle:'',strokeStyle:'',textAlign:'left',measureText(text){return{width:Array.from(String(text)).length*6.5};},fillText(value,x,y){drawn.push({value:String(value),x,y});},beginPath(){},moveTo(){},lineTo(){},stroke(){},save(){},restore(){}};
 const data={str:50,con:55,siz:75,dex:80,app:50,int:70,pow:50,edu:70,luck:70,hp:13,hpMax:13,san:50,sanMax:50,mp:10,mpMax:10,armor:0,db:'+1D4',build:1,mov:8};
 const scope={pcRuleIsCoc:()=>true,document:{createElement:()=>({getContext:()=>ctx})},PC_BACKGROUND_KEYS:[],privacyMaskEnabled:false,canvasWrapLines:(context,text,maxW)=>{
  const out=[];let line='';for(const char of Array.from(String(text))){if(line&&context.measureText(line+char).width>maxW){out.push(line);line='';}line+=char;}if(line||!out.length)out.push(line);return out;
 },canvasFillRound:()=>{},canvasTextFit:(_,s)=>String(s),pcCardTimeText:()=>'',pcStatusLabel:()=>'',pcTimelineRows:()=>[],entityPcSnapshots:()=>[],entityPcSnapshotHasData:()=>false,
 theme:()=>({surface:'#fff',surface2:'#eee',line:'#ccc',muted:'#777',ink:'#222',text2:'#444',accent:'#486'}),
 panel:(context,x,y,w,h,t,label)=>{panels.push({x,y,w,h,label});return y+58;}
 };
 vm.createContext(scope);vm.runInContext(block+'\nthis.blocksFor=pcFullArchiveBlocks;',scope);
 const skills=Array.from({length:count},(_,i)=>({name:i===0?'名称较长的技能／需要换行的名称／验证完整显示':`技能${i+1}`,value:25+i}));
 const pc={name:'测试角色',coc:data,skills,background:{},weapons:[],inventory:'',assets:'',notes:''};
 const blocks=scope.blocksFor(pc,{density,showOwner:false,showHo:true,showExactDates:true},976);
 return {scope,blocks,ctx,panels,drawn,skills};
}
test('Round141 compact and standard put stats and skills in a single paired row',()=>{
 for(const density of ['compact','standard']){
  const f=fixture(density),pair=f.blocks.find(b=>b.kind==='stats-skills-pair');
  assert.ok(pair,`${density} paired panel missing`);
  assert.equal(f.blocks.filter(b=>b.title==='CoC7 数值'||b.title==='技能').length,0);
  pair.drawPanel(f.ctx,34,194,1012,f.scope.theme());
  assert.deepEqual(f.panels.map(p=>p.label),['CoC7 数值','技能 · 14 项']);
  assert.equal(f.panels[0].y,f.panels[1].y);
  assert.equal(f.panels[0].x+f.panels[0].w+12,f.panels[1].x);
  assert.equal(f.panels[0].h,f.panels[1].h);
  assert.equal(f.drawn.filter(row=>row.value==='50').length>0,true);
  assert.ok(f.drawn.some(row=>row.value==='技能14'));
  assert.ok(f.drawn.some(row=>row.value.includes('验证完整显示')),'long skill must be wrapped, not silently truncated');
  assert.ok(pair.h<480,'combined row should be meaningfully denser than two separate full-width rows');
 }
});
test('Round141 relaxed keeps separate full-width sections',()=>{
 const f=fixture('relaxed');assert.ok(!f.blocks.some(b=>b.kind==='stats-skills-pair'));
 assert.ok(f.blocks.some(b=>b.title==='CoC7 数值'));
 assert.ok(f.blocks.some(b=>b.title==='技能'));
});
test('Round141 overflowing skills continue below without dropping any entry',()=>{
 const f=fixture('compact',29),pair=f.blocks.find(b=>b.kind==='stats-skills-pair');
 assert.ok(pair);pair.drawPanel(f.ctx,34,194,1012,f.scope.theme());
 const continuation=f.blocks.find(b=>b.title==='技能（续页）');assert.ok(continuation);
 continuation.draw(f.ctx,52,194+pair.h+72,976);
 assert.ok(f.drawn.some(row=>row.value==='技能24'));
 assert.ok(f.drawn.some(row=>row.value==='技能29'));
});
test('Round141 same paired block is drawn in paged and semantic continuous exporters',()=>{
 const paged=extract('function pcFullArchiveImageCanvases(pc,state){','  function entityContinuousLongCanvas(kind,entity,state,pages){');
 const continuous=extract('  function entityContinuousLongCanvas(kind,entity,state,pages){','  async function buildPcPages(pc,state){');
 assert.match(paged,/if\(b\.kind==='stats-skills-pair'\)\{b\.drawPanel\(ctx,x,y,w,t\)/);
 assert.match(continuous,/kind==='pc'&&b\.kind==='stats-skills-pair'/);
 assert.match(continuous,/b\.drawPanel\(ctx,x,y,w,t\)/);
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+"/);
});

test('Round141 browser geometry fixture uses real multi-rule gate with explicit CoC7 metadata',()=>{
 const browser=fs.readFileSync(path.join(__dirname,'round141-pc-archive-two-column-browser.cjs'),'utf8');
 assert.match(browser,/const isCocSource=sourceBetween\('function pcRuleIsCoc\(pc\)\{',/);
 assert.match(browser,/const normalizeMetaSource=sourceBetween\('function normalizeModuleRuleMeta/);
 assert.match(browser,/ruleMeta:\{familyId:'brp',systemId:'coc',editionId:'7e'/);
 assert.match(browser,/await page\.addScriptTag\(\{content:stubCode\+/);
 assert.match(browser,/\+normalizeMetaSource\+/);
 assert.match(browser,/\+isCocSource\+/);
});
