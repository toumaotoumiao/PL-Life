"""Actual app browser regression. Synthetic PCs only; no user archive or live site is opened."""
from pathlib import Path
import re,json,os,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
output=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round160-pc-excel'
output.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[];failures=[];screenshots=[]
def check(cond,label,data=None):
 checks.append(label)
 if not cond:failures.append({'check':label,'data':data})
fixtures=[('coc7','brp','coc','7e',True,'ready'),('coc6','brp','coc','6e',True,'developing'),('brp','brp','brp-generic','',True,'developing'),('insane','saikoro-fiction','insane','',True,'developing'),('shinobigami','saikoro-fiction','shinobigami','',True,'developing'),('dnd-2014','d20-osr','dnd','5e-2014',True,'ready'),('dnd-2024','d20-osr','dnd','5e-2024',True,'ready'),('legacy','brp','coc','7e',False,'unconfirmed'),('coc-no-edition','brp','coc','',True,'edition-required')]
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox']}
 if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
 elif Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**opts)
 for width in (375,1280):
  page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.set_content(html,wait_until='domcontentloaded',timeout=90000)
   # Complete optional onboarding for this synthetic fixture before opening an editor;
   # hiding its backdrop alone leaves a scheduled welcome timer active.
   page.evaluate('''()=>{localStorage.setItem(ONBOARDING_KEY,'1');const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert')}''')
   page.wait_for_timeout(520) # allow the original welcome callback to settle after the flag above
   page.evaluate('''()=>{window.__pcDialogTrace=[];const e=document.getElementById('pcEditorBackdrop'),d=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');if(d?.get&&d?.set){Object.defineProperty(e,'hidden',{configurable:true,get(){return d.get.call(this)},set(value){window.__pcDialogTrace.push({hidden:Boolean(value),stack:new Error().stack.slice(0,650)});return d.set.call(this,value)}})}}''')
   page.evaluate('''()=>{window.__testNotices=[];appNotice=(...args)=>{window.__testNotices.push(args);return false;};}''')
   page.evaluate('''items=>{for(const [id,familyId,systemId,editionId,confirmed] of items){pcs.push(normalizePcArchive({id:'audit-'+id,name:'合成 '+id,ownerPlId:selfProfileId(),ruleMeta:{familyId,systemId,editionId,confirmed,source:confirmed?'user-selected':'legacy-pc-default'},coc:{str:65,hp:11},skills:[{name:'图书馆',value:60}]},null));}}''',[x[:5] for x in fixtures])
   for id,_,_,_,_,status in fixtures:
    page.evaluate('id=>openPcEditor("audit-"+id)',id)
    try:
     page.wait_for_function('''id=>{const e=document.getElementById('pcEditorBackdrop');return !e.hidden&&pcDraft&&pcDraft.id==='audit-'+id&&e.getBoundingClientRect().width>200}''',arg=id,timeout=1500)
    except Exception:
     state=page.evaluate('''()=>({hidden:document.getElementById('pcEditorBackdrop').hidden,editingPcId,pcDraftId:pcDraft?.id,trace:window.__pcDialogTrace})''')
     raise RuntimeError('PC editor failed to open: '+json.dumps(state,ensure_ascii=False)[-2500:])
    if width<=760 and not page.evaluate('document.querySelector(".pc-foot-more-v72").open'):page.locator('.pc-foot-more-trigger-v72').click(timeout=5000)
    if not page.evaluate('document.querySelector(".pc-footer-export-menu").open'):page.locator('.pc-footer-export-menu > summary').click(timeout=5000)
    state=page.evaluate('''()=>{const b=document.getElementById('pcFooterExportExcelBtn'),n=document.getElementById('pcFooterExcelExportStatus'),r=document.getElementById('pcEditorBackdrop').getBoundingClientRect(),e=b.getBoundingClientRect();return {status:b.dataset.pcExcelExportState,disabled:b.disabled,label:b.textContent,note:n.textContent,noteHidden:n.hidden,shown:e.width>0&&e.height>=40,overflow:document.documentElement.scrollWidth-innerWidth,dialog:r.width,btnHidden:b.hidden,display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility,opacity:getComputedStyle(b).opacity,rect:{x:e.x,y:e.y,w:e.width,h:e.height},moreOpen:document.querySelector(".pc-foot-more-v72").open,exportOpen:document.querySelector(".pc-footer-export-menu").open};}''')
    check(state['status']==status,f'{width} {id} state',state)
    check(state['disabled']==(status!='ready'),f'{width} {id} access',state)
    check(state['shown'] and state['overflow']<=3,f'{width} {id} visible and no horizontal overflow',state)
    check(('开发中' in state['label'])==(status=='developing'),f'{width} {id} correct label',state)
    if status=='unconfirmed':
     check(page.locator('[data-pc-confirm-rule]').count()==1,f'{width} legacy has one-click confirmation')
     if width<=760:page.evaluate('document.querySelector(".pc-foot-more-v72").open=false')
     page.locator('#pcRuleMenu > summary').click(timeout=5000)
     page.locator('[data-pc-confirm-rule]').click(timeout=5000)
     check(page.evaluate('pcDraft.ruleMeta.confirmed && document.getElementById("pcFooterExportExcelBtn").dataset.pcExcelExportState==="ready"'),f'{width} legacy can confirm without clearing data')
     check(page.evaluate('pcDraft.coc.str===65&&pcDraft.skills[0].value===60'),f'{width} legacy values preserved')
    if status=='developing' and id=='insane':
     before=page.evaluate('JSON.stringify(pcDraft)')
     ret=page.evaluate('''async()=>await pcExportExcelCard(pcDraft)''')
     after=page.evaluate('JSON.stringify(pcDraft)')
     check(ret is False and before==after,f'{width} blocked API has no PC mutation')
    if status=='ready' and id=='coc7' and width==375:
     page.evaluate('''()=>{window.__testDownload=null;downloadBlobFile=function(blob,name){window.__testDownload={size:blob.size,name};};}''')
     ok=page.evaluate('''async()=>await pcExportExcelCard(pcDraft)''')
     download=page.evaluate('window.__testDownload')
     check(ok is True and download and download['size']>1000 and download['name'].endswith('_CoC七版角色卡.xlsx'),f'{width} verified CoC7 produces actual XLSX',download)
    if id in ('coc7','coc6','insane','legacy','dnd-2014','dnd-2024'):
     name=f'pc-excel-{id}-{width}.png';page.screenshot(path=str(output/name),full_page=False);screenshots.append(name)
    page.evaluate('async()=>await closePcEditor({force:true})')
   check(not errors,f'{width} no uncaught browser exception',errors[:5])
  except Exception:
   failures.append({'check':f'{width} runtime exception','data':traceback.format_exc()[-2300:],'dialogTrace':page.evaluate('window.__pcDialogTrace||[]')[-8:]})
   try:page.screenshot(path=str(output/f'FAIL-{width}.png'))
   except Exception:pass
  finally:page.close()
 browser.close()
result={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'failures':failures,'screenshots':screenshots,'fixtures':[x[0] for x in fixtures]}
(output/'round160-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROUND160:',len(checks),'checks,',len(failures),'failures,',len(screenshots),'screenshots')
for f in failures[:10]:print('FAIL',json.dumps(f,ensure_ascii=False)[:800])
if failures:raise SystemExit(1)
