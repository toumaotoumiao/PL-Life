'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const mod=read('module-tools.html'),diag=read('storage-diagnostic.html'),helper=read('aux-issue-report.js'),main=read('index.html');
const code=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`missing ${start} / ${end}`);return src.slice(a,b);};
const status=JSON.parse(read('CURRENT_PROJECT_STATUS.json'));
function runVM(src,ctx){vm.createContext(ctx);vm.runInContext(src,ctx);return ctx;}
function helperEnv(){
  const window={},ctx={window,document:{},Blob,URL,Date,Set,String,Math};
  runVM(helper,ctx);return ctx;
}
test('Stage138 app, current file, service worker, release manifest all agree and preserve schema26',()=>{
  const release=JSON.parse(read('production-release-manifest.json'));
  assert.ok(status.current.stage>=138);assert.match(status.current.appVersion,/^8\.1\.12\.3\d{2}$/);
  assert.equal(release.appVersion,status.current.appVersion);
  assert.equal(release.schemaVersion,26);
  assert.ok(main.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
  assert.ok(read('sw.js').includes(status.current.appVersion));
  assert.equal(status.nielsen20Audit.currentBrowserAndRealDeviceAccepted,false);
});
test('no missing required helper from standalone auxiliary pages',()=>{
  for(const page of [mod,diag])assert.match(page,/src="\.\/aux-issue-report\.js"/);
  for(const term of ['setDisabled','safeType','report','copy','download'])assert.ok(helper.includes(term));
  assert.ok(read('production-release-manifest.json').includes('aux-issue-report.js'));
});
test('accessibility disabled helper adds and removes actual disabled reason while preserving original help',()=>{
  const api=helperEnv().window.PlAuxIssueReport;
  const attributes=new Map([['title','正常操作'],['aria-label','上传文件'],['aria-describedby','original-help']]);
  const element={disabled:false,textContent:'上传文件',dataset:{},getAttribute:k=>attributes.get(k)||null,
    setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
  api.setDisabled(element,true,'正在检查');
  assert.equal(element.disabled,true);assert.equal(element.getAttribute('data-disabled-reason'),'正在检查');
  assert.match(element.getAttribute('aria-label'),/正在检查/);
  assert.equal(element.getAttribute('aria-describedby'),'original-help');
  api.setDisabled(element,false);
  assert.equal(element.disabled,false);assert.equal(element.getAttribute('title'),'正常操作');
  assert.equal(element.getAttribute('aria-describedby'),'original-help');
  assert.ok(!element.getAttribute('data-disabled-reason'));
});
test('standalone getdb refuses missing parent bridge instead of using writable empty archive',async()=>{
  const scripts=code(mod,'async function getdb(){','async function putdb(){');
  const ctx=runVM(scripts,{parent:{},cp:x=>x});
  await assert.rejects(ctx.getdb(),/UnifiedArchiveBridgeUnavailable/);
});
test('getdb rejects an invalid canonical archive and preserves the underlying reference',async()=>{
  const script=code(mod,'async function getdb(){','async function putdb(){');
  const ctx=runVM(script,{parent:{UnifiedTRPGBridge:{getModuleState:()=>({modules:'not an array'})}},cp:x=>x});
  await assert.rejects(ctx.getdb(),/UnifiedArchiveReadInvalid/);
});
test('putdb refuses absent bridge and a save that does not return confirmed archive',async()=>{
  const script=code(mod,'async function putdb(){','function meaningfulLegacyRun(');
  let c=runVM(script,{parent:{},cp:x=>x,state:{modules:[]}});
  await assert.rejects(c.putdb(),/UnifiedArchiveBridgeUnavailable/);
  c=runVM(script,{parent:{UnifiedTRPGBridge:{saveModuleState:async()=>null}},cp:x=>x,state:{modules:[]}});
  await assert.rejects(c.putdb(),/UnifiedArchiveSaveUnconfirmed/);
});
test('load surfaces failed initial read; never invokes fresh archive fallback',async()=>{
  const script=code(mod,'async function load(){','async function save(){');
  let fresh=0;
  const c=runVM(script,{getdb:async()=>{throw Error('read failure')},fresh:()=>{fresh++;return {modules:[]}},state:{}});
  await assert.rejects(c.load(),/read failure/);assert.equal(fresh,0);
});
test('startup failure locks form controls and shows user-readable state',()=>{
  const source=code(mod,'function lockAuxiliaryToolAfterLoadFailure(error){','function showAuxIssue(');
  const calls=[],controls=[
    {id:'new',closest:()=>null},
    {id:'auxIssueCopy',closest:()=>({})},
    {id:'search',closest:()=>null}
  ];
  const status={textContent:''},notice={hidden:true,textContent:''};
  const ctx=runVM(source,{
    document:{getElementById:id=>id==='savestate'?status:id==='auxReadOnlyNotice'?notice:null,
      querySelector:()=>({querySelectorAll:()=>controls})},
    showAuxIssue:a=>calls.push(['issue',a.code]),
    PlAuxIssueReport:{setDisabled:(x,on,why)=>calls.push([x.id,on,why])}
  });
  ctx.lockAuxiliaryToolAfterLoadFailure(Error('broken'));
  assert.equal(calls[0][1],'MODULE-INITIAL-LOAD');assert.ok(calls.some(x=>x[0]==='new'&&x[1]===true));
  assert.ok(!calls.some(x=>x[0]==='auxIssueCopy'));assert.match(status.textContent,/锁定编辑/);
  assert.equal(notice.hidden,false);
});
test('startup initialization catches load errors rather than rendering editable empty state',()=>{
  const startup=code(mod,';(async()=>{','</script>');
  assert.match(startup,/try\{\s*await load\(\)/);
  assert.match(startup,/catch\(err\)\{lockAuxiliaryToolAfterLoadFailure\(err\);\}/);
});
test('successful save removes stale save-failure banner and communicates persisted time',()=>{
  const src=code(mod,'async function save(){','function qs(){');
  assert.match(src,/await putdb\(\)/);assert.match(src,/clearAuxIssue\('MODULE-SAVE-FAIL'\)/);
  assert.match(src,/保存失败 · 本机状态待核对/);
});
test('import JSON does not assert rollback after ambiguous write and re-reads canonical archive',async()=>{
  const src=code(mod,'async function importJSON(f){','async function clearall(){');
  const calls=[],prev={modules:[{id:'old'}],settings:{}},current={modules:[{id:'persisted'}],settings:{}};
  const c=runVM(src,{
    state:prev,cp:x=>JSON.parse(JSON.stringify(x)),MAX_FILE_BYTES:16*1024*1024,
    appPhraseConfirm:async()=>true,repair:()=>{},applyTheme:()=>{},putdb:async()=>{throw Error('WriteUnknown')},
    getdb:async()=>current,render:()=>calls.push('render'),showAuxIssue:x=>calls.push(x),
    toast:()=>{},console:{error:()=>{}},$:()=>({textContent:''}),close:()=>{},clearAuxIssue:()=>{}
  });
  await c.importJSON({size:15,text:async()=>JSON.stringify({modules:[{id:'new'}],settings:{}})});
  assert.equal(c.state.modules[0].id,'persisted');
  const issue=calls.find(x=>x&&x.code==='MODULE-BACKUP-IMPORT');
  assert.ok(issue);assert.match(issue.state,/已回读主档案/);
  assert.doesNotMatch(issue.state,/内存已恢复导入前副本/);
});
test('import JSON read failure leaves initial state and skips storage writes',async()=>{
  const src=code(mod,'async function importJSON(f){','async function clearall(){');
  const before={modules:[{id:'old'}],settings:{}},calls=[];let write=0;
  const c=runVM(src,{state:before,cp:x=>JSON.parse(JSON.stringify(x)),MAX_FILE_BYTES:16*1024*1024,
    repair:()=>{},applyTheme:()=>{},putdb:()=>{write++},getdb:async()=>({}),render:()=>{},
    showAuxIssue:x=>calls.push(x),toast:()=>{},console:{error:()=>{}},$:()=>({textContent:''})
  });
  await c.importJSON({size:15,text:async()=>'{invalid'});
  assert.equal(write,0);assert.equal(c.state.modules[0].id,'old');
  assert.match(calls[0].state,/写入尚未开始/);
});
test('reset must use confirmed main-app operation instead of inventing a fresh cleared archive',()=>{
  const src=code(mod,'async function clearall(){','const targets=');
  assert.match(src,/UnifiedArchiveResetUnavailable/);assert.match(src,/clearModuleArchive\(\)/);
  assert.match(src,/await getdb\(\)/);assert.doesNotMatch(src,/else state=fresh\(\)/);
});
test('Excel reading shows stage and unlocks file chooser in finally even after error',()=>{
  const src=code(mod,'let auxExcelBusy=false;','function importModal(){');
  assert.match(src,/auxExcelBusy=true/);
  assert.match(src,/setAuxWorkStatus\('正在读取 Excel \/ CSV…'\)/);
  assert.match(src,/finally\{\s*auxExcelBusy=false;PlAuxIssueReport\.setDisabled\(fileInput,false\)/);
  assert.doesNotMatch(src,/__moduleExcelBackendError\(err\.message\)/);
});
test('storage diagnostic blocks repeated run and finally releases lock',()=>{
  const src=code(diag,'async function run(){','async function copy(){');
  assert.match(src,/if\(checkBusy\)return/);
  assert.match(src,/checkBusy=true/);
  assert.match(src,/finally\{checkBusy=false;PlAuxIssueReport\.setDisabled\(runBtn,false\)/);
});
test('read-only storage open completes cleanly after onblocked then late success',async()=>{
  const script=code(diag,'async function inspectExisting(name){','async function run(){');
  const req={},close={value:false};
  const c=runVM(script,{
    indexedDB:{open:()=>req},withDeadline:x=>x,Array,Number,String,Set
  });
  const p=c.inspectExisting('database');
  req.onblocked();
  const result=await p;assert.equal(result.blocked,true);
  req.result={close(){close.value=true}};req.onsuccess();assert.equal(close.value,true);
});
test('storage deadline actually rejects hung database enumeration instead of hanging permanently',async()=>{
  const src=code(diag,'function withDeadline(promise,ms=12000){','function wrapReport(');
  const c=runVM(src,{Promise,setTimeout,clearTimeout,Error});
  await assert.rejects(c.withDeadline(new Promise(()=>{}),5),/StorageCheckTimeout/);
});
test('partial storage database failures must not generate a successful full-check report',()=>{
  const src=code(diag,'async function run(){','async function copy(){');
  assert.match(src,/let partial=false/);
  for(const status of ['info.blocked','info.error','info.missing'])assert.ok(src.includes(`if(${status}){partial=true`));
  assert.match(src,/wrapReport\(partial\?'failed':'ok'/);
  assert.match(src,/检查未全部完成/);
});
test('storage UI retains explicit read-only copy/download reasons and stage counters',()=>{
  assert.match(diag,/id="reportHelp"/);
  assert.match(diag,/setReportAvailable\(false\)/);
  assert.match(diag,/正在检查 \$\{index\+1\}\/\$\{targets\.length\}/);
  assert.match(diag,/PlAuxIssueReport\.setDisabled\(btn,!ok/);
  assert.match(diag,/setAttribute\('aria-describedby','reportHelp'\)/);
});
test('new release does not touch schema, archive migration primitives, media formats, or private user files',()=>{
  const m=JSON.parse(read('production-release-manifest.json'));
  assert.equal(status.current.schemaVersion,26);
  assert.ok(m.privateExtensionsForbidden.includes('.xlsx'));
  assert.ok(m.privateExtensionsForbidden.includes('.zip'));
  for(const name of ['index.html','module-tools.html','storage-diagnostic.html'])assert.ok(m.rootFiles.includes(name));
});
