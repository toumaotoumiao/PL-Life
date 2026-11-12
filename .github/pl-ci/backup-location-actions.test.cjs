'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');

function sourceBetween(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`missing source bounds ${start}`);
  return html.slice(a,b);
}

test('backup settings offer distinct view and change actions without changing backup schedule contract',()=>{
  const section=sourceBetween('<details class="data-safety-group" data-collapse-key="settings:data:external"','</section></div></details>');
  assert.match(section,/id="viewExternalBackupFilesBtn"/);
  assert.match(section,/id="chooseExternalBackupFolderBtn"/);
  assert.match(section,/id="externalBackupNowBtn"/);
  assert.match(html,/els\.chooseExternalBackupFolder\.addEventListener\("click", \(\) => \{ void changeExternalBackupLocation\(\); \}\)/);
  assert.match(html,/els\.viewExternalBackupFiles\.addEventListener\("click", \(\) => \{ void openExternalBackupLocation\(\); \}\)/);
  assert.match(html,/const name=`\$\{APP_NAME\}_自动备份_\$\{externalBackupStamp\(date\)\}\.zip`/);
  assert.match(html,/await verifyCompleteBackupZipFile\(prior\)/);
});

test('backup location controls distinguish writable handles from browser-managed downloads',()=>{
  const body=sourceBetween('async function updateExternalBackupUI(options = {}) {','async function checkExternalBackupSchedule() {');
  assert.match(body,/"重新选择文件夹"/);
  assert.match(body,/"重新选择备份文件"/);
  assert.match(body,/"查看当前文件夹"/);
  assert.match(body,/"查看下载位置"/);
  assert.match(body,/"更改下载目录"/);
  assert.match(body,/\.hidden = !target&&!mobileMode/);
  assert.match(body,/浏览器下载目录（由浏览器设置管理，网页无法读取完整路径）/);
});

test('browser-download help does not claim to launch an OS folder or change browser settings',()=>{
  const src=sourceBetween('function showExternalBackupDownloadLocationHelp({change=false}={}) {','function getExternalBackupFallbackMode() {');
  const notices=[];
  const context={navigator:{userAgent:'Mozilla/5.0 Edg/157.0'},externalBackupLikelyMobileBrowser:()=>false,appNotice:(msg,title)=>notices.push({msg,title})};
  vm.runInNewContext(src,context);
  assert.equal(context.showExternalBackupDownloadLocationHelp(),true);
  assert.match(notices.at(-1).msg,/Ctrl\+J/);
  assert.match(notices.at(-1).msg,/网页无法直接启动系统文件管理器/);
  context.showExternalBackupDownloadLocationHelp({change:true});
  assert.match(notices.at(-1).msg,/edge:\/\/settings\/downloads/);
  assert.match(notices.at(-1).msg,/旧 ZIP 不会自动移动/);
  context.navigator.userAgent='Mobile Safari';
  context.externalBackupLikelyMobileBrowser=()=>true;
  context.showExternalBackupDownloadLocationHelp();
  assert.match(notices.at(-1).msg,/系统文件管理器/);
});

test('successful fixed-folder backup offers location view; download requests retain separate retry action',()=>{
  const src=sourceBetween('function showExternalBackupSuccessNotice(meta) {','function showMobileBackupVerifiedResult(');
  const retry={hidden:true};
  const els={externalBackupNotice:{hidden:true},externalBackupNoticeText:{textContent:''},externalBackupNoticeTitle:{textContent:''},externalBackupVerify:{hidden:false,textContent:''},externalBackupVerifySaved:{hidden:true},externalBackupMobileDownloadLink:{hidden:true}};
  const context={els,document:{getElementById:id=>id==='externalBackupRetryDownloadBtn'?retry:null},formatSafetyDateTime:()=> '2026/11/11 12:00',APP_NAME:'PL-Life',externalBackupNoticeMode:'',};
  vm.runInNewContext(src,context);
  context.showExternalBackupSuccessNotice({kind:'directory',fileName:'PL-Life_自动备份_2026-11-11.zip',locationName:'备份目录'});
  assert.equal(els.externalBackupVerify.textContent,'查看当前备份位置');
  assert.equal(retry.hidden,true);
  assert.equal(els.externalBackupNotice.hidden,false);
  context.showExternalBackupSuccessNotice({kind:'mobile-auto-download',fileName:'file.zip',locationName:'浏览器下载目录'});
  assert.equal(els.externalBackupVerify.textContent,'查看下载位置');
  assert.equal(retry.hidden,false,'download retry is a separate secondary action');
  assert.match(els.externalBackupNoticeTitle.textContent,/已发起自动下载/);
  assert.match(els.externalBackupNoticeText.textContent,/无法确认浏览器是否真正落盘/);
  context.showExternalBackupSuccessNotice({kind:'mobile-user-save',fileName:'file.zip',locationName:'浏览器下载目录'});
  assert.equal(retry.hidden,true);
  assert.equal(els.externalBackupVerify.textContent,'查看下载位置');
});

