#!/usr/bin/env python3
"""Stage67 public CI: entirely synthetic D&D six-number masked preview; no uploaded workbook."""
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
markup='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body><div class="pc-manage-backdrop" id="pcDndPreviewBackdrop"><section class="pc-manage-dialog" role="dialog"><header class="pc-manage-head"><div><strong>D&D 5e 本地属性预览</strong></div><button class="icon-close" type="button">×</button></header><div class="pc-manage-body" id="pcDndPreviewBody"></div><footer class="pc-manage-foot"><span>不导入档案</span><button class="btn primary" type="button">关闭预览</button></footer></section></div></body></html>'
source="""const pcInsaneSheetCell=(sheet,ref)=>{const m=/^([A-Z]+)([1-9]\\d*)$/.exec(ref);let n=0;for(const c of m[1])n=n*26+c.charCodeAt(0)-64;return sheet.rows[Number(m[2])-1]?.[n-1]??'';};
"""+pure+"""
const rows=Array.from({length:24},()=>[]);
['力量','敏捷','体质','智力','感知','魅力'].forEach((x,i)=>{rows[7+i*2][2]=x;rows[7+i*2][4]=12+i});
rows[2][1]='SYNTHETIC_SECRET_NEVER_RENDER';Object.defineProperty(rows,'formulaRefs',{value:new Set(['G8','G10','G12','G14','G16','G18'])});
const sheets=Array.from({length:8},(_,i)=>({name:'SYNTHETIC_SECRET_SHEET',rows:i===1?rows:[]}));
const model=pcDndStructurePreviewFromSheets(sheets);const body=document.getElementById('pcDndPreviewBody');
body.innerHTML=pcDndStructurePreviewHTML(model,false);
body.addEventListener('click',e=>{const b=e.target.closest('[data-pc-dnd-reveal]');if(!b)return;body.innerHTML=pcDndStructurePreviewHTML(model,b.getAttribute('aria-pressed')!=='true');});
"""
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':800});page.set_content(markup);page.add_script_tag(content=source)
   before=page.evaluate('''() => {const p=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),c=document.querySelector('#pcDndPreviewBody'),b=c.querySelector('[data-pc-dnd-reveal]').getBoundingClientRect(),foot=document.querySelector('.pc-manage-foot button').getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,left:p.left,right:p.right,touch:b.height,footer:foot.height,labels:c.querySelectorAll('.pc-dnd-structure-row').length,text:c.textContent,html:c.innerHTML}}''')
   masked=before['labels']==6 and 'SYNTHETIC_SECRET_' not in before['text'] and '>12<' not in before['html'] and '•••' in before['text']
   geometry=before['scroll']<=width+1 and before['left']>=-1 and before['right']<=width+1 and before['touch']>=44 and before['footer']>=44
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round218-masked-{width}.png'),full_page=True)
   page.locator('[data-pc-dnd-reveal]').click()
   revealed=page.locator('#pcDndPreviewBody').inner_text()
   explicit=('12' in revealed and '17' in revealed and 'SYNTHETIC_SECRET_' not in revealed)
   page.locator('[data-pc-dnd-reveal]').click()
   hidden=('•••' in page.locator('#pcDndPreviewBody').inner_text() and 'SYNTHETIC_SECRET_' not in page.locator('#pcDndPreviewBody').inner_text())
   passed=masked and geometry and explicit and hidden
   results.append({'width':width,'pass':passed,'masked':masked,'bounded':geometry,'scroll':before['scroll'],'left':before['left'],'right':before['right'],'touch':before['touch'],'footer':before['footer'],'opt_in_toggle':explicit and hidden})
   page.close()
 finally:browser.close()
(out/'round218-browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf8')
assert len(results)==8 and all(x['pass'] for x in results),results
print('ROUND218 synthetic candidate privacy, reveal/hide, 8-width: 8/8; no real workbook')
