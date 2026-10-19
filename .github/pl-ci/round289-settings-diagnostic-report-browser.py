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
      page.wait_for_function("typeof openSettings==='function' && typeof activateSettingsPanel==='function'",timeout=120000)
      page.evaluate("openSettings(); activateSettingsPanel('migration');")
      page.wait_for_selector('[data-settings-panel="migration"]:not([hidden])',timeout=30000)
      body=page.locator('[data-settings-panel="migration"]')
      text=body.inner_text()
      rec(f'{width}: migration primary labels',all(x in text for x in ['换设备','旧设备','新设备','导出完整备份','选择备份','历史数据','高级工具']),text[:500])
      rec(f'{width}: advanced diagnostics collapsed by default',not page.locator('.settings-advanced-tools').evaluate('(el)=>el.open'))
      rec(f'{width}: restore action hidden before verification',page.locator('#deviceMigrationRestoreBtn').is_hidden())
      page.screenshot(path=str(out/f'round289-settings-{width}.png'),full_page=True)
      # Generate a synthetic warning through the real user-facing path.
      page.evaluate("showContextIssue({level:'warning',title:'测试问题',area:'设置 → 导入与迁移 → 新设备',action:'核验备份',status:'文件核验在测试阶段停止；当前档案保持原状态。',next:'下载错误报告后检查问题编号。',diagnostics:'问题编号：ROUND289-SYNTH\\n执行阶段：ZIP 结构核验\\n错误类型：SyntheticError\\n文件名：private_name.zip\\nError: synthetic stack'}); ")
      page.wait_for_selector('#actionDialogBackdrop:not([hidden])',timeout=30000)
      page.locator('#actionDialogDiagnostics summary').click()
      report=page.locator('#actionDialogDiagnosticText').inner_text()
      rec(f'{width}: report includes exact location and stage','发生位置：设置 → 导入与迁移 → 新设备' in report and '执行阶段：ZIP 结构核验' in report,report[:800])
      rec(f'{width}: report masks filename','private_name.zip' not in report and '[文件名已隐藏]' in report,report[:800])
      rec(f'{width}: report actions visible',page.locator('#actionDialogCopyReport').is_visible() and page.locator('#actionDialogDownloadReport').is_visible())
      with page.expect_download(timeout=30000) as di:
        page.locator('#actionDialogDownloadReport').click()
      dl=di.value
      rec(f'{width}: downloadable report filename',dl.suggested_filename.startswith('PL-Life_错误报告_ROUND289-SYNTH_'),dl.suggested_filename)
      page.screenshot(path=str(out/f'round289-error-report-{width}.png'),full_page=True)
      ctx.close()
    browser.close()
finally:
  server.shutdown();server.server_close()
version=re.search(r'const APP_UI_VERSION = ["\']([^"\']+)',(root/'index.html').read_text('utf8')).group(1)
report={'version':version,'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']]}
(out/'round289-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print('ROUND289',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
