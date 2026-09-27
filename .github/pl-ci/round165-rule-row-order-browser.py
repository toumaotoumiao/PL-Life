"""Full-app synthetic PC rule row UI. In-memory storage; does not assert native IndexedDB or deployed-site acceptance."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json, os, traceback
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round165-rule-rows'
out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def inline(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',inline,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
results=[];fail=[];shots=[]
def check(name,ok,data=None):
 results.append({'name':name,'ok':bool(ok)})
 if not ok:fail.append({'name':name,'data':data})
with sync_playwright() as p:
 args={'headless':True,'args':['--no-sandbox']}
 if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):args['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
 elif Path('/usr/bin/chromium').exists():args['executable_path']='/usr/bin/chromium'
 browser=p.chromium.launch(**args)
 try:
  for width in [320,375,390,430,768,1024,1280,1440]:
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   try:
    page.set_content(html,wait_until='domcontentloaded',timeout=90000)
    page.evaluate('''()=>{localStorage.setItem(ONBOARDING_KEY,'1');const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert');}''')
    page.wait_for_timeout(540)
    page.evaluate('''()=>{pcs.push(normalizePcArchive({id:'row-test-insane',name:'合成 Insane 角色',ownerPlId:selfProfileId(),ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true,source:'user-selected'},ruleData:{traits:[{label:'旧规则',value:'仅在编辑器'}],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'},{label:'正气度',value:'5'}],skills:[{label:'特技甲',value:'完成',marker:{future:'keep'}},{label:'特技乙',value:'在场'},{label:'特技丙',value:''}],resources:[],futureKey:{keep:true}},shinobigami:{traits:[{label:'流派',value:'保留'}],skills:[],resources:[]}},coc:{san:54},excelEdits:[{sheet:'角色卡',ref:'B6',value:'保留'}]}));openPcEditor('row-test-insane');pcEditorTab='coc';renderPcEditor({resetScroll:true});}''')
    page.wait_for_function("() => !document.getElementById('pcEditorBackdrop').hidden && document.querySelectorAll('[data-pc-generic-row=skills]').length===3",timeout=5000)
    state=page.evaluate('''()=>({rows:[...document.querySelectorAll('[data-pc-generic-row=skills]')].map(x=>x.querySelector('[data-pc-generic-field=label]').value),filled:[...document.querySelectorAll('.pc-generic-rule-heading .muted')].map(x=>x.textContent),actionWidth:document.querySelector('.pc-rule-row-actions button').getBoundingClientRect().width,actionHeight:document.querySelector('.pc-rule-row-actions button').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,bodyWidth:document.getElementById('pcEditorBody').scrollWidth})''')
    check(f'{width} full editor renders filled count and rows',state['rows']==['特技甲','特技乙','特技丙'] and '已填 2 / 3' in state['filled'],state)
    check(f'{width} toolbar 44px and page no overflow',state['actionHeight']>=43.5 and state['actionWidth']>=43.5 and state['overflow']<=3,state)
    page.locator('[data-pc-generic-row="skills"][data-pc-generic-index="0"] [data-pc-generic-move="1"]').click()
    after=page.evaluate('''()=>({order:pcDraft.ruleSheets.insane.skills.map(r=>r.label),extra:pcDraft.ruleSheets.insane.skills[1].marker,foreign:pcDraft.ruleSheets.shinobigami.traits[0].value,coc:pcDraft.coc.san,excel:pcDraft.excelEdits[0].value,focus:document.activeElement?.dataset.pcGenericMove,overflow:document.documentElement.scrollWidth-innerWidth})''')
    check(f'{width} actual click reorders full row with focus',after['order']==['特技乙','特技甲','特技丙'] and after['extra']=={'future':'keep'} and after['focus']=='1',after)
    check(f'{width} inactive rules and CoC data preserved',after['foreign']=='保留' and after['coc']==54 and after['excel']=='保留' and after['overflow']<=3,after)
    page.locator('[data-pc-generic-row="skills"][data-pc-generic-index="1"] [data-pc-generic-move="-1"]').click()
    check(f'{width} reverse restores exact active fields',page.evaluate("pcDraft.ruleSheets.insane.skills.map(r=>r.label).join(',')")=='特技甲,特技乙,特技丙')
    state=page.evaluate('''()=>{const normalized=normalizePcArchive(JSON.parse(JSON.stringify(pcDraft)));return{order:normalized.ruleSheets.insane.skills.map(x=>x.label),unknown:normalized.ruleSheets.insane.futureKey.keep,rowMeta:normalized.ruleSheets.insane.skills[0].marker.future}}''')
    check(f'{width} archive normalization retains extra data',state=={'order':['特技甲','特技乙','特技丙'],'unknown':True,'rowMeta':'keep'},state)
    if width in (320,375,1280):
     page.screenshot(path=str(out/f'rule-rows-{width}.png'));shots.append(f'rule-rows-{width}.png')
    if width in (320,375,1280):
     for theme in ('mist','tomato','night'):
      geometry=page.evaluate('''theme=>{document.documentElement.dataset.theme=theme;const b=document.querySelector('.pc-rule-row-actions button'),v=b.getBoundingClientRect();return{theme:document.documentElement.dataset.theme,w:v.width,h:v.height,overflow:document.documentElement.scrollWidth-innerWidth,visible:v.width>0&&v.height>0}}''',theme)
      check(f'{width} theme {theme} button and document geometry',geometry['visible'] and geometry['w']>=43.5 and geometry['h']>=43.5 and geometry['overflow']<=3,geometry)
      if width==375:
       page.screenshot(path=str(out/f'rule-rows-{theme}-375.png'));shots.append(f'rule-rows-{theme}-375.png')
    check(f'{width} browser errors',not errors,errors[:3])
   except Exception:
    fail.append({'name':f'{width} browser exception','data':traceback.format_exc()[-2000:]})
    try:page.screenshot(path=str(out/f'FAIL-{width}.png'))
    except Exception:pass
   finally:page.close()
 finally:browser.close()
report={'version':'8.1.12.230','checks':len(results),'passed':sum(x['ok'] for x in results),'failures':fail,'screenshots':shots,'scope':'isolated full-app in-memory synthetic UI'}
(out/'round165-rule-rows.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Round165: ',report['passed'],'/',report['checks'],'checks, failures',len(fail),'screenshots',len(shots))
if fail:print(json.dumps(fail[:4],ensure_ascii=False)[:3000]);raise SystemExit(1)
