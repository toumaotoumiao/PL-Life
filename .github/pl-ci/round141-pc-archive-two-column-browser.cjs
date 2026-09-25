'use strict';
// Synthetic PC fixture only. The PC exporter functions are extracted verbatim from current index.html.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('  function pcArchiveTextLines(ctx,text,maxW,maxLines=999');
const end=html.indexOf('  function modulePersonName(',start);
assert.ok(start>=0&&end>start,'missing PC full archive renderer');
const code=html.slice(start,end);
const stubCode="\nlet panelCalls=[];\nconst PC_BACKGROUND_KEYS=['description','traits'];\nconst privacyMaskEnabled=false;\nconst canvasWrapLines=(ctx,text,maxW)=>{const result=[];let current='';for(const ch of Array.from(String(text||''))){if(current&&ctx.measureText(current+ch).width>maxW){result.push(current);current='';}current+=ch;}if(current||!result.length)result.push(current);return result;};\nfunction canvasFillRound(ctx,x,y,w,h,rad,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,rad);ctx.fillStyle=fill||'#fff';ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}\nfunction canvasTextFit(ctx,value,maxW){let s=String(value||'');while(s.length>1&&ctx.measureText(s).width>maxW)s=s.slice(0,-2)+'…';return s;}\nfunction theme(){return{bg:'#f4f7f5',surface:'#fff',surface2:'#f1f6f3',line:'#d9e3dc',ink:'#283d30',text2:'#55655b',muted:'#697b6d',accent:'#476950'};}\nfunction makeCanvas(w,h,scale=2){const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const ctx=c.getContext('2d');ctx.scale(scale,scale);return{canvas:c,ctx};}\nfunction panel(ctx,x,y,w,h,t,title,subtitle=''){panelCalls.push({title,x,y,w,h});canvasFillRound(ctx,x,y,w,h,15,t.surface,t.line);canvasFillRound(ctx,x+16,y+15,4,22,2,t.accent,'');ctx.fillStyle=t.ink;ctx.font='800 18px system-ui,sans-serif';ctx.fillText(canvasTextFit(ctx,title,w-54),x+29,y+33);if(subtitle){ctx.fillStyle=t.muted;ctx.font='550 10.5px system-ui,sans-serif';ctx.fillText(canvasTextFit(ctx,subtitle,w-54),x+29,y+53);}return y+(subtitle?72:58);}\nfunction header(ctx,W,t,eyebrow,title,subtitle,stats=[]){canvasFillRound(ctx,34,24,W-68,138,15,t.surface,t.line);ctx.fillStyle=t.ink;ctx.font='bold 31px system-ui';ctx.fillText(title,55,89);ctx.fillStyle=t.muted;ctx.font='13px system-ui';ctx.fillText(String(subtitle),55,116);return 180;}\nfunction footer(ctx,W,H,t){ctx.fillStyle=t.muted;ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('PL 收集梦想生活',W/2,H-15);ctx.textAlign='left';}\nfunction pcCardTimeText(){return '';}\nfunction pcStatusLabel(){return '在役';}\nfunction pcTimelineRows(){return [];}\nfunction entityPcSnapshots(){return [];}\nfunction entityPcSnapshotHasData(){return false;}\nfunction createContinuousExportSurface(w,h,scale=1.35){if(w*scale>16000||h*scale>16000)throw Error('too long');const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);return{canvas,ctx};}\nfunction drawUnifiedExportFooter(ctx,w,y,t){footer(ctx,w,y,t);}\nfunction testPc(n=14){return{name:'示例角色',alias:'Alias',era:'1920s',occupation:'音乐家',age:26,gender:'女',residence:'瑞士',birthplace:'瑞士',coc:{str:50,con:55,siz:75,dex:80,app:50,int:70,pow:50,edu:70,luck:70,hp:13,hpMax:13,san:50,sanMax:50,mp:10,mpMax:10,armor:0,db:'+1D4',build:1,mov:8},skills:Array.from({length:n},(_,i)=>({name:i===0?'名称很长需要自动换行的技能名称':`技能${i+1}（示例）`,value:25+i})),background:{description:'用于检查短内容布局和面板间距。',traits:'以音乐为职业。'},inventory:'小提琴、乐谱和手稿。',assets:'少量现金、储蓄和旅行票据。',notes:'',weapons:[]};}\nfunction renderFixture(density='compact',n=14,long=false){panelCalls=[];const pc=testPc(n),state={density,selected:['archive'],order:['archive'],showOwner:false,showHo:true,showExactDates:true};let canvas;if(long){canvas=entityContinuousLongCanvas('pc',pc,state,[]);}else{canvas=pcFullArchiveImageCanvases(pc,state)[0];}document.querySelector('#preview').replaceChildren(canvas);window.__result={density,n,long,panels:panelCalls,width:canvas.width,height:canvas.height,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};return window.__result;}\n";
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.setContent('<!doctype html><html><head><style>html,body{margin:0}#preview{max-width:100%;overflow:auto}canvas{max-width:100%;height:auto}</style></head><body><main id="preview"></main></body></html>');
  await page.addScriptTag({content:stubCode+'\n'+code});
  for(const density of ['compact','standard','relaxed']){
   const result=await page.evaluate(d=>renderFixture(d,14,false),density);
   const stats=result.panels.find(p=>p.title==='CoC7 数值');
   const skills=result.panels.find(p=>p.title.startsWith('技能'));
   assert.ok(stats&&skills,`${width} ${density}: missing panels`);
   if(density==='relaxed')assert.ok(stats.y<skills.y,`${width}: relaxed should stay stacked`);
   else{assert.equal(stats.y,skills.y,`${width} ${density}: two panels must share row`);assert.equal(stats.x+stats.w+12,skills.x,`${width} ${density}: panel gap`);}
   assert.deepEqual(errors,[],`${width} ${density}: runtime errors`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}: horizontal overflow`);
   console.log('ROUND141_PC_EXPORT',JSON.stringify({width,density,statsY:stats.y,skillY:skills.y,canvas:result.width+'x'+result.height}));
  }
  const more=await page.evaluate(()=>renderFixture('compact',29,true));
  assert.ok(more.panels.find(p=>p.title==='技能（续页）'),`${width}: skill overflow continuation missing`);
  assert.deepEqual(errors,[],`${width}: long export page error`);
  await page.close();
 }
} catch(e){console.error(e.stack||e);process.exitCode=1;} finally{if(browser)await browser.close();}})();
