#!/usr/bin/env python3
"""Fictional D&D manual-only editor fields, in an isolated rendered UI. No private workbook."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text('utf8')
a=html.index('function normalizePcRuleData(');b=html.index('function normalizePcArchive(',a)
c=html.index('function pcGenericRuleEditorHTML(');d=html.index('function pcProfileEditorHTML(',c)
style='\n'.join(re.findall(r'<style(?:\s[^>]*)?>(.*?)</style>',html,flags=re.I|re.S))
script="""
const clone=structuredClone, moduleRuleDisplay=m=>m.editionId==='5e-2014'?'D&D 5e（2014）':'D&D 5e（2024）';
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pcDndDraftImportReview=null;
"""+html[a:b]+html[c:d]+"""
function fixture(edition){const pc={id:'fictional-'+edition,ruleMeta:{familyId:'d20-osr',systemId:'dnd',editionId:edition,confirmed:true},ruleSheets:{__genericScopedV1:true},ruleData:{traits:[],skills:[],resources:[]}};document.getElementById('content').innerHTML=pcGenericRuleEditorHTML(pc);}
"""
markup='<!doctype html><html data-theme="normal" lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body><div id="content" style="max-width:100%;overflow-wrap:anywhere"></div></body></html>'
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 exe=os.environ.get('PL_TEST_CHROMIUM_PATH')
 browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
 try:
  for edition in ['5e-2014','5e-2024']:
   for width in [320,375,390,430,768,1024,1280,1440]:
    page=browser.new_page(viewport={'width':width,'height':840})
    page.set_content(markup);page.add_script_tag(content=script)
    page.evaluate('(e) => fixture(e)',edition)
    v=page.evaluate('''() => {const rows=[...document.querySelectorAll('[data-pc-generic-row="resources"]')];const wrap=document.querySelector('#content').getBoundingClientRect();return {count:rows.length,labels:rows.map(x=>x.querySelector('[data-pc-generic-field="label"]').value),empty:rows.every(x=>x.querySelector('[data-pc-generic-field="value"]').value===''),left:wrap.left,right:wrap.right,scroll:document.documentElement.scrollWidth,manual:!!document.querySelector('[data-pc-dnd-preview-open]')}}''')
    wanted=['背景','种族／物种','阵营','等级','熟练加值','先攻','生命值']
    ok=v['count']==7 and v['labels']==wanted and v['empty'] and v['left']>=-1 and v['right']<=width+1 and v['scroll']<=width+1 and v['manual']
    results.append({'edition':edition,'width':width,'pass':ok,'seven_empty_manual_fields':v['count']==7 and v['labels']==wanted and v['empty'],'no_horizontal_overflow':v['scroll']<=width+1})
    if edition=='5e-2024' and width in (320,390,1280):page.screenshot(path=str(out/f'round238-manual-{width}.png'),full_page=True)
    page.close()
 finally:browser.close()
(out/'round238-browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n','utf8')
assert len(results)==16 and all(x['pass'] for x in results),results
print('Round238 D&D two editions x eight viewports: 16/16, synthetic manual UI only')
