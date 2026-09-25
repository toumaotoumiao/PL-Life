 'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const extract=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return html.slice(a,b);};
const helpers=extract('/* 个人统计分区：同一时间范围内独立选择身份和显示数量。 */','/* 个人统计：各图表可独立折叠');
test('Round140: scoped role and extent on exactly four panels, leaving calendar/habits alone',()=>{
 const renderer=extract('function renderStats() {','/* ---------- PC 档案：列表');
 for(const id of ['timeline','people','modules','footprint']){assert(renderer.includes(`statsPanelRoleControlsHTML("${id}")`));}
 for(const id of ['timeline','people','modules'])assert(renderer.includes(`statsPanelDisplayControlsHTML("${id}")`));
 assert(!renderer.includes('statsPanelRoleControlsHTML("calendar")'));assert(!renderer.includes('statsPanelRoleControlsHTML("habits")'));
 assert.match(renderer,/statsPanelEvents\(yearEvents,"timeline"\)/);assert.match(renderer,/statsPanelEvents\(yearEvents,"footprint"\)/);
 assert.match(renderer,/statsPanelRuns\(runs,"people"\)/);assert.match(renderer,/statsPanelRuns\(runs,"modules"\)/);
 assert.match(renderer,/statsYearCalendarHTML\(yearEvents, storyYear\)/);assert.match(renderer,/statsTimeHabitsHTML\(yearEvents\)/);
 assert.match(html,/statsUiState\.panelRoles=\{\.\.\.\(statsUiState\.panelRoles\|\|\{\}\),\[id\]:role\}/);
 assert.match(html,/statsUiState\.panelDisplay=\{\.\.\.\(statsUiState\.panelDisplay\|\|\{\}\),\[id\]:mode\}/);
});
test('Round140: identity filter matches actual records/events and respects global scope',()=>{
 const state={role:'all',panelRoles:{timeline:'all',people:'kp',modules:'pl',footprint:'all'},panelDisplay:{timeline:'partial'}};
 const ctx={statsUiState:state,statsEventRoleMatches:(ev,role)=>role==='all'?(ev.roles.kp||ev.roles.pl):Boolean(ev.roles[role]),statsRunRoles:run=>run.roles,escapeHTML:String};
 vm.createContext(ctx);vm.runInContext(helpers,ctx);
 const rows=[{id:'both',roles:{kp:true,pl:true}},{id:'kp',roles:{kp:true,pl:false}},{id:'pl',roles:{kp:false,pl:true}}];
 assert.deepEqual([...ctx.statsPanelRuns(rows,'people')].map(r=>r.id),['both','kp']);
 assert.deepEqual([...ctx.statsPanelRuns(rows,'modules')].map(r=>r.id),['both','pl']);
 assert.equal(ctx.statsPanelEvents(rows,'timeline').length,3);
 state.panelRoles.timeline='kp';assert.deepEqual([...ctx.statsPanelEvents(rows,'timeline')].map(r=>r.id),['both','kp']);
 state.role='pl';assert.equal(ctx.statsPanelRole('timeline'),'all');assert.match(ctx.statsPanelRoleControlsHTML('timeline'),/disabled title=/);
});
test('Round140: complete mode does not silently truncate people, modules or timeband',()=>{
 const ctx={statsUiState:{role:'all',panelRoles:{},panelDisplay:{people:'all',modules:'all',timeline:'all'},footprintMode:'all'},statsEventRoleMatches:()=>true,statsRunRoles:r=>r.roles,escapeHTML:String,STATS_PANEL_PARTIAL_LIMITS:{timeline:28,people:10,modules:10,footprint:24},statsPersonLabel:r=>r.name,statsPersonNameHTML:r=>r.name,statsRankButton:(r)=>r.name,statsFormatDate:()=>'-',i18nCompareText:(a,b)=>a.localeCompare(b),statsYearDayProgress:()=>20,statsEventTimeLabel:()=>'',window:{PLRunEvents:{runSpans:()=>Array.from({length:33},(_,i)=>({moduleName:`run${i}`,tableName:'',start:'2026-01-01',end:'2026-01-03',roles:{kp:true,pl:false},archived:true,sessions:1,events:[]}))}}};
 vm.createContext(ctx);vm.runInContext(helpers,ctx);
 const render=extract('function statsPeopleRowsHTML(', 'function statsPeriodKey(')+extract('function statsRunTimelineHTML(', 'function statsTimeHabitsHTML(');
 vm.runInContext(render,ctx);
 const people=Array.from({length:23},(_,i)=>({name:`person${i}`,together:23-i,ledByMe:23-i,ledMe:0,coPl:0,lastDate:'2026-01-01'}));
 const mods=Array.from({length:27},(_,i)=>({name:`mod${i}`,moduleId:String(i),total:28-i,kp:27-i,pl:1,plAppearances:2,uniquePl:new Set(['a']),uniqueKp:new Set(['b']),lastDate:'2026-01-01'}));
 assert.equal((ctx.statsPeopleRowsHTML(people,'together','rank','partial').match(/stats-ranking-row/g)||[]).length,10);
 assert.equal((ctx.statsPeopleRowsHTML(people,'together','rank','all').match(/stats-ranking-row/g)||[]).length,23);
 assert.equal((ctx.statsModuleRowsHTML(mods,'all','rank','all').match(/<tr>/g)||[]).length,28);
 assert.match(ctx.statsModuleRowsHTML(mods,'all','rank','all'),/总桌次/);
 const timeline=ctx.statsRunTimelineHTML([],2026);assert.equal((timeline.match(/stats-run-timeline-row/g)||[]).length,33);
});
test('Round140: a dual-role table counts once in total while retaining both role counts',()=>{
 const src=extract('function statsModuleAggregates(runs) {','function statsCurrentPlanSummary() {');
 const ctx={statsRunRoles:r=>r.roles,statsRecordDate:()=> '2026-09-01',normalizedEntityNameKey:s=>s,moduleById:()=>null,statsParticipantRefs:()=>[],statsKpRef:()=>null};
 const aggregate=vm.runInNewContext(`${src};statsModuleAggregates`,ctx);
 const result=aggregate([{moduleName:'同模组',roles:{kp:true,pl:true}},{moduleName:'同模组',roles:{kp:true,pl:false}},{moduleName:'同模组',roles:{kp:false,pl:true}}]);
 assert.equal(result[0].total,3);assert.equal(result[0].kp,2);assert.equal(result[0].pl,2);
});
test('Round140: mobile controls retain touch height and CI covers contract',()=>{
 assert.match(html,/<style id="stats-panel-scope-v204">/);
 assert.match(html,/\.stats-panel-controls \.stats-segmented button\{min-height:42px!important/);
 const wf=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert(wf.includes('round140-stats-panel-scope.test.cjs'));assert(wf.includes('round140-stats-panel-scope-browser.cjs'));
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
});
