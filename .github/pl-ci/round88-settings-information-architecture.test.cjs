'use strict';
// Structural regression: settings clarity must not remove legacy data operations.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const ids=['exportBtn','exportCompactBackupBtn','importBtn','importFile','verifySavedBackupBtn','verifySavedBackupFile',
'exportWorkspacePreviewBtn','inspectWorkspacePreviewBtn','inspectWorkspacePreviewFile','exportEncryptedBtn','importEncryptedBtn',
'encryptedImportFile','importLegacyModuleBtn','legacyModuleImportFile','deviceMigrationGuide','deviceMigrationInspectFile',
'openMigrationExportBtn','openMigrationImportBtn','migrationImportFile','pcMediaStorageCount','pcOriginalWorkbookManager',
'backupReminderDaysSelect','recoveryIntervalSelect','externalBackupEnabledToggle','emptyTrashBtn',
'checkAppUpdateBtn','forceReloadAppBtn','releaseNotesBox','dataIntegrityResults','runInteractionSelfCheckBtn',
'settingsOverviewData','settingsOverviewVersion','settingsEditStatus','saveSettingsBtn','cancelSettingsBtn'];
test('all original settings data controls survive exactly once, plus version shortcut',()=>{
 for(const id of ids){const count=[...html.matchAll(new RegExp('\\bid="'+id+'"','g'))].length;assert.equal(count,1,`${id} duplicated or removed`);}
});
test('settings have eight matched top-level tabs, with migration, version and advanced separate',()=>{
 const nav=html.match(/<aside aria-label="设置章节" class="settings-nav">([\s\S]*?)<\/aside>/)?.[1];
 assert(nav,'settings navigation missing');
 const names=['overview','appearance','rating','behavior','data','migration','version','advanced'];
 for(const name of names){
  assert.equal([...nav.matchAll(new RegExp('data-settings-target="'+name+'"','g'))].length,1,'nav '+name);
  const markup=html.slice(html.indexOf('<section aria-labelledby="settingsTitle"'),html.indexOf('<footer class="modal-foot">',html.indexOf('<section aria-labelledby="settingsTitle"')));
  assert.equal([...markup.matchAll(new RegExp('data-settings-panel="'+name+'"','g'))].length,1,'panel '+name);
 }
 assert(/function activateSettingsPanel\(key\)/.test(html),'tabs lost switching logic');
});
test('one primary import, ZIP/JSON/HTML/encrypted formats and verified restore paths remain',()=>{
 assert.match(html,/id="importBtn"[^>]*>导入文件<\/button>/);
 assert.match(html,/id="importFile"[^>]*type="file"/);
 const input=html.match(/<input\b[^>]*\bid="importFile"[^>]*>/)?.[0];
 assert(input);for(const ext of [".zip",".json",".html",".plbackup",".plmove"])assert(input.includes(ext),`missing supported type ${ext}`);
 const fn=html.slice(html.indexOf('async function importAnyBackup('),html.indexOf('function updateCompactAppBar('));
 for(const fragment of ['restoreUnifiedCompleteBackup(file)','loadEncryptedBackupFile(file)','extractEmbeddedJsonFromHtml(text, "embeddedUnifiedBackup")','mergeLegacyModuleState','importBackup(new File'])assert(fn.includes(fragment),'missing import path '+fragment);
 assert.match(html,/function loadEncryptedBackupFile\(file\)/);
 assert.match(html,/async function restoreUnifiedCompleteBackup\(file\)/);
 assert.match(html,/async function inspectWorkspacePreviewFromInput\(file\)/);
});
test('backup primary has 2 visible actions, secondary tools tucked away',()=>{
 const body=html.slice(html.indexOf('id="backupPrimaryActions"'),html.indexOf('data-collapse-key="settings:data:backup-more-options"'));
 assert.match(body,/id="exportBtn"/);assert.match(body,/id="importBtn"/);
 assert(!body.includes('id="exportEncryptedBtn"'),'encrypted tool leaked into main actions');
 assert(!body.includes('id="importLegacyModuleBtn"'),'legacy module leaked into main actions');
 assert.match(html,/data-settings-panel="advanced"/);
 assert.match(html,/data-collapse-key="settings:advanced:encrypted"/);
 assert.match(html,/data-settings-panel="migration"/);
 assert.match(html,/data-collapse-key="settings:migration:legacy"/);
});
test('version and cache are synchronized, data schema is not rewritten',()=>{
 const version=html.match(/const APP_UI_VERSION = "([0-9.]+)"/)?.[1];
 assert.match(version||'',/^\d+\.\d+\.\d+\.\d+$/);assert(sw.includes('v'+version));
 assert(!/data-settings-panel="version"[^>]*>[\s\S]*?id="importBtn"/.test(html.slice(html.indexOf('data-settings-panel="version"'),html.indexOf('data-settings-panel="advanced"'))));
});

test('settings search expands newly categorized collapsed tools before scrolling',()=>{
 assert.match(html,/let group = target\.closest\("details"\); while \(group && panel\.contains\(group\)\)/);
 for(const label of ['导入与迁移','版本与更新','高级工具'])assert(html.includes(label));
});

test('onboarding scheduled after startup cannot cover Settings or any open editor',()=>{
 assert.match(html,/function maybeShowOnboarding\(\)[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?if \(guideCompleted \|\| anyModalSurfaceOpen\(\)/);
 const settings=html.slice(html.indexOf('function openSettings()'),html.indexOf('function activateSettingsPanel(key)'));
 assert.match(settings,/closeOnboardingTemporarily\(\)/);
 assert(settings.indexOf('closeOnboardingTemporarily()')<settings.indexOf('showOverlay("settings")'));
});
