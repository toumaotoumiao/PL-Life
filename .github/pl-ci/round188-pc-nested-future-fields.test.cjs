'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/pl-browser-synthetic.yml'), 'utf8');
const browser = fs.readFileSync(path.join(__dirname, 'round188-pc-nested-future-fields-browser.py'), 'utf8');
function bodyOf(name) {
  const start=html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next=html.indexOf("\nfunction ",start+10);
  return html.slice(start,next<0?Math.min(start+3000,html.length):next);
}
test('Round188 preserves unknown nested card time without changing known field trim', () => {
  const fn=bodyOf('pcNormalizeCardTime');
  assert.match(fn,/Object\.keys\(PC_CARD_TIME_REFS\)/);
  assert.match(fn,/String\(source\[key\]\?\?""\)\.trim\(\)/);
  assert.match(fn,/return pcPreserveUnknownJsonProps\(source,result\)/);
});
test('Round188 safely preserves JSON-safe future cells, skills and weapons after normalizing known fields', () => {
  for(const label of ['normalizePcSkills','normalizePcWeapons','normalizePcExcelEdits']) {
    const fn=bodyOf(label);
    assert.match(fn,/pcPreserveUnknownJsonProps\(/, label);
  }
  assert.match(bodyOf('normalizePcSkills'),/seen\.has\(key\)/);
  assert.ok(bodyOf('normalizePcExcelEdits').includes('if(!sheet||!'), 'invalid sheet and cell reference still rejected');
  assert.match(bodyOf('normalizePcWeapons'),/\.filter\(x=>x\.name\|\|x\.skill\|\|x\.damage\)/);
});
test('Round188 consolidates original and late PC snapshot normalizers, without disabling dedupe and bounds', () => {
  assert.match(bodyOf('normalizePcStoredSnapshots'),/seen\.has\(key\)/);
  assert.match(bodyOf('normalizePcStoredSnapshots'),/pcPreserveUnknownJsonProps\(src,/);
  assert.match(bodyOf('normalizePcStoredSnapshots'),/out\.slice\(0,500\)/);
  assert.match(html,/function normalizePcSnapshotRow\(raw\)\{return normalizePcStoredSnapshots\(\[raw\]\)\[0\];\}/);
  assert.match(html,/function normalizePcSnapshots\(raw\)\{return normalizePcStoredSnapshots\(raw\);\}/);
});
test('Round188 actual app test checks edit, save, rehydrate, unknown keys and tamper detection on eight widths',()=>{
  for(const token of ['page.set_content(', 'normalizePcArchive(', 'saveState()', 'hydrateCanonicalArchive(', 'completeBackupRuleEvidence(', 'sourceUnchanged', 'inputSafe', 'knownSkillValue', 'duplicateSnapshotFiltered', 'editedKnown']) assert.ok(browser.includes(token), token);
  for(const width of ['320','375','390','430','768','1024','1280','1440']) assert.ok(browser.includes(width),width);
  assert.match(browser,/if fails:raise SystemExit\(1\)/);
  assert.doesNotMatch(browser,/toumaotoumiao\.github\.io|\/mnt\/data\/PL收集梦想生活_完整备份_/);
});
test('Round188 mandatory CI gate retains Round187 native recovery gate separately',()=>{
  assert.match(workflow,/round188-pc-nested-future-fields\.test\.cjs/);
  assert.match(workflow,/id: round188_browser/);
  assert.match(workflow,/python \.github\/pl-ci\/round188-pc-nested-future-fields-browser\.py/);
  assert.match(workflow,/Round188:\$\{\{ steps\.round188_browser\.outcome \}\}/);
  assert.match(workflow,/Round187:\$\{\{ steps\.round187_browser\.outcome \}\}/);
  assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
});
