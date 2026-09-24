'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const site=fs.existsSync(path.join(root,'site','index.html'))?path.join(root,'site'):root;
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const adapters=require(path.join(site,'field-adapters.js'));
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert(start>=0&&end>start,a);return html.slice(start,end)}
function runtime(){
 const c={MAX_LOG_URLS:12,MAX_LOG_LABEL_LENGTH:30,escapeHTML:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),safeLogUrl:s=>/^https:\/\//.test(s)?s:'',Date};
 vm.createContext(c);vm.runInContext(section('function normalizeLogRows(', '\nfunction isoDatePart('),c);return c;
}
test('only a note is a saved Log entry and is represented in the query adapter',()=>{
 const c=runtime(),r={id:'fictional',logUrls:[''],logLabels:['未贴链接的记录'],logUrl:''};
 assert.equal(c.entityHasLog(r),true);
 assert.equal(adapters.validLogs(r),1);
 assert.deepEqual(Array.from(c.filledLogUrls(r)),[]);
 assert.match(c.readonlyLogLinksHTML(r),/未贴链接的记录/);
});
test('multiple standalone notes are counted without inventing website addresses',()=>{
 const r={logUrls:['','',''],logLabels:['笔记甲','笔记乙','笔记丙']};
 assert.equal(adapters.validLogs(r),3);
 assert.equal(adapters.validLogs({logEntries:[{url:'',label:'笔记甲'},{url:'',note:'笔记乙'}]}),2);
});
test('same URL counts once while standalone notes count individually',()=>{
 const r={logUrls:['https://example.invalid/a','https://example.invalid/a','',''],logLabels:['网站A','网站A','笔记甲','笔记乙'],logUrl:'https://example.invalid/a'};
 assert.equal(adapters.validLogs(r),3);
});
test('clicking add Log keeps an existing note-only row and appends a separate blank row',()=>{
 const c=runtime(),r={logUrls:[''],logLabels:['暂存团后心得']};
 const idx=c.appendEntityLogUrl(r);
 assert.equal(idx,1);
 assert.deepEqual(Array.from(c.normalizeLogRows(r,true),x=>({url:x.url,label:x.label})),[{url:'',label:'暂存团后心得'},{url:'',label:''}]);
});
test('clicking add Log reuses a fully empty row without duplicating it',()=>{
 const c=runtime(),r={logUrls:['https://example.invalid/a',''],logLabels:['网站A','']};
 assert.equal(c.appendEntityLogUrl(r),1);
 assert.equal(c.normalizeLogRows(r,true).length,2);
});
test('at capacity, adding Log does not mutate stored notes or URL',()=>{
 const c=runtime(),r={logUrls:Array(12).fill(''),logLabels:Array.from({length:12},(_,i)=>`笔记${i}`)};
 const before=JSON.stringify(r);
 assert.equal(c.appendEntityLogUrl(r),-1);
 assert.equal(JSON.stringify(r),before);
});
test('status selectors restore actual saved state if storage rejects a mutation',()=>{
 assert.match(html,/const saved = mutateRunPlan\(planId, plan => \{ plan\.tableStatus = value; \}/);
 assert.match(html,/if \(!saved\) e\.target\.value = normalizeTableStatus\(runPlans\.find\(plan => plan\.id === planId\)\?\.tableStatus, "plan"\)/);
 assert.match(html,/else e\.target\.value = normalizeTableStatus\(runRecords\.find\(record => record\.id === recordId\)\?\.tableStatus, "record"\)/);
});
test('record header and PL activity distinguish Log URL and Log-only notes',()=>{
 assert.match(html,/logCount && draftNotes \? `\$\{logCount\} 个 Log · \$\{draftNotes\} 条备注`/);
 assert.match(html,/entityHasLog\(r\) && \(filledLogUrls\(r\)\.length \? "有 Log" : "有 Log 备注"\)/);
});