test('changing a fixed backup folder does not discard old target on cancel or failed test',()=>{
  const choose=sourceBetween('async function chooseExternalBackupTarget() {','async function changeExternalBackupLocation()');
  assert.match(choose,/options\.startIn=current/);
  assert.match(choose,/if\(previous&&!same\)/);
  assert.match(choose,/if\(!proceed\)return false/);
  assert.match(choose,/await restoreExternalBackupTarget\(previous\)/);
  assert.match(html,/tx\.objectStore\(EXTERNAL_BACKUP_STORE_NAME\)\.delete\("target"\)/,'first-time selection failure must not leave a broken target enabled');
  assert.match(choose,/setExternalBackupEnabled\(previousEnabled\)/);
  assert.match(choose,/原保存位置.*不会移动或删除/);
});

test('canceling native re-selection leaves the current backup folder unchanged',async()=>{
  const src=sourceBetween('async function chooseExternalBackupTarget() {','async function changeExternalBackupLocation()');
  const old={kind:'directory',handle:{kind:'directory',name:'old',isSameEntry:async()=>false}};
  const next={kind:'directory',name:'new'};
  let writes=0;
  const context={externalBackupSupported:()=>true,externalBackupDirectPreferred:()=>true,
    externalBackupFolderApiSupported:()=>true,externalBackupTargetCache:old,
    window:{showDirectoryPicker:async()=>next},loadExternalBackupTarget:async()=>old,
    appConfirm:async()=>false,saveExternalBackupTarget:async()=>{writes++;},
    externalBackupPermission:async()=> 'granted'};
  vm.runInNewContext(src,context);
  assert.equal(await context.chooseExternalBackupTarget(),false);
  assert.equal(writes,0,'cancel must not change persisted FileSystemHandle');
});

test('a failed write at the new location restores the previous automatic backup settings',async()=>{
  const src=sourceBetween('async function chooseExternalBackupTarget() {','async function changeExternalBackupLocation()');
  const old={kind:'directory',handle:{kind:'directory',name:'old',isSameEntry:async()=>false}};
  const next={kind:'directory',name:'new'};
  const events=[];
  const context={externalBackupSupported:()=>true,externalBackupDirectPreferred:()=>true,
    externalBackupFolderApiSupported:()=>true,externalBackupTargetCache:old,
    window:{showDirectoryPicker:async()=>next},loadExternalBackupTarget:async()=>old,
    appConfirm:async()=>true,externalBackupPermission:async()=> 'granted',
    getExternalBackupEnabled:()=>false,getExternalBackupPendingAt:()=>1234,getExternalBackupFallbackMode:()=>'',
    saveExternalBackupTarget:async target=>events.push('save:'+target.handle.name),
    restoreExternalBackupTarget:async target=>events.push('restore:'+target.handle.name),
    setExternalBackupFallbackMode:v=>events.push('fallback:'+v),
    setExternalBackupPendingAt:v=>events.push('pending:'+v),
    setExternalBackupEnabled:v=>events.push('enabled:'+v),
    updateExternalBackupUI:async()=>{},writeExternalBackupNow:async()=>false,
    appNotice:()=>{},showToast:()=>{throw Error('must not report success')}};
  vm.runInNewContext(src,context);
  assert.equal(await context.chooseExternalBackupTarget(),false);
  assert.deepEqual(events.slice(0,4),['save:new','fallback:','pending:0','restore:old']);
  assert.ok(events.includes('pending:1234'));
  assert.ok(events.includes('enabled:false'));
});

test('CI runs backup-location guard and real Chromium interactions',()=>{
  assert.match(workflow,/node --test \.github\/pl-ci\/backup-location-actions\.test\.cjs/);
  assert.match(workflow,/node \.github\/pl-ci\/backup-location-actions-browser\.cjs/);
  assert.match(workflow,/BackupLocationActions:\$\{\{ steps\.backup_location_browser\.outcome \}\}/);
});
