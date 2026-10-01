#!/usr/bin/env python3
"""Stage68 synthetic isolated D&D manual draft: never load original spreadsheets."""
from pathlib import Path
import json,os
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
html=(root/'index.html').read_text('utf8')
style='\n'.join(t.get_text() for t in BeautifulSoup(html,'html.parser').find_all('style'))
a=html.index('const PC_DND_STRUCTURE_LAYOUTS=Object.freeze({')
b=html.index('async function pcDndStructurePreviewFile(',a)
c=html.index('/* Stage68: manual transcription of numeric candidates')
d=html.index('async function pcDndManualApplyFromPreview()',c)
pure=html[a:b]+html[c:d]
markup='''<!doctype html><html data-theme="mist" lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'''+style+'''</style></head><body><div class="pc-manage-backdrop" id="pcDndPreviewBackdrop"><section class="pc-manage-dialog" role="dialog"><header class="pc-manage-head"><div><strong>D&D 属性来源核对</strong></div><button class="icon-close" type="button">×</button></header><div class="pc-manage-body" id="pcDndPreviewBody"></div><footer class="pc-manage-foot"><span>候选值仅本地展示</span><button class="btn primary" type="button">关闭</button></footer></section></div></body></html>'''
source="""const pcInsaneSheetCell=(sheet,ref)=>{let m=/^([A-Z]+)(\\d+)$/.exec(ref),col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;return sheet.rows[+m[2]-1]?.[col-1]??'';};
const clone=structuredClone;
const pcRuleTemplateKey=p=>p.ruleMeta?.systemId==='dnd'?'dnd:'+p.ruleMeta.editionId:'';
const pcRuleCurrentData=p=>p.ruleSheets?.[pcRuleTemplateKey(p)]||{traits:PC_DND_SIX_LABELS.map(label=>({label,value:''})),skills:[],resources:[]};
const pcRuleEditableData=p=>{p.ruleSheets??={};const k=pcRuleTemplateKey(p);if(!p.ruleSheets[k])p.ruleSheets[k]=clone(pcRuleCurrentData(p));return p.ruleSheets[k];};
"""+pure+"""
const rows=Array.from({length:25},()=>[]);['力量','敏捷','体质','智力','感知','魅力'].forEach((x,i)=>{rows[7+i*2][2]=x;rows[7+i*2][4]=11+i});rows[2][1]='SYNTHETIC_PRIVATE_NEVER_SHOW';
Object.defineProperty(rows,'formulaRefs',{value:new Set(['G8','G10','G12','G14','G16','G18'])});
const sheets=Array.from({length:8},(_,i)=>({name:'SYNTHETIC_PRIVATE_SHEET',rows:i===1?rows:[]}));
const model=pcDndStructurePreviewFromSheets(sheets),body=document.getElementById('pcDndPreviewBody');
let syntheticPc={id:'SYNTHETIC',ruleMeta:{systemId:'dnd',editionId:'5e-2014',confirmed:true},ruleSheets:{}};
body.innerHTML=pcDndStructurePreviewHTML(model,false);
body.addEventListener('click',e=>{if(e.target.closest('[data-pc-dnd-reveal]'))body.innerHTML=pcDndStructurePreviewHTML(model,e.target.closest('[data-pc-dnd-reveal]').getAttribute('aria-pressed')!=='true');});
"""
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') # Default to pinned Playwright Chromium, never the system-managed browser
 browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':850})
   page.set_content(markup);page.add_script_tag(content=source)
   masked=page.evaluate("() => {const t=document.querySelector('#pcDndPreviewBody').innerText;return t.includes('•••')&&!t.includes('SYNTHETIC_PRIVATE')&&!document.querySelector('[data-pc-dnd-manual-apply]')}")
   if width in [320,390,1280]:page.screenshot(path=str(out/f'round219-masked-{width}.png'),full_page=True)
   page.locator('[data-pc-dnd-reveal]').click()
   stats=page.evaluate("""() => {const b=document.querySelector('[data-pc-dnd-manual-apply]').getBoundingClientRect(),dlg=document.querySelector('#pcDndPreviewBackdrop .pc-manage-dialog').getBoundingClientRect();return {pick:document.querySelectorAll('[data-pc-dnd-pick]').length,touch:b.height,scroll:document.documentElement.scrollWidth,left:dlg.left,right:dlg.right,attest:!!document.querySelector('[data-pc-dnd-attest]')}}""")
   page.locator('[data-pc-dnd-pick="0"]').check();page.locator('[data-pc-dnd-pick="2"]').check()
   page.locator('[data-pc-dnd-attest]').check()
   selected=page.evaluate("""() => {const root=document.getElementById('pcDndPreviewBody');if(!root.querySelector('[data-pc-dnd-attest]').checked)return false;const selected=[...root.querySelectorAll('[data-pc-dnd-pick]:checked')].map(x=>+x.dataset.pcDndPick);const plan=pcDndManualDraftPlan(syntheticPc,model,selected);return {count:plan.review.changes.length,fields:plan.next.ruleSheets['dnd:5e-2014'].traits.map(x=>x.value),unchanged:!syntheticPc.ruleSheets['dnd:5e-2014'],undo:!pcDndManualUndoPlan(plan.next,plan.review).ruleSheets['dnd:5e-2014']}}""")
   passed=masked and stats['pick']==6 and stats['touch']>=44 and stats['scroll']<=width+1 and stats['left']>=-1 and stats['right']<=width+1 and stats['attest'] and selected['count']==2 and selected['fields']==['11','','13','','',''] and selected['unchanged'] and selected['undo']
   results.append({'width':width,'pass':bool(passed),'masked':bool(masked),'touch_ok':stats['touch']>=44,'bounded':stats['scroll']<=width+1 and stats['left']>=-1 and stats['right']<=width+1,'manual_selection_and_undo':bool(selected and selected['count']==2 and selected['undo'])})
   page.close()
 finally:browser.close()
(out/'round219-browser-result.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf8')
assert len(results)==8 and all(x['pass'] for x in results),results
print('Round219 masked/manual opt-in, safe draft and undo, eight widths: 8/8; synthetic only')
