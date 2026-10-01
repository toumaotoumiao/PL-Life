#!/usr/bin/env python3
"""Stage70 strict-label synthetic-only visual + privacy check; no user files."""
from pathlib import Path
import json,os
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text('utf8')
style='\n'.join(s.get_text() for s in BeautifulSoup(html,'html.parser').find_all('style'))
a=html.index('const PC_DND_STRUCTURE_LAYOUTS=Object.freeze({')
b=html.index('async function pcDndStructurePreviewFile(',a)
pure=html[a:b]
markup='<!doctype html><html data-theme="mist" lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body><div class="pc-manage-backdrop" id="pcDndPreviewBackdrop"><section class="pc-manage-dialog" role="dialog"><header class="pc-manage-head"><strong>D&D 5e 来源核对</strong><button class="icon-close" type="button">×</button></header><div class="pc-manage-body" id="pcDndPreviewBody"></div><footer class="pc-manage-foot"><span>仅限当前预览</span><button class="btn primary" type="button">关闭预览</button></footer></section></div></body></html>'
source="""const pcInsaneSheetCell=(sheet,ref)=>{const m=/^([A-Z]+)([1-9]\\d*)$/.exec(ref);let n=0;for(const c of m[1])n=n*26+c.charCodeAt(0)-64;return sheet?.rows?.[Number(m[2])-1]?.[n-1]??'';};
"""+pure+"""
const put=(rows,ref,value)=>{const m=/^([A-Z]+)([1-9]\\d*)$/.exec(ref);let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;(rows[Number(m[2])-1]??=[])[col-1]=value;};
const layout=PC_DND_STRUCTURE_LAYOUTS['layout-8'];
const sheets=Array.from({length:8},()=>({name:'PRIVATE_SHEET_NEVER_SHOW',rows:[]}));
sheets.forEach((s,i)=>Object.defineProperty(s.rows,'formulaRefs',{value:new Set(i===1?layout.companionFormulas:[])}));
PC_DND_SIX_LABELS.forEach((name,i)=>{put(sheets[1].rows,layout.refs[i],name);put(sheets[1].rows,layout.candidateRefs[i],10+i);});
const labels={'背景':'背景','种族／物种':'物种','阵营':'阵营','等级':'等级','熟练加值':'熟练','先攻':'先攻','生命值':'生命值'};
PC_DND_SOURCE_ANCHORS['layout-8'].forEach(a=>put(sheets[a.sheet].rows,a.ref,labels[a.label]));
put(sheets[0].rows,'A1','PRIVATE_CHARACTER_NEVER_SHOW');
// A known label cell holding private prose must be rejected, not partially matched.
const suspect=PC_DND_SOURCE_ANCHORS['layout-8'][0];
put(sheets[suspect.sheet].rows,suspect.ref,'背景：PRIVATE_CHARACTER_NEVER_SHOW');
const model=pcDndStructurePreviewFromSheets(sheets);const body=document.getElementById('pcDndPreviewBody');
body.innerHTML=pcDndStructurePreviewHTML(model);
body.addEventListener('click',e=>{const button=e.target.closest('[data-pc-dnd-reveal]');if(!button)return;const open=Boolean(body.querySelector('.pc-dnd-outline')?.open);body.innerHTML=pcDndStructurePreviewHTML(model,button.getAttribute('aria-pressed')!=='true',open);});
"""
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':800});page.set_content(markup);page.add_script_tag(content=source)
   details=page.locator('.pc-dnd-outline');initial_closed=not details.evaluate('(x)=>x.open')
   page.locator('.pc-dnd-outline summary').click();expanded=details.evaluate('(x)=>x.open')
   before=page.evaluate('''()=>{const dialog=document.querySelector('.pc-manage-dialog').getBoundingClientRect(),s=document.querySelector('.pc-dnd-outline summary').getBoundingClientRect(),content=document.querySelector('#pcDndPreviewBody').innerText;return {scroll:document.documentElement.scrollWidth,left:dialog.left,right:dialog.right,touch:s.height,dialogBg:getComputedStyle(document.querySelector('.pc-manage-dialog')).backgroundColor,secret:content.includes('PRIVATE_'),rows:document.querySelectorAll('.pc-dnd-outline-row').length,unverified:document.querySelectorAll('.pc-dnd-outline-row em').length===7 && document.querySelector('.pc-dnd-outline-row em').textContent.includes('待核对'),inputUnmapped:document.querySelectorAll('.pc-dnd-outline-row small').length===7,masked:content.includes('•••')}}''')
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round221-strict-anchor-{width}.png'),full_page=True)
   page.locator('[data-pc-dnd-reveal]').click()
   visible=page.evaluate('''()=>({open:document.querySelector('.pc-dnd-outline').open,picks:document.querySelectorAll('[data-pc-dnd-pick]').length,secret:document.querySelector('#pcDndPreviewBody').innerText.includes('PRIVATE_')})''')
   page.locator('[data-pc-dnd-reveal]').click()
   hidden=page.evaluate('''()=>({open:document.querySelector('.pc-dnd-outline').open,mask:document.querySelector('#pcDndPreviewBody').innerText.includes('•••'),picks:document.querySelectorAll('[data-pc-dnd-pick]').length})''')
   passed=initial_closed and expanded and before['scroll']<=width+1 and before['left']>=-1 and before['right']<=width+1 and before['touch']>=44 and bool(before['dialogBg'] and before['dialogBg'] not in ('transparent','rgba(0, 0, 0, 0)')) and not before['secret'] and before['rows']==7 and before['unverified'] and before['inputUnmapped'] and before['masked'] and visible['open'] and visible['picks']==6 and not visible['secret'] and hidden['open'] and hidden['mask'] and hidden['picks']==0
   results.append({'width':width,'pass':passed,'within_viewport':before['scroll']<=width+1 and before['right']<=width+1,'tap_target':before['touch']>=44,'opaque_dialog':bool(before['dialogBg'] and before['dialogBg'] not in ('transparent','rgba(0, 0, 0, 0)')),'outline_count':before['rows'],'private_label_rejected':before['unverified'],'input_cell_unmapped':before['inputUnmapped'],'private_text_absent':not before['secret'] and not visible['secret'],'expanded_state_preserved':visible['open'] and hidden['open']})
   page.close()
 finally:browser.close()
(out/'round221-browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf8')
assert len(results)==8 and all(x['pass'] for x in results),results
print('ROUND221 strict source outline and privacy: 8/8')
