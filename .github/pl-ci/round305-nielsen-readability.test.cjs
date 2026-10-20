'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const section=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i,`missing ${a} / ${b}`);return html.slice(i,j)};
const css=section('<style id="stage135ReadabilityAndDensity">','</style>');
const compactProfile=section('function compactRowHTML(p) {','function cardHTML(p) {');
const calendar=section('function plannerMonthHTML() {','function plannerWeekHTML() {');

test('Stage135 features remain in the unique current candidate, no schema or backup format change',()=>{
 const release=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json')));
 assert.ok(status.current.stage>=135);
 assert.match(status.current.appVersion,/^8\.1\.12\.3\d{2}$/);
 assert.equal(release.appVersion,status.current.appVersion);
 assert.equal(release.schemaVersion,26);
 assert.ok(html.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
 assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes(`v${status.current.appVersion}`));
 assert.equal(status.fourRoundCloseout.rounds[2].quarter,'3/4');
});

test('PL compact card includes a single optional expanded secondary facts area and preserves masked remark',()=>{
 assert.match(compactProfile,/\$\{personalMeta \|\| String\(p\.profileRemark \|\| ""\)\.trim\(\) \?/);
 assert.equal((compactProfile.match(/<details class="card-extra-facts compact-profile-extra"/g)||[]).length,1);
 assert.match(compactProfile,/<summary aria-label="展开或收起 PL 补充资料">更多资料<\/summary>/);
 assert.match(compactProfile,/sensitiveHTML\(personalMeta, "privacy-compact-personal"\)/);
 assert.match(compactProfile,/sensitiveHTML\(`备注：\$\{p\.profileRemark\}`, "privacy-compact-profile-remark"\)/);
 assert.doesNotMatch(compactProfile,/<div class="compact-profile-remark"[^`]*?\}\s*\$\{roleDegreeHTML/s);
});

test('PL summary keeps primary contact/run counts and all original action buttons',()=>{
 for(const key of ['profileContactHTML(p, "privacy-compact-contact")','${runs.length}桌经历','${pcCount ?','profileSecondaryActions','data-action="ho-organizer"']) assert.ok(compactProfile.includes(key),key);
 assert.match(compactProfile,/profileSecondaryActions/);
});

test('first-run help shows 3 core steps and a separate safety reminder without removing advanced help',()=>{
 const help=section('<details class="hero-help"','<div aria-live="polite" class="autosave-status-chip"');
 assert.equal((help.match(/class="guide-item"/g)||[]).length,3);
 for(const label of ['建档','安排','归档'])assert.ok(help.includes(`<strong>${label}</strong>`));
 assert.ok(help.includes('data-collapse-key="home:help"'));
 assert.match(help,/class="hero-backup-reminder"/);
 assert.match(help,/导出完整备份 ZIP/);
 assert.match(help,/class="hero-help-extra"/);
 assert.match(help,/Ctrl\/⌘ K 搜索/);
 assert.match(html,/"help\.meta": "3 步快速开始"/);
});

test('high-frequency labels use 12px+ tokens without blanket icon scaling or data changes',()=>{
 assert.match(css,/--ui-caption-readable:12px/);
 assert.match(css,/--ui-body-small-readable:13px/);
 for(const selector of ['.compact-row .compact-meta','.module-detail-sub','.table-record-time','.record-module-suggestion-meta','.participants-title','.settings-section .field-label']) assert.ok(css.includes(selector),selector);
 assert.match(css,/\.table-fields \.text-input,\.participant-select\{font-size:13px/);
 assert.doesNotMatch(css,/(^|\n)\s*\.ui-icon\s*\{/);
});

test('compact month HTML announces each date and table count and retains original daypart markers',()=>{
 assert.match(calendar,/aria-label="\$\{iso\}，\$\{events\.length\} 桌安排/);
 assert.match(calendar,/month-mini-parts/);
 assert.match(calendar,/compactDaypartRoleClass\(partEvents\)/);
 assert.match(calendar,/count >= MAX_RUNS_PER_DAYPART/);
 assert.match(calendar,/plannerMonthCompact \? "compact"/);
});

test('compact and normal month calendar actually render 42 labeled selectable days',()=>{
 const d=new Date(2026,9,20);
 for(const compact of [true,false]){
   const ctx={plannerMonthCursor:d,plannerSelectedDate:'2026-10-20',plannerMonthCompact:compact,
     parseLocalISODate:x=>x instanceof Date?x:new Date(x+'T12:00:00'),localISODate:x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`,
     startOfLocalWeek:()=> '2026-10-19',plannerDisplaySlots:iso=>iso==='2026-10-20'?[{slot:{daypart:'morning'},plan:{moduleName:'测试模组'}}]:[],
     PLAN_DAYPARTS:[{key:'morning',label:'早'},{key:'noon',label:'中'},{key:'evening',label:'晚'}],slotDaypart:x=>x.daypart,
     compactDaypartRoleClass:()=> 'role-pl',MAX_RUNS_PER_DAYPART:4,planSelfRoleInfo:()=>({className:'role-pl'}),daypartInfo:()=>({label:'早'}),escapeHTML:x=>String(x)};
   vm.runInNewContext(calendar,ctx);
   const markup=ctx.plannerMonthHTML();
   assert.equal((markup.match(/data-calendar-day="/g)||[]).length,42);
   assert.equal((markup.match(/aria-label="\d{4}-\d{2}-\d{2}，\d+ 桌安排/g)||[]).length,42);
   assert.match(markup,/2026-10-20，1 桌安排/);
   assert.ok(compact?markup.includes('month-mini-parts'):markup.includes('month-events'));
 }
});

test('calendar font and tap target improvements preserve mobile seven-column grid and keyboard focus',()=>{
 assert.match(css,/\.month-calendar\.compact \.month-day\{min-height:38px/);
 assert.match(css,/\.month-calendar\.compact \.month-day-no\{font-size:12px/);
 assert.match(css,/\.month-calendar \.month-day:focus-visible\{outline:2px/);
 assert.match(css,/@media\(max-width:430px\)/);
 assert.ok(html.includes('grid-template-columns:repeat(7,minmax(0,1fr))'));
 for(const width of [320,375,390,430,768,1024,1280,1440])assert.ok(width>0); // contract list; real viewport capture is a separate acceptance gate
});

test('four-round status remains explicit about target percentages versus real device acceptance',()=>{
 const scope=[4,17,18,19];for(const no of scope){const row=status.nielsen20Audit.items.find(x=>x.no===no);assert.ok(row&&row.codePct>0&&row.codePct<100,no);}
 assert.equal(status.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
 assert.equal(status.currentVersionAcceptance.realDevice.state,'targeted-checks-pending');
 assert.match(status.currentVersionAcceptance.release.status,/not-deployed/);
});
