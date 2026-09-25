'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const local=html.match(/function statsExportLayout\(state=statsExportState\)\{\n(    function statsExportData\(rawState=statsExportState\)\{[\s\S]*?\n    \})\n    const normalized=/);
const source=local?.[1];
function invoke(runs,events,state={yearOverride:0,roleOverride:''},currentRole='all'){
 assert(source,'Real statsExportData implementation must be local to the layout');
 const context={statsExportState:state,statsUiState:{role:currentRole},statsStoryYear:()=>2026,
  normalizeStatsExportState:x=>x,statsStoryEvents:(year,role)=>events.filter(e=>e.year===year&&(role==='all'||e.roles[role])),
  statsPersonalRuns:()=>runs,statsRunRoles:r=>r.roles,statsRecordDate:r=>r.date,
  statsPersonAggregates:r=>r.flatMap(x=>x.people||[]),statsModuleAggregates:r=>r.flatMap(x=>x.mods||[]),
  window:{PLRunEvents:{runSpans:e=>e.map(x=>({id:x.id})),summarize:e=>({tables:e.length,sessions:e.length,days:e.length,modules:e.length,kpTables:e.filter(x=>x.roles.kp).length,plTables:e.filter(x=>x.roles.pl).length})}}};
 return vm.runInNewContext(source+'\nstatsExportData(statsExportState)',context);
}
test('Round136: stats image exporter restores a runnable data contract',()=>{
 const runs=[{date:'2026-03-10',roles:{kp:true,pl:false},people:[{ledByMe:2,ledMe:0}],mods:[{name:'Synthetic'}]},{date:'2025-11-03',roles:{kp:false,pl:true},people:[{ledByMe:0,ledMe:1}],mods:[]}];
 const events=[{id:1,year:2026,roles:{kp:true,pl:false}},{id:2,year:2025,roles:{kp:false,pl:true}}];
 const x=invoke(runs,events,{yearOverride:2026,roleOverride:'kp'});
 assert.equal(x.year,2026);assert.equal(x.role,'kp');assert.equal(x.events.length,1);assert.equal(x.runs.length,1);
 assert.equal(x.spans.length,1);assert.equal(x.summary.sessions,1);assert.equal(x.uniquePl,1);assert.equal(x.uniqueKp,0);
 assert.equal(x.people.length,1);assert.equal(x.mods.length,1);
});
test('Round136: no data remains an empty state, not a ReferenceError',()=>{
 const x=invoke([],[],{yearOverride:0,roleOverride:''});
 assert.equal(x.year,2026);assert.equal(x.events.length,0);assert.equal(x.runs.length,0);assert.equal(x.summary.sessions,0);
 assert.equal(x.uniquePl,0);assert.equal(x.uniqueKp,0);assert(Array.isArray(x.people)&&Array.isArray(x.mods)&&Array.isArray(x.spans));
});
test('Round136: mobile editor jumpbar and sticky footer stay actionable',()=>{
 const css=html.match(/<style id="round136-editor-flow-visual">([\s\S]*?)<\/style>/)?.[1]||'';
 assert(css,'missing v200 editor style');assert.match(css,/\.plan-editor-drawer \.ux-editor-jumpbar button/);
 assert.match(css,/\.table-record\.is-editing \.ux-editor-jumpbar button/);
 assert.match(css,/min-height:40px!important/);assert.match(css,/\.plan-editor-drawer \.plan-editor-footer\{bottom:0!important;margin-bottom:0!important\}/);
});
test('Round136: version independent contract and CI live flow are wired',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
 assert.match(html,/const APP_UI_VERSION = "8\.1\.12\.\d+";/);
 assert.match(workflow,/round136-editor-export-flow\.test\.cjs/);
 assert.match(workflow,/round136-editor-export-flow-browser\.cjs/);
 assert.match(fs.readFileSync(path.join(root,'data-migration-guard.js'),'utf8'),/MAX_SCHEMA\s*=\s*26/);
});
