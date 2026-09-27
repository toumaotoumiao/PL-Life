
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('rule taxonomy uses the agreed real rule families and does not invent theme-as-rule categories',()=>{
  for(const label of ['BRP 系','其他 d100','d20 / OSR','Saikoro Fiction（骰子小说）','日式其他','PbtA','FitD','Year Zero Engine','GUMSHOE','Fate / 通用系统','其他独立规则','自定义规则']) assert.ok(html.includes(`label:'${label}'`)||html.includes(`label:"${label}"`),`missing family ${label}`);
  for(const rule of ['Call of Cthulhu（CoC）','RuneQuest','Delta Green','Mothership','Shinobigami（忍神）','Insane（インセイン）','Magica Logia（魔道书大战）','Dungeons & Dragons（D&D）','Pathfinder','Sword World']) assert.ok(html.includes(rule),`missing rule ${rule}`);
  assert.doesNotMatch(html,/id:'(?:wuxia|gufeng)'|label:'(?:古风武侠|古風武俠)'/,'theme labels must not become rule taxonomy entries');
});

test('new modules default to confirmed CoC seventh edition while legacy rules are inferred without erasing raw text',()=>{
  assert.match(html,/defaultModuleRuleMeta\(source='new-default'\)[\s\S]*familyId:'brp',systemId:'coc',editionId:'7e'/);
  assert.match(html,/ruleMeta: defaultModuleRuleMeta\('new-default'\)/);
  assert.match(html,/ruleMeta: normalizeModuleRuleMeta\([\s\S]*raw === null \|\| raw === void 0 \? void 0 : raw\.ruleMeta/);
  assert.match(html,/rules: String\(/,'legacy rules text must remain in the archive');
});

test('module editor exposes a top-right family/system/edition selector and template fields are non-destructive',()=>{
  assert.match(html,/id="nativeModuleRuleMenu"/);
  assert.match(html,/data-native-module-rule-family/);
  assert.match(html,/data-native-module-rule-system/);
  assert.match(html,/data-native-module-rule-edition/);
  assert.match(html,/切换规则不会删除隐藏字段/);
  assert.match(html,/const showCoc=ruleKind==='coc',showSkill=showCoc\|\|ruleKind==='brp'/);
});

test('structured rule metadata is carried into canonical ZIP data and current release identity is synchronized',()=>{
  assert.match(html,/ruleMeta: clone\(m\.ruleMeta\)/);
  const version=html.match(/const APP_UI_VERSION = "([^"]+)";/)?.[1];
  const cache=sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1];
  assert.match(version,/^8\.1\.12\.\d+$/);
  assert.equal(cache,version);
  assert.equal((html.match(/version-log-version">v([^<]+)/)||[])[1],version);
});
