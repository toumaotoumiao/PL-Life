#!/usr/bin/env python3
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
start=SRC.index('/* ===== Stage88 · 手机规则选择面板锚定与可关闭保障 ===== */')
end=SRC.index('/* ===== 主应用运行增强 · PC 档案长期管理与 Excel 导入 ===== */',start)
logic=SRC[start:end]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round262-evidence'
out.mkdir(parents=True,exist_ok=True)
checks=[]
def ck(name,val):
    checks.append((name,bool(val)))
    if not val: raise AssertionError(name)
html='''<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;font:14px system-ui}body{min-height:1300px;padding:12px;background:#f5f5f8}
.native-module-rule-menu{position:relative;width:250px}.native-module-rule-menu>summary{position:relative;z-index:102;min-height:42px;padding:10px;border:1px solid #aaa;background:#fff;list-style:none}
.native-module-rule-popover{position:fixed;left:10px;right:10px;top:var(--mobile-rule-popover-top,70px);max-height:var(--mobile-rule-popover-max-height,300px);overflow:auto;z-index:101;padding:12px;border:1px solid #777;background:white}
.spacer{height:500px}.panel-content{height:260px}.outside{margin-top:20px;height:44px}
</style>
<details class="native-module-rule-menu" id="m1"><summary id="s1">规则一</summary><div class="native-module-rule-popover"><div class="panel-content">A</div></div></details>
<div style="height:30px"></div>
<details class="native-module-rule-menu" id="m2"><summary id="s2">规则二</summary><div class="native-module-rule-popover"><div class="panel-content">B</div></div></details>
<button class="outside" id="outside">外部</button><div class="spacer"></div>
<details class="native-module-rule-menu" id="low"><summary id="slow">靠近底部的规则</summary><div class="native-module-rule-popover"><div class="panel-content">C</div></div></details>
'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    try:
        for width in (320,390,430):
            page=browser.new_page(viewport={'width':width,'height':640})
            page.set_content(html)
            page.add_script_tag(content=logic)
            page.click('#s1'); page.wait_for_timeout(80)
            pos=page.evaluate('''()=>{const s=s1.getBoundingClientRect(),p=m1.querySelector('.native-module-rule-popover').getBoundingClientRect();return {open:m1.open,st:s.top,sb:s.bottom,pt:p.top,ph:p.height}}''')
            ck(f'{width}:open-below',pos['open'] and pos['pt']>=pos['sb']+7)
            page.click('#outside'); page.wait_for_timeout(30)
            ck(f'{width}:outside-close',not page.evaluate('m1.open'))
            page.click('#s1'); page.wait_for_timeout(30)
            page.keyboard.press('Escape'); page.wait_for_timeout(30)
            esc=page.evaluate('()=>({open:m1.open,focus:document.activeElement===s1})')
            ck(f'{width}:escape-close-focus',not esc['open'] and esc['focus'])
            page.click('#s1'); page.wait_for_timeout(30); page.click('#s2'); page.wait_for_timeout(60)
            only=page.evaluate('()=>({a:m1.open,b:m2.open})')
            ck(f'{width}:single-open',not only['a'] and only['b'])
            page.evaluate('low.scrollIntoView({block:"end"})'); page.wait_for_timeout(30)
            before=page.evaluate('slow.getBoundingClientRect().bottom')
            page.click('#slow'); page.wait_for_timeout(100)
            low=page.evaluate('''()=>{const s=slow.getBoundingClientRect(),p=low.querySelector('.native-module-rule-popover'),r=p.getBoundingClientRect(),mh=parseFloat(getComputedStyle(p).maxHeight);return {open:low.open,sb:s.bottom,pt:r.top,mh,vh:innerHeight,scrollY}}''')
            ck(f'{width}:low-trigger-nudged',low['open'] and low['sb']<before-20)
            ck(f'{width}:low-panel-still-below',low['pt']>=low['sb']+7)
            ck(f'{width}:low-panel-bounded',low['pt']+low['mh']<=low['vh']-8+1)
            page.screenshot(path=str(out/f'round262-{width}.png'),full_page=False)
            page.close()
    finally:
        browser.close()
report={'tests':len(checks),'passed':sum(v for _,v in checks),'failed':[n for n,v in checks if not v],'mode':'isolated production Stage88 popover runtime + synthetic DOM'}
(out/'round262-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
