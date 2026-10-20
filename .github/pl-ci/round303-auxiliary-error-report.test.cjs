'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const helper=read('aux-issue-report.js'),mod=read('module-tools.html'),diag=read('storage-diagnostic.html'),main=read('index.html'),sw=read('sw.js');
const status=JSON.parse(read('CURRENT_PROJECT_STATUS.json')),manifest=JSON.parse(read('production-release-manifest.json'));
function context(){const c={window:{},document:{},Blob,URL,Date,Set,String,Math};vm.createContext(c);vm.runInContext(helper,c);return c.window.PlAuxIssueReport;}
test('Stage133 sole current version and four-round closeout has clear 1/4–4/4',()=>{
 assert.ok(status.current.stage>=133);assert.equal(status.current.appVersion,JSON.parse(read('production-release-manifest.json')).appVersion);assert.equal(status.current.schemaVersion,26);
 assert.equal(status.fourRoundCloseout.rounds.length,4);assert.deepEqual(status.fourRoundCloseout.rounds.map(x=>x.stage),[133,134,135,136]);
 assert.ok(main.includes(`const APP_UI_VERSION = "${status.current.appVersion}"`));
});
test('shared anonymous report has common diagnostic fields and no arbitrary raw error text',()=>{
 const r=context().report({code:'MODULE-TEST',area:'模组高级工具',action:'保存',phase:'存储回读',state:'无法确认',next:'检查本机状态',error:{name:'DangerousCustomException',message:'private_person_王某_秘密文件.xlsx',stack:'file:///home/user/private'}});
 for(const term of ['问题编号：MODULE-TEST','发生位置：模组高级工具','执行操作：保存','执行阶段：存储回读','当前状态：无法确认','建议处理：检查本机状态',`程序版本：v${status.current.appVersion}`,'数据结构：schema26'])assert(r.includes(term),term);
 assert(!r.includes('王某'));assert(!r.includes('private'));assert(!r.includes('file:///'));assert(r.includes('错误类型：Error'));
});
test('helper only exposes sanitized error name whitelist',()=>{
 const h=context();assert.equal(h.safeType({name:'QuotaExceededError'}),'QuotaExceededError');
 assert.equal(h.safeType({name:'secret_data_here'}),'Error');assert.equal(h.safeType({name:'__proto__'}),'Error');
});
test('module-tool error report panel only shown on failure with copy, download and dismiss',()=>{
 for(const id of ['auxIssuePanel','auxIssueCopy','auxIssueDownload','auxIssueDismiss','auxIssueDetails'])assert(mod.includes(`id="${id}"`),id);
 assert(mod.includes('function showAuxIssue('));assert(mod.includes("panel.hidden=false"));assert(mod.includes("dismiss.onclick=()=>"));
 assert(mod.includes('PlAuxIssueReport.copy(latestAuxIssue)'));assert(mod.includes('PlAuxIssueReport.download(latestAuxIssue)'));
});
test('module save distinguishes re-read success from unconfirmed persistence',()=>{
 assert(mod.includes('let restored=false'));assert(mod.includes('restored=true'));
 assert(mod.includes('保存失败 · 已回读上次档案'));assert(mod.includes('保存失败 · 本机状态待核对'));
 assert(mod.includes('MODULE-SAVE-FAIL'));assert(mod.includes('MODULE-BACKUP-IMPORT'));
 for(const code of ['MODULE-EXCEL-IMPORT','MODULE-EXCEL-EXPORT','MODULE-QUERY-FAIL'])assert(mod.includes(code),code);
});
test('storage diagnostic is read-only and export actions gated on a finished check',()=>{
 for(const id of ['copy','download'])assert.match(diag,new RegExp(`id="${id}"[^>]*disabled`));
 assert(diag.includes('function setReportAvailable('));assert(diag.includes("reportText=wrapReport(partial?'failed':'ok'"));assert(diag.includes("let partial=false"));
 assert(diag.includes("reportText=wrapReport('failed'"));assert(diag.includes('PlAuxIssueReport.download(reportText)'));
 assert(!diag.includes("${String(err?.message||err).slice(0,500)}"));
});
test('offline deployment includes shared helper in both immutable app shell and production manifest',()=>{
 assert(manifest.rootFiles.includes('aux-issue-report.js'));
 assert(sw.includes('"./aux-issue-report.js"'));
 assert(mod.includes('src="./aux-issue-report.js"'));assert(diag.includes('src="./aux-issue-report.js"'));
 assert.match(read('.github/workflows/pl-browser-synthetic.yml'),/round303-auxiliary-error-report\.test\.cjs/);
});
test('Nielsen progress remains conservatively partial and release is not claimed accepted',()=>{
 assert.equal(status.nielsen20Audit.completeCode,9);assert.equal(status.nielsen20Audit.partialCode,11);
 assert.ok(['candidate-in-progress-not-deployed','candidate-ready-not-deployed','hold-production-not-deployed-pending-test-site-and-real-device'].includes(status.currentVersionAcceptance.release.status));
});

test('download builds a local text Blob, sanitized filename and cleans DOM anchor',()=>{
 let appended=false,clicked=false,removed=false,revoked='';
 const anchor={href:'',download:'',click(){clicked=true},remove(){removed=true}};
 const dom={body:{appendChild(x){assert.equal(x,anchor);appended=true}},createElement(tag){assert.equal(tag,'a');return anchor}};
 const c={window:{},document:dom,Blob,URL:{createObjectURL(){return 'blob:local'},revokeObjectURL(url){revoked=url}},setTimeout(fn){fn()},Date,Set,String,Math};
 vm.createContext(c);vm.runInContext(helper,c);
 assert.equal(c.window.PlAuxIssueReport.download('safe-report'),true);
 assert(appended&&clicked&&removed);assert.equal(revoked,'blob:local');assert.match(anchor.download,/匿名错误报告_/);
});
test('copy uses clipboard when available and returns true',async()=>{
 let value='';const c={window:{},document:{},navigator:{clipboard:{writeText:async txt=>{value=txt}}},Blob,URL,Date,Set,String,Math};
 vm.createContext(c);vm.runInContext(helper,c);
 assert.equal(await c.window.PlAuxIssueReport.copy('anonymous diagnostic'),true);
 assert.equal(value,'anonymous diagnostic');
});
