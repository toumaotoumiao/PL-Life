'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const active=html.replace(/<details class="version-history-details"[\s\S]*?<\/details>/g,'').split('\n').filter(line=>!line.includes('"legacy.exact.')&&!line.includes('"legacy.pattern.')).join('\n');
const scope=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing source range: ${start}`);return html.slice(a,b);};
const compile=(start,end,context,name)=>vm.runInNewContext(`${scope(start,end)};${name}`,context,{timeout:1000});

test('statistics page and canvas state measured results without implementation assurances',()=>{
 const phrases=['重复跑同一模组不会被错误连成一条长线','日期格直接显示模组简称与 K / P 身份；包括','导出图片时也会自动分页展示全部场次','完整导出时将支持自动分页，不会丢掉后续桌次','当前年度尚未记录具体开始时间；时段统计仍按'];
 for(const p of phrases)assert(!active.includes(p),`obsolete explanatory copy: ${p}`);
 assert.match(active,/统计范围|statsRangeSelect/);
 assert.match(active,/逐桌时间带/);
 assert.match(active,/跑团时间分布/);
 assert.match(active,/一行一桌；线段为日期跨度，圆点为实际场次/);
 assert.match(active,/同日多场计 1 天/);
});

test('footprint count is concise and full list does not carry a redundant export note',()=>{
 const f=compile('function statsFootprintHTML(', 'function statsExportRoleColors(',{
  statsUiState:{footprintMode:'partial'},privacyMaskEnabled:false,escapeHTML:String,
  statsEventTimeLabel:()=>'',statsEventRoleLabel:()=>''
 },'statsFootprintHTML');
 const events=Array.from({length:42},(_,i)=>({date:`2026-09-${String(i%28+1).padStart(2,'0')}`,startTime:'19:00',moduleName:`合成模组${i}`,archived:true}));
 const partial=f(events,24,'partial'),full=f(events,24,'all'),small=f(events.slice(0,3),24,'partial');
 assert.match(partial,/已显示 24 \/ 42 场/);assert.doesNotMatch(partial,/导出图片时|不会丢掉/);
 assert.equal((full.match(/stats-footnote/g)||[]).length,0);
 assert.equal((small.match(/stats-footnote/g)||[]).length,0);
});

test('time distribution states recorded clock ranges and unknown-time result without padding copy',()=>{
 const f=compile('function statsTimeHabitsHTML(', 'function statsFootprintHTML(',{escapeHTML:String},'statsTimeHabitsHTML');
 const event={date:'2026-09-23',daypart:'evening'};
 const unknown=f([event]);assert.match(unknown,/暂无具体开始时间/);assert.doesNotMatch(unknown,/时段统计仍按|不对缺失时间进行推测/);
 const known=f([event,{...event,startTime:'19:30'}]);assert.match(known,/高频时段：19:00–20:00（1 场）/);
});

test('timeband reports count without promising an unrelated export behavior',()=>{
 const spans=Array.from({length:33},(_,i)=>({start:'2026-01-01',end:'2026-02-02',moduleName:`合成${i}`,tableName:'',roles:{kp:true,pl:false},archived:true,sessions:1,events:[]}));
 const f=compile('function statsRunTimelineHTML(', 'function statsTimeHabitsHTML(',{
  window:{PLRunEvents:{runSpans:()=>spans}},statsYearDayProgress:()=>20,escapeHTML:String,statsEventTimeLabel:()=>'',statsPanelDisplay:()=> 'partial',statsVisibleCountNote:(shown,total)=>total>shown?`已显示 ${shown} / ${total} 桌。`:''
 },'statsRunTimelineHTML');
 const output=f([],2026);assert.match(output,/已显示 28 \/ 33 桌/);assert.doesNotMatch(output,/不会丢掉后续桌次/);
});

test('public export and data safety copy retain concrete privacy and backup risks',()=>{
 assert.match(active,/公开统计图不含联系方式、黑名单与私人备注/);
 assert.match(active,/请核对预览中的姓名、日期、PC 与 Log/);
 assert.match(active,/浏览器数据或更换设备可能导致丢失/);
 assert.match(active,/清除网站数据/);
 assert.match(active,/内容没有因本次临时草稿清理失败而撤销|正式保存不会因本次临时草稿清理失败而撤销/);
 assert.match(active,/statsExportState/);assert.match(active,/buildStatsContinuousCanvas/);
});

test('static copy has no empty narrative containers in primary statistics or preview',()=>{
 const s=scope('function renderStats()', '/* ---------- PC 档案');
 assert.doesNotMatch(s,/<div class="stats-panel-title"><strong>跑团时间分布<\/strong><span><\/span>/);
 assert.doesNotMatch(s,/<div class="stats-footnote"><\/div>/);
 assert.doesNotMatch(active,/<div class="export-composer-rule-note"><\/div>/);
});
