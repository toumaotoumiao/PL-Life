'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const marker='<script id="module-archive-table-image-v160">';
const start=html.indexOf(marker),end=html.indexOf('</script>',start);
assert.ok(start>=0&&end>start,'模组表格图片导出脚本必须存在');
const source=html.slice(start+marker.length,end);
function mockSurface(){
  const events=[];
  const canvas={width:1,height:1,getContext(){return ctx;}};
  const ctx={canvas,fillStyle:'',font:'',textBaseline:'',textAlign:'left',lineWidth:1,strokeStyle:'',
    measureText(t){return{width:[...String(t)].reduce((sum,ch)=>sum+(ch.charCodeAt(0)>255?16:9),0)};},
    fillText(text,x,y){events.push({text:String(text),x,y});},
    fillRect(){},scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  canvas.events=events;return canvas;
}
function makeContext({samples,filtered=samples,privacy=false,share=false,pref=null}={}){
  const store=new Map(),window={},listeners=[];
  if(pref)store.set('pl_module_archive_table_image_options_v1',JSON.stringify(pref));
  const env={window,document:{addEventListener:(name,fn)=>listeners.push({name,fn}),createElement:(name)=>{assert.equal(name,'canvas');return mockSurface();}},
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,val)},
    modules:samples||[],runRecords:[],shareModeEnabled:share,privacyMaskEnabled:privacy,
    moduleQueryArchive:()=>({rawRows:filtered||samples}),selfProfileId:()=> 'owner',
    moduleRuleDisplay:rule=>rule?.label||'CoC · 7版',
    moduleComputedScore:m=>m.score??null,
    buildNativeModuleCardIndex:mods=>new Map(mods.map(m=>[String(m.id),{kp:m.kp||0,pl:m.pl||0}])),
    i18nCompareText:(a,b)=>String(a).localeCompare(String(b),'zh'),
    canvasWrapLines:(ctx,text,w)=>{const raw=String(text||'').replace(/\r/g,'');if(!raw)return[];const out=[];for(const p of raw.split('\n')){if(!p){out.push('');continue;}let line='';for(const ch of [...p]){const next=line+ch;if(line&&ctx.measureText(next).width>w){out.push(line);line=ch;}else line=next;}if(line)out.push(line);}return out;},
    createContinuousExportSurface:(w,h,s=1.5)=>{const scale=Math.min(s,16384/w,16384/h,Math.sqrt(67108864/(w*h)));if(scale<.7)throw Error('画布超过安全大小');const canvas=mockSurface();canvas.width=Math.floor(w*scale);canvas.height=Math.floor(h*scale);return{canvas,ctx:canvas.getContext('2d'),scale};},
    sensitiveImageExportButton:()=>false,console};
  vm.runInNewContext(source,env,{filename:'module-archive-table-image-v160.js'});
  return{api:window.PLModuleArchiveTableExport,env,store};
}
test('模组档案桌面与手机工具均有图片出口，并接入同一操作',()=>{
  assert.match(html,/data-module-tool="image-export"/);
  assert.match(html,/data-mobile-module-tool="image-export"/);
  assert.match(html,/action === "image-export"\) return Boolean\(window\.PLModuleArchiveTableExport\?\.open\(\)\)/);
  assert.match(html,/PLUnifiedExportPreview\(pages/);
});
test('导出图片列固定为名称、规则、备注、评分和KP／PL次数',()=>{
  const samples=[{id:'1',name:'同名模组',ruleMeta:{label:'CoC7'},notes:'第一条点评',score:4.6,kp:3,pl:1},
    {id:'2',name:'同名模组',ruleMeta:{label:'D&D5e'},notes:'第二条点评',score:2.3,kp:0,pl:2}];
  const {api}=makeContext({samples});
  const pages=api.buildPages();assert.equal(pages.length,1);
  const texts=pages[0].events.map(e=>e.text);
  for(const text of ['模组名','模组规则','备注','评分','游玩次数','CoC7','D&D5e','第一条点评','第二条点评','4.6','2.3','KP：3次','PL：1次','KP：0次','PL：2次'])assert.ok(texts.includes(text),text);
  assert.equal(texts.filter(x=>x==='同名模组').length,2,'同名不同规则不得合并');
});
test('当前筛选只导出匹配档案，全部选项恢复所有档案',()=>{
  const samples=[{id:'1',name:'甲',notes:'',score:null},{id:'2',name:'乙',notes:'',score:null}];
  const {api}=makeContext({samples,filtered:samples.slice(0,1)});
  assert.ok(api.buildPages()[0].events.some(e=>e.text==='共 1 个模组 · 模组名 / 规则 / 备注 / 评分 / KP 与 PL 次数'));
  const {api:all}=makeContext({samples,filtered:samples.slice(0,1),pref:{scope:'all'}});
  const full=all.buildPages()[0].events.map(e=>e.text);
  assert.ok(full.includes('甲')&&full.includes('乙'));
  const {api:shared}=makeContext({samples,filtered:samples.slice(0,1),pref:{scope:'all'},share:true});
  assert.ok(!shared.buildPages()[0].events.some(e=>e.text==='乙'),'分享模式必须限制为当前可见模组');
});
test('超长备注自动跨页，不丢字符，五列标题每页重复',()=>{
  const notes='记录ABCD你好世界'.repeat(1800);
  const sample={id:'1',name:'特别长的模组档案',ruleMeta:{label:'CoC · 7版'},notes,score:4.4,kp:2,pl:5};
  const {api}=makeContext({samples:[sample]});
  const pages=api.buildPages();assert.ok(pages.length>=2,`应分页：${pages.length}`);
  const reconstructed=pages.flatMap(p=>p.events).filter(e=>e.x===478&&e.y>=164).map(e=>e.text).join('');
  assert.equal(reconstructed,notes,'备注跨页不遗漏');
  for(const page of pages){
    assert.ok(page.width<=9000&&page.height<=9000,'分页画布不能超过安全尺寸');
    for(const header of ['模组名','模组规则','备注','评分','游玩次数'])assert.ok(page.events.some(e=>e.text===header),header);
  }
});
test('隐私模式隐藏备注但保留表头、评分和次数',()=>{
  const {api}=makeContext({samples:[{id:'1',name:'私密',notes:'不可出现的私密文字',score:3.5,kp:2,pl:4}],privacy:true});
  const texts=api.buildPages().flatMap(p=>p.events.map(e=>e.text));
  assert.ok(!texts.some(t=>t.includes('不可出现的私密文字')));
  for(const value of ['备注','私密','3.5','KP：2次','PL：4次'])assert.ok(texts.includes(value),value);
});
