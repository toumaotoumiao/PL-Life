#!/usr/bin/env python3
"""Stage147 real Chromium diagnostic widget smoke; NOT a full-origin PL-Life test.
The runner intentionally refuses to claim full-site IndexedDB or ZIP acceptance.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text(encoding='utf-8')
a=html.index('function issueDiagnosticValue(');b=html.index('function showPendingRunSaveIssue(',a)
source=html[a:b]
private='CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx'
setup='''
const APP_UI_VERSION='8.1.12.325',DATA_SCHEMA_VERSION=26;
const ISSUE_REPORT_SESSION_KEY='stage147-browser-diagnostic';
const memory={};let latestIssueReportMemory='';
const sessionStorage={getItem:k=>memory[k]||null,setItem:(k,v)=>{memory[k]=v}};
let actionDialogResolver=null,queuedContextIssues=[];
function showToast(){}
function downloadBlobFile(blob,name){window.__downloadPromise=blob.text();window.__downloadName=name;return true}
function openActionDialog(message,opts){window.__shownDialog={message,opts};return Promise.resolve(true)}
'''
ui='''
const btn=document.getElementById('try');const view=document.getElementById('output');
btn.addEventListener('click',()=>{
  const error={name:'AbortError',message:'CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx',
    plStorageFailure:'browser-database-unreadable',
    plDbDiagnostic:{oldVersion:0,newVersion:3,transactionError:'NotReadableError: CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx'}};
  const incident=plBuildDiagnosticIncident({error,source:'openPcMediaDbAtVersion',module:'PC_ATTACHMENT_STORAGE',phase:'预检 PC 附件数据库',zipCheck:'passed',writeState:'not-started'});
  const legitimate=buildIssueReport({area:'设置 → 恢复资料',diagnostics:'问题编号：DEVICE-MIGRATION-RESTORE\\n错误类型：AbortError',incident});
  const forged=legitimate+'\\n原始异常：CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx';
  persistIssueReport(forged,{area:'设置 → CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx'});
  const exported=plReportForDownload(latestIssueReport());
  downloadIssueReportText(forged);
  view.textContent=exported;
  window.__safeResult={code:exported.includes('IDB_BACKING_STORE_UNREADABLE'),
      detail:exported.includes('NotReadableError'),
      noPrivate:!exported.includes('CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx'),
      noPrivateInStorage:!JSON.stringify(memory).includes('CONFIDENTIAL_PC__STORY__2026__C_Users_SECRET.xlsx')};
});
'''
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':760})
   page.set_content('''<html lang="zh"><body><h1>PL-Life 诊断组件独立运行测试</h1>
    <button id="try" type="button">模拟恢复预检报错并生成报告</button><pre id="output"></pre></body></html>''')
   page.add_script_tag(content=setup+source+ui)
   page.locator('#try').click()
   state=page.evaluate('window.__safeResult')
   downloaded=page.evaluate('window.__downloadPromise')
   assert all(state.values()), f'width={width} {state}'
   assert private not in downloaded
   assert '事务提交状态：未开始写入' in downloaded
   assert 'ZIP 只读核验：passed' in downloaded
   assert '故障类别：IDB_BACKING_STORE_UNREADABLE' in page.locator('#output').inner_text()
   results.append({'viewport':width,'passed':True,'checks':state,'downloadBytes':len(downloaded.encode())})
   page.close()
 finally:browser.close()
print(json.dumps({'kind':'chromium-diagnostic-isolated','fullSiteOriginTest':False,'results':results},ensure_ascii=False))
