#!/usr/bin/env python3
"""Read-only browser acceptance on PL-Life-Test; no user content, screenshots or state changes are collected.
Run only after publishing a candidate to TEST, never on the formal production site.
"""
import argparse
import asyncio
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEST_URL = 'https://toumaotoumiao.github.io/PL-Life-Test/'
WIDTHS = (320, 375, 390, 430, 768, 1024, 1280, 1440)
THEMES = ('mist','tomato','night')

def verify_target(url, allow_local=False):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == 'https' and parsed.hostname == 'toumaotoumiao.github.io' and parsed.path.rstrip('/') == '/PL-Life-Test':
        return
    if allow_local and parsed.scheme == 'http' and parsed.hostname in ('localhost','127.0.0.1'):
        return
    raise ValueError('仅允许 PL-Life-Test；生产站及其他地址禁止执行自动验收。')

def build_args():
    parser = argparse.ArgumentParser(description='PL-Life Stage140 read-only TEST site acceptance')
    parser.add_argument('--url',default=DEFAULT_TEST_URL)
    parser.add_argument('--output',default='stage140-live-site-result.json')
    parser.add_argument('--allow-local',action='store_true',help='allow an explicitly supplied local development server')
    parser.add_argument('--navigation-timeout-ms',type=int,default=25000)
    return parser.parse_args()

async def check(args, report):
    from playwright.async_api import async_playwright
    expected = report['expectedVersion']
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            context = await browser.new_context(viewport={'width':390,'height':844},service_workers='block')
            page = await context.new_page()
            page_errors = []
            page.on('pageerror', lambda exc: page_errors.append(type(exc).__name__))
            response=await page.goto(args.url,wait_until='domcontentloaded',timeout=args.navigation_timeout_ms)
            report['httpStatus']=response.status if response else None
            if response is None or response.status != 200:
                raise RuntimeError('页面 HTTP 状态不符合要求。')
            actual = await page.evaluate("""() => {
              const ss=[...document.scripts].map(s=>s.textContent||'').join('\\n');
              const m=ss.match(/const APP_UI_VERSION\\s*=\\s*["']([^"']+)/);
              return m ? m[1] : null;
            }""")
            report['observedVersion']=actual
            if actual != expected:
                raise RuntimeError('测试站版本与候选工程不一致，停止验收。')
            await page.wait_for_selector('#settingsBtn',state='attached',timeout=12000)
            for theme in THEMES:
                await page.evaluate("(theme)=>document.documentElement.setAttribute('data-theme',theme)",theme)
                for width in WIDTHS:
                    await page.set_viewport_size({'width':width,'height':844})
                    result=await page.evaluate("""() => {
                       let root=document.documentElement;
                       let body=document.body;
                       let settings=document.getElementById('settingsBtn');
                       return {
                         horizontalOverflow: root.scrollWidth > innerWidth+2 || body.scrollWidth > innerWidth+2,
                         settingsReachable:!!settings && !!settings.getClientRects().length,
                         pageHasBody:!!body && body.children.length>0
                       };
                    }""")
                    report['layoutCases'].append({'width':width,'theme':theme,**result})
            report['pageErrorsCount']=len(page_errors)
            report['passed']=(len(report['layoutCases'])==24 and
                all((not c['horizontalOverflow']) and c['settingsReachable'] and c['pageHasBody'] for c in report['layoutCases']) and
                report['pageErrorsCount']==0)
            if not report['passed']:
                report['blockers'].append('测试站运行或24组布局检查存在失败。')
        finally:
            await browser.close()

def main():
    args=build_args()
    status=json.loads((ROOT/'CURRENT_PROJECT_STATUS.json').read_text(encoding='utf-8'))
    report={'format':'pl-life-live-site-readonly-result','timestampUTC':datetime.now(timezone.utc).isoformat(),
      'expectedVersion':status['current']['appVersion'],'observedVersion':None,'httpStatus':None,
      'siteType':'test-site','checks':'24 actual runtime viewport/theme combinations; read-only DOM geometry',
      'layoutCases':[],'pageErrorsCount':None,'passed':False,'blockers':[],
      'scopeLimit':'不测试真机、备份恢复写入、Excel导入、拖拽或图片导出；不会收集档案内容。'}
    try:
        verify_target(args.url,args.allow_local)
        asyncio.run(check(args,report))
    except Exception as exc:
        # Deliberately do not include the underlying exception text: URLs and page data stay private.
        report['blockers'].append('无法完成测试站运行验收：'+type(exc).__name__)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PASS' if report['passed'] else 'BLOCKED',report['expectedVersion'],len(report['layoutCases']),'layout cases')
    return 0 if report['passed'] else 1
if __name__=='__main__':
    sys.exit(main())
