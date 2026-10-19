#!/usr/bin/env python3
from pathlib import Path
import json, os, threading, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
checks=[]
def rec(label,ok,detail=''): checks.append({'test':label,'pass':bool(ok),'detail':detail})
class Quiet(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(root),**k)
    def log_message(self,*a): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Quiet);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
try:
  with sync_playwright() as p:
    exe=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
    for width,height in [(390,844),(1280,900)]:
      ctx=browser.new_context(service_workers='block',viewport={'width':width,'height':height},accept_downloads=True)
      page=ctx.new_page();page.goto(base+'/index.html',wait_until='domcontentloaded',timeout=120000)
      page.wait_for_function("typeof openSettings==='function' && typeof activateSettingsPanel==='function' && typeof renderDeviceMigrationStatus==='function'",timeout=120000)
      page.evaluate("openSettings(); activateSettingsPanel('migration');")
      page.wait_for_selector('[data-settings-panel="migration"]:not([hidden])',timeout=30000)
      body=page.locator('[data-settings-panel="migration"]')
      rec(f'{width}: primary old device one button',body.locator('#deviceMigrationExportBtn').is_visible() and body.locator('#deviceMigrationVerifyCurrentBtn').evaluate("el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)' || el.classList.contains('migration-secondary-link')"))
      rec(f'{width}: heritage export absent from landing',body.locator('#heritageExportBtn').count()==0)
      page.evaluate("renderDeviceMigrationStatus('passed',{file:{name:'测试完整备份.zip',size:44000000},summary:{profiles:5,pcs:12,modules:9,records:24,media:31,workbooks:7}}); document.getElementById('deviceMigrationRestoreBtn').hidden=false; document.getElementById('deviceMigrationRestoreBtn').disabled=false; document.getElementById('deviceMigrationInspectBtn').textContent='更换文件';")
      rec(f'{width}: verified card visible',page.locator('.migration-file-card').is_visible() and '44 MB' in page.locator('.migration-file-card').inner_text())
      rec(f'{width}: verified card counts','PC' in page.locator('.migration-file-card').inner_text() and '12' in page.locator('.migration-file-card').inner_text())
      rec(f'{width}: restore becomes dominant',page.locator('#deviceMigrationRestoreBtn').is_visible() and page.locator('#deviceMigrationInspectBtn').inner_text()=='更换文件')
      page.locator('#heritageReviewBtn').click();page.wait_for_selector('#heritageReviewDialog[open]',timeout=30000)
      rec(f'{width}: heritage export in dialog',page.locator('#heritageReviewDialog #heritageExportBtn').is_visible())
      page.locator('#heritageReviewClose').click()
      page.evaluate("showContextIssue({level:'warning',title:'迁移恢复未完成',area:'设置 → 导入与迁移 → 新设备',action:'恢复已核验备份',status:'检查停在测试阶段。',next:'下载错误报告。',diagnostics:'问题编号：ROUND290-SYNTH\\n执行阶段：预检 PC 附件数据库\\n错误类型：AbortError\\nAbortError: synthetic',contextActions:[{label:'检查本机存储',run:()=>{}},{label:'重新选择备份',run:()=>{}}]});")
      page.wait_for_selector('#actionDialogBackdrop:not([hidden])',timeout=30000)
      msg=page.locator('#actionDialogMessage').inner_text()
      rec(f'{width}: visible stage in error','阶段：预检 PC 附件数据库' in msg,msg)
      rec(f'{width}: direct recovery actions',page.locator('#actionDialogContextActions button').count()==2 and '检查本机存储' in page.locator('#actionDialogContextActions').inner_text())
      page.locator('#actionDialogDiagnostics summary').click();report=page.locator('#actionDialogDiagnosticText').inner_text()
      rec(f'{width}: exact problem path','问题路径：设置 → 导入与迁移 → 新设备 → 恢复已核验备份 → 预检 PC 附件数据库' in report,report[:1000])
      page.screenshot(path=str(out/f'round290-migration-closeout-{width}.png'),full_page=True)
      ctx.close()
    browser.close()
finally:
  server.shutdown();server.server_close()
version=re.search(r'const APP_UI_VERSION = ["\']([^"\']+)',(root/'index.html').read_text('utf8')).group(1)
report={'version':version,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
(out/'round290-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND290',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
