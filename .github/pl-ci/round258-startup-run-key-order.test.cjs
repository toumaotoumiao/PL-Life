'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const startupCall = 'let { profiles, settings, runRecords, runPlans, modules, pcs } = loadState();';
const deps = [
  'const RUN_CANONICAL_ONLY_KEYS = new Set(',
  'const RUN_RUNTIME_ONLY_KEYS = new Set(',
  'const RUN_DRAFT_KNOWN_KEYS = new Set('
];

test('run canonical key sets are initialized before the first loadState call', () => {
  const callAt = html.indexOf(startupCall);
  assert.ok(callAt > 0, 'startup loadState call must exist');
  for (const marker of deps) {
    const at = html.indexOf(marker);
    assert.ok(at > 0, `${marker} must exist`);
    assert.ok(at < callAt, `${marker} must be initialized before loadState()`);
    assert.equal(html.indexOf(marker, at + marker.length), -1, `${marker} must not be duplicated`);
  }
});

test('startup order documents the archive-read dependency', () => {
  const callAt = html.indexOf(startupCall);
  const depAt = html.indexOf('const RUN_CANONICAL_ONLY_KEYS = new Set(');
  const between = html.slice(Math.max(0, depAt - 240), callAt);
  assert.match(between, /loadState\(\).*启动依赖|启动依赖.*loadState\(\)/, 'startup dependency comment must stay near the pre-load initialization');
});
