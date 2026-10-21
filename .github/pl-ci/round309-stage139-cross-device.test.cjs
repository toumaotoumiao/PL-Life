'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const st=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const part=(a,b)=>{let i=html.indexOf(a),j=html.indexOf(b,i+1);assert.ok(i>=0&&j>i,`${a} missing`);return html.slice(i,j)};
const css=part('<style id="stage139CrossDeviceReadability">','</style>');
const month=part('function plannerMonthHTML() {','function plannerWeekHTML() {');
const week=part('function plannerWeekHTML() {','function mutateRunPlan(');
const cardPL=part('function compactRowHTML(p) {','function cardHTML(p) {');
const cardPC=part('function pcCardHTML(pc) {','function pcCompactRowHTML(pc) {');
const cardPCL=part('function pcCompactRowHTML(pc) {','let pcQueryRuntime=');
const moduleCard=part('const primaryTags=tags.slice(0,3)','const noteText=String(m.notes');
test('stage139 version, schema and explicit pending real-device state stay truthful',()=>{
 const release=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json')));
 assert.ok(st.current.stage>=139);assert.equal(st.current.appVersion,release.appVersion);
 assert.equal(st.current.schemaVersion,26);assert.equal(st.currentVersionAcceptance.realDevice.state,'targeted-checks-pending');
 assert.equal(st.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
});
test('calendar compact mode gives 42 named date actions with early/noon/evening counts',()=>{
 const d=new Date(2026,9,20),ctx={
 plannerMonthCursor:d,plannerSelectedDate:'2026-10-20',plannerMonthCompact:true,
 parseLocalISODate:x=>x instanceof Date?x:new Date(x+'T12:00:00'),
 localISODate:x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`,
 startOfLocalWeek:()=> '2026-10-19',
 plannerDisplaySlots:iso=>iso==='2026-10-20'?[
 {slot:{daypart:'morning'},plan:{moduleName:'Long module'}},
 {slot:{daypart:'evening'},plan:{moduleName:'Another module'}}
 ]:[],
 PLAN_DAYPARTS:[{key:'morning',label:'早'},{key:'noon',label:'中'},{key:'evening',label:'晚'}],
 slotDaypart:x=>x.daypart,compactDaypartRoleClass:()=> 'role-pl',MAX_RUNS_PER_DAYPART:4,
 planSelfRoleInfo:()=>({className:'role-pl'}),daypartInfo:()=>({label:'早'}),escapeHTML:x=>String(x)};
 vm.runInNewContext(month,ctx);
 const rendered=ctx.plannerMonthHTML();
 assert.equal((rendered.match(/data-calendar-day="/g)||[]).length,42);
 assert.equal((rendered.match(/aria-pressed="/g)||[]).length,43); // 42 dates + month toggle
 assert.match(rendered,/2026-10-20，2 桌安排；早1桌，中0桌，晚1桌/);
 assert.match(rendered,/data-calendar-day="2026-10-20" aria-pressed="true"/);
  assert.match(month,/iso === today \? 'aria-current="date"'/, 'today annotation follows actual date, not selected October 2026 fixture');
 assert.match(rendered,/data-month-shift="-1" aria-label="上一个月"/);
 assert.match(rendered,/data-month-shift="1" aria-label="下一个月"/);
 assert.match(rendered,/data-toggle-month-compact aria-pressed="true"/);
});
test('expanded month retains 42 selectable day buttons and selected state',()=>{
 const d=new Date(2026,9,20),ctx={
 plannerMonthCursor:d,plannerSelectedDate:'2026-10-20',plannerMonthCompact:false,
 parseLocalISODate:x=>x instanceof Date?x:new Date(x+'T12:00:00'),
 localISODate:x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`,
 startOfLocalWeek:()=> '2026-10-19',plannerDisplaySlots:()=>[],
 PLAN_DAYPARTS:[{key:'morning',label:'早'},{key:'noon',label:'中'},{key:'evening',label:'晚'}],
 slotDaypart:x=>x.daypart,compactDaypartRoleClass:()=>'',MAX_RUNS_PER_DAYPART:4,
 planSelfRoleInfo:()=>({className:''}),daypartInfo:()=>({label:'早'}),escapeHTML:x=>String(x)};
 vm.runInNewContext(month,ctx);
 const rendered=ctx.plannerMonthHTML();
 assert.equal((rendered.match(/data-calendar-day="/g)||[]).length,42);
 assert.match(rendered,/data-calendar-day="2026-10-20" aria-pressed="true"/);
 assert.match(rendered,/data-toggle-month-compact aria-pressed="false"/);
});
test('week selected date and today are distinguishable to assistive technology',()=>{
 assert.match(week,/aria-pressed="\$\{iso === plannerSelectedDate \? "true" : "false"\}"/);
 assert.match(week,/aria-current="date"/);
 assert.match(week,/查看当天安排/);
});
test('PL extra metadata is accessible without exposing profile name in the additional summary',()=>{
 assert.match(cardPL,/aria-label="展开或收起 PL 补充资料"/);
 assert.match(cardPL,/sensitiveHTML\(`备注：\$\{p\.profileRemark\}`/);
 assert.match(cardPL,/profileSecondaryActionsHTML\(p\)/);
});
test('PC card and portrait list use equivalent accessible extra metadata entry',()=>{
 for(const src of [cardPC,cardPCL]) assert.match(src,/aria-label="展开或收起 PC 补充资料，\$\{extraMeta\.length\} 项"/);
 assert.match(cardPC,/pcCardStats\(pc,5\)/);
 assert.match(cardPCL,/pcCardStats\(pc,3\)/);
});
test('plan and record summary disclose only secondary metadata in clearly named controls',()=>{
 assert.match(html,/class="card-extra-facts plan-list-extra"[^\n]{0,250}aria-label="展开或收起计划补充信息，\$\{supplemental\.length\} 项"/);
 assert.match(html,/class="card-extra-facts record-summary-extra"[^\n]{0,250}aria-label="展开或收起跑团记录补充信息，\$\{extra\.length\} 项"/);
 for(const kind of ['.plan-list-extra>summary:focus-visible','.record-summary-extra>summary:focus-visible'])
   assert.ok(css.includes(kind),kind);
});
test('module extra facts preserve every tag and 3 primary summary tags',()=>{
 assert.match(moduleCard,/const primaryTags=tags\.slice\(0,3\),extraTags=tags\.slice\(3\)/);
 assert.match(moduleCard,/aria-label="展开或收起模组补充资料，\$\{extraTags\.length\} 项"/);
});
test('readability changes stay scoped to UI and keep responsive month grid',()=>{
 assert.match(css,/--ui-readable-label:12px/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/\.month-calendar\.compact \.month-mini-parts i\{height:5px\}/);
 assert.doesNotMatch(css,/display:none!important/);
 assert.ok(html.includes('grid-template-columns:repeat(7,minmax(0,1fr))'));
});
test('all eight required viewport categories have active CSS branches',()=>{
 for(const x of ['max-width:320px','min-width:321px','max-width:375px','min-width:376px','max-width:430px',
 'min-width:431px','max-width:768px','min-width:769px','max-width:1024px','min-width:1025px',
 'max-width:1280px','min-width:1281px','max-width:1440px']) assert.ok(css.includes(x),x);
});
test('keyboard and reduced-motion behavior is present on detail and calendar controls',()=>{
 for(const s of ['.card-extra-facts>summary:focus-visible','.week-day-head-cell:focus-visible',
 '.month-calendar .month-day[aria-pressed="true"]','@media(prefers-reduced-motion:reduce)'])assert.ok(css.includes(s),s);
});
test('help retains simple journey, local-only storage warning and backup link',()=>{
 const a=part('<details class="hero-help"','<div aria-live="polite" class="autosave-status-chip"');
 assert.equal((a.match(/class="guide-item"/g)||[]).length,3);
 for(const step of ['建档','安排','归档'])assert.ok(a.includes(`<strong>${step}</strong>`));
 assert.ok(a.includes('档案保存在本机'));
 assert.ok(a.includes('导出完整备份 ZIP'));
 assert.ok(a.includes('class="hero-help-extra"'));
});
test('test-site workflow continues to retain all preexisting usability and safety guards',()=>{
 const p=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 for(const tag of ['round305','round307','round308'])assert.ok(p.includes(tag),tag);
 assert.ok(p.includes('round309-stage139-cross-device.test.cjs'));
});
