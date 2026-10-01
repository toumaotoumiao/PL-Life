#!/usr/bin/env python3
"""Stage66 private-data-free structural preview layout; no user workbook loaded."""
from pathlib import Path
import json,os
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text('utf8')
style='\n'.join(x.get_text() for x in BeautifulSoup(html,'html.parser').find_all('style'))
a=html.index('const PC_DND_STRUCTURE_LAYOUTS=Object.freeze({')
b=html.index('async function pcDndStructurePreviewFile(',a)
pure=html[a:b]
markup='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body><div class="pc-manage-backdrop" id="pcDndPreviewBackdrop"><section class="pc-manage-dialog" role="dialog"><header class="pc-manage-head"><div><strong>D&D 5e Excel 结构识别</strong></div><button class="icon-close" type="button">×</button></header><div class="pc-manage-body" id="pcDndPreviewBody"></div><footer class="pc-manage-foot"><span>不展示或保存角色数值</span><button class="btn primary" type="button">关闭预览</button></footer></section></div></body></html>'
source="""const pcInsaneSheetCell=(sheet,ref)=>{const m=/^([A-Z]+)([1-9]\\d*)$/.exec(ref);let n=0;for(const c of m[1])n=n*26+c.charCodeAt(0)-64;return sheet.rows[Number(m[2])-1]?.[n-1]??'';};
"""+pure+"""
const sheets=Array.from({length:21},()=>({rows:[]}));const r=Array.from({length:30},()=>[]);
['力量','敏捷','体质','智力','感知','魅力'].forEach((x,i)=>r[11+2*i][2]=x);
r[1][2]='SYNTHETIC_PRIVATE_VALUE';Object.defineProperty(r,'formulaRefs',{value:new Set(['F12','F14','F16','F18','F20','F22'])});sheets[1]={name:'SYNTHETIC_PRIVATE_SHEET_NAME',rows:r};
const model=pcDndStructurePreviewFromSheets(sheets);document.getElementById('pcDndPreviewBody').innerHTML=pcDndStructurePreviewHTML(model);
"""
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':800});page.set_content(markup);page.add_script_tag(content=source)
   r=page.evaluate('''() => {const d=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),b=document.querySelector('.pc-manage-foot button').getBoundingClientRect(),content=document.querySelector('#pcDndPreviewBody').textContent;return {scroll:document.documentElement.scrollWidth,dialogLeft:d.left,dialogRight:d.right,buttonHeight:b.height,buttonRight:b.right,privateFound:content.includes('SYNTHETIC_PRIVATE_'),labelCount:document.querySelectorAll('.pc-dnd-structure-row').length}}''')
   okay=r['scroll']<=width+1 and r['dialogLeft']>=-1 and r['dialogRight']<=width+1 and r['buttonRight']<=width+1 and r['buttonHeight']>=44 and not r['privateFound'] and r['labelCount']==6
   results.append({'width':width,'pass':okay,'scroll':r['scroll'],'buttonHeight':r['buttonHeight'],'labelCount':r['labelCount']})
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round217-structure-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
(out/'round217-browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf8')
assert len(results)==8 and all(x['pass'] for x in results),results
print('ROUND217 isolated structural preview:',len(results),'/',len(results),'private values never rendered; no native recovery test')
