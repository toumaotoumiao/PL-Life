#!/usr/bin/env python3
"""Stage34: production preflight, actual Settings integrity renderer and locate action.
Uses fictional records only and an isolated about:blank DOM. Native storage is NOT exercised."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,re
ROOT=Path(__file__).resolve().parents[2]
SOURCE=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round180-evidence'
OUT.mkdir(parents=True,exist_ok=True)

def excerpt(a,b):
 i=SOURCE.index(a);j=SOURCE.index(b,i);assert j>i,a;return SOURCE[i:j]
audit=excerpt('function pcArchivePreflightIssues(', 'const v8181DataIntegrityReport=dataIntegrityReport;')
render=excerpt('renderDataIntegrity = function (report = dataIntegrityReport(), showList = false) {','function integrityIssueById(id)')
locate=excerpt('function locateIntegrityIssue(issue) {','/* v8.1.12.119')
# The site's actual stylesheet, not a redrawn UI.
css='\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',SOURCE,re.S|re.I))
fixture=[{'id':'pc-A','name':'模拟 BRP 角色甲','ruleSheets':{'brp-generic':{'traits':[],'skills':[],'resources':[]}},'avatarMediaId':'same-id-'+'A'*70,'galleryMediaIds':['same-id-'+'A'*70]},
 {'id':'pc-B','name':'模拟 Insane 角色乙','ruleSheets':{'insane':{'traits':[],'skills':[],'resources':[]}},'galleryMediaIds':['same-id-'+'A'*70]}]
script='''
let lastIntegrityReport=null,renderDataIntegrity;
const els={dataIntegrityHealthValue:document.getElementById('health'),dataIntegrityHealthSub:document.getElementById('sub'),dataIntegrityResults:document.getElementById('dataIntegrityResults')};
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pcValidateArchiveInput(pc){return pc.ruleSheets?.broken?'规则模板损坏':'';}
let pcs=FIXTURE;
let opened=null,visited='',settingsClosed=false;
function closeSettings(){settingsClosed=true;}
function switchView(v){visited=v;}
function openPcEditor(id){opened=id;}
function dataIntegrityReport(){return {issues:pcArchivePreflightIssues(pcs).map((x,i)=>({...x,id:'issue_'+(i+1),action:{view:'pcs',pcId:x.pcId},fix:null})),errors:1,warnings:0};}
'''.replace('FIXTURE',json.dumps(fixture,ensure_ascii=False))+'\n'+audit+'\n'+render+'\n'+locate+'''
renderDataIntegrity(dataIntegrityReport(),true);
document.getElementById('dataIntegrityResults').addEventListener('click',e=>{const b=e.target.closest('[data-integrity-locate]');if(b)locateIntegrityIssue(lastIntegrityReport.issues.find(x=>x.id===b.dataset.integrityLocate));});
'''
checks=[]
def ck(k,yes):
 checks.append((k,bool(yes)))
 if not yes:raise AssertionError(k)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PL_CI_CHROMIUM_EXECUTABLE','/usr/bin/chromium'),args=['--no-sandbox'])
 try:
  page=browser.new_page(viewport={'width':375,'height':900})
  page.set_content('<!doctype html><meta charset="utf-8"><style>'+css+'''</style><main style="max-width:880px;margin:0 auto;padding:12px;min-width:0"><section class="data-health-card" style="padding:12px;background:var(--t-surface)"><strong id="health"></strong><p id="sub"></p><div id="dataIntegrityResults" class="data-integrity-results"></div></section></main>''')
  page.evaluate("document.documentElement.dataset.theme='mist'")
  page.add_script_tag(content=script)
  for w in (320,375,390,430,768,1024,1280,1440):
   page.set_viewport_size({'width':w,'height':900})
   ck(f'{w}:warn-visible',page.locator('.integrity-item.error').count()==1)
   ck(f'{w}:wording', '模拟 BRP' in page.locator('.integrity-item small').inner_text() and '模拟 Insane' in page.locator('.integrity-item small').inner_text())
   ck(f'{w}:no-horizontal-overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   ck(f'{w}:readable-text',page.locator('.integrity-item strong').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=13'))
   ck(f'{w}:touch-button',page.locator('[data-integrity-locate]').evaluate('e=>e.getBoundingClientRect().height >= (innerWidth<=760?43:39)'))
   if w in (320,375,1280):page.screenshot(path=str(OUT/f'audit-{w}.png'),full_page=True)
  for name,theme in [('plain','mist'),('tomato','tomato'),('night','night')]:
   page.set_viewport_size({'width':375,'height':900})
   page.evaluate('v=>document.documentElement.dataset.theme=v',theme)
   ck(name+':visible',page.locator('.integrity-item.error').is_visible())
   ck(name+':overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   page.screenshot(path=str(OUT/f'audit-{name}-375.png'),full_page=True)
  page.locator('[data-integrity-locate]').click()
  ck('exact-record-navigation',page.evaluate("opened==='pc-B'&&visited==='pcs'&&settingsClosed"))
  ck('no-source-mutation',page.evaluate("JSON.stringify(pcs)===JSON.stringify("+json.dumps(fixture,ensure_ascii=False)+")"))
  page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(x[1] for x in checks),'failed':[x[0] for x in checks if not x[1]],'mode':'actual production preflight + Settings renderer + exact-PC locate branch in isolated Chromium; no native IndexedDB'}
(OUT/'round180-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
