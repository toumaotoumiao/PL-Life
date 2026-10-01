'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
test('Round185 plan and record unknown properties remain through known-field normalization',()=>{
 for(const fn of ['normalizeRunPlan','normalizeRunRecord']){
  const from=html.indexOf(`function ${fn}(`),to=html.indexOf('\n}',from);assert.ok(from>0&&to>from);assert.match(html.slice(from,to+2),/return pcPreserveUnknownJsonProps\(raw, normalized, RUN_CANONICAL_ONLY_KEYS\)/);
 }
 assert.match(html,/const RUN_CANONICAL_ONLY_KEYS = new Set\(\["status","schedule","dateRange","experience","completedAt","tableHo"\]\)/);
 assert.match(html,/return pcPreserveUnknownJsonProps\(entity, canonical, RUN_RUNTIME_ONLY_KEYS\)/);
});
test('Round185 preserves snapshot, individual schedule/participant/KPC extensions and protects known projections',()=>{
 assert.match(html,/return pcPreserveUnknownJsonProps\(raw, normalizeModuleRuleMeta\(raw,''\)\)/);
 assert.match(html,/function normalizePlanTimeSlot\(raw\)[\s\S]{0,1200}pcPreserveUnknownJsonProps\(raw,/);
 assert.match(html,/function normalizeParticipantAssignment\(raw,[\s\S]{0,1200}pcPreserveUnknownJsonProps\(raw,/);
 assert.match(html,/function normalizeKpc\(raw\)[\s\S]{0,950}pcPreserveUnknownJsonProps\(raw,/);
 for(const key of ['postRunDraft','timeSlots','sessionSlots','legacyPlNames','kpProfileId'])assert.match(html,new RegExp('RUN_RUNTIME_ONLY_KEYS[^;]*"'+key+'"'));
 assert.match(html,/function hydrateCanonicalArchive[\s\S]*?const common = pcPreserveUnknownJsonProps\(run, \{/);
 assert.match(html,/runFutureCanonicalParts: \{/);
 assert.match(html,/kp: pcPreserveUnknownJsonProps\(storedExtras\.kp,/);
 assert.match(html,/dateRange: pcPreserveUnknownJsonProps\(storedExtras\.dateRange,/);
 assert.match(html,/experience: planned \? plannedExperience : completedExperience/);
 assert.match(html,/const hasFutureExperience=/);
});
test('Round185 conservative data boundary unchanged',()=>{
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/function pcPreserveUnknownJsonProps[\s\S]{0,600}key==='__proto__'\|\|key==='constructor'\|\|key==='prototype'/);
 assert.match(html,/assertRunLogInputPreserved\(\)/);
 assert.match(html,/function canonicalRunFromRuntime/);
});
test('Round185 browser check is mandatory in CI, not soft success',()=>{
 assert.match(workflow,/round185-run-future-fields\.test\.cjs/);
 assert.match(workflow,/id: round185_browser/);
 assert.match(workflow,/round185-run-future-fields-browser\.py/);
 assert.match(workflow,/Round185:\$\{\{ steps\.round185_browser\.outcome \}\}/);
});
