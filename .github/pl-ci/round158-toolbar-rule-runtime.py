"""Real app script and renderer visual check, isolated synthetic data only. No real site or user archive. In-memory storage mock; native IndexedDB is Round151."""
from pathlib import Path
import re,json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
import os,traceback
SAVE=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round157-runtime'
SAVE.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text()
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>', '',html,flags=re.I)
def repl(m): return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
SEED='''()=>{
  const types=[{familyId:'brp',systemId:'coc',editionId:'7e'},{familyId:'brp',systemId:'brp-generic',editionId:''},{familyId:'saikoro-fiction',systemId:'insane',editionId:''},{familyId:'saikoro-fiction',systemId:'shinobigami',editionId:''}];
  const mn='同名但不同规则的模组·中英文 Call of Cthulhu / Insane';
  for(let i=0;i<24;i++){
    const id='audit-m'+i, ruleMeta={...types[i%4],confirmed:true,source:'structured'};
    modules.push(normalizeRichModule({id,name:i<4?mn:'测试模组 '+i,author:'作者 '+i,players:'4-5人',duration:'4-6小时',era:'现代',location:'城市',background:'调查、角色关系与情节简介。'.repeat(i%3+1),ruleMeta},settings.moduleArchive));
  }
  for(let i=0;i<24;i++)profiles.push(normalizeProfile({id:'audit-pl'+i,name:'合成玩家 '+i,contact:'1234',profileRemark:'愿意探索多种 TRPG，长备注'.repeat(i%3+1)}));
  for(let i=0;i<24;i++){
    const meta={...types[i%4],confirmed:true,source:'structured'};
    pcs.push(normalizePcArchive({id:'audit-pc'+i,name:'角色 '+i+' · '+(i%2===0?'阿比盖尔·华德':'Edward Alexander'),ownerPlId:'audit-pl'+i,ruleMeta:meta,occupation:'研究员',era:'现代',notes:'此角色只用于视觉检查',coc:{str:65,hp:12,san:50},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[],resources:[]},shinobigami:{traits:[{label:'阶级',value:'中忍'}],skills:[],resources:[]}},skills:[{name:'图书馆',value:70}]},null));
  }
  for(let i=0;i<57;i++){
    const m=modules[i%24],date='2026-'+String(i%12+1).padStart(2,'0')+'-'+String(i%27+1).padStart(2,'0');
    runRecords.push(normalizeRunRecord({id:'audit-r'+i,moduleId:m.id,moduleName:m.name,ruleMeta:{...m.ruleMeta},tableName:'第 '+(i+1)+' 桌 / 长标题（同名不同规则）',kpProfileId:selfProfileId(),plIds:['audit-pl'+i%24],startDate:date,endDate:date,sessionSlots:[{id:'audit-slot'+i,date,startTime:'19:00',endTime:'23:00'}],runNotes:'这是一条用于验证列表高度、文字换行以及统计联动的合成资料。'}));
  }
  for(let i=0;i<16;i++){const m=modules[(i+4)%24];runPlans.push(normalizeRunPlan({id:'audit-plan'+i,moduleId:m.id,moduleName:m.name,ruleMeta:{...m.ruleMeta},tableName:'后续计划 '+i,plIds:['audit-pl'+i],timeSlots:[{id:'audit-plan-slot'+i,date:'2026-10-'+String(i%27+1).padStart(2,'0'),startTime:'13:00',endTime:'17:00'}]}));}
  return {profiles:profiles.length,pcs:pcs.length,modules:modules.length,records:runRecords.length,plans:runPlans.length};
}'''


from pathlib import Path
import json, traceback
from playwright.sync_api import sync_playwright
W=(320,375,390,430,768,1024,1280,1440)
THEMES=('mist','tomato','night')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci/visual-evidence')))/'round158-controls'
OUT.mkdir(parents=True,exist_ok=True)
checks=0;failures=[];shots=[]

def rect(page,selector):
  return page.evaluate('''s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,display:c.display,overflow:c.overflow};}''',selector)

def check(ok,message,width,theme,detail=None):
  global checks
  checks+=1
  if not ok:failures.append({'width':width,'theme':theme,'issue':message,'detail':detail})

with sync_playwright() as p:
  opts={'headless':True,'args':['--no-sandbox']}
  if os.environ.get('PL_CI_CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['PL_CI_CHROMIUM_EXECUTABLE']
  elif Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium'
  browser=p.chromium.launch(**opts)
  for width in W:
    for theme in (THEMES if width in (375,1280) else ('mist',)):
      page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
      errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
      try:
        page.set_content(html,wait_until='domcontentloaded',timeout=90000)
        page.evaluate('''()=>{const a=document.getElementById('onboardingBackdrop');a.hidden=true;a.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert')}''')
        page.evaluate(SEED)
        page.evaluate('theme=>{document.documentElement.dataset.theme=theme;}',theme)
        page.evaluate('switchView("records",{historyMode:"none",restoreScroll:false})')
        toolbar=rect(page,'#recordsView > .records-toolbar')
        title=rect(page,'#recordsView .view-toolbar-title')
        recap=rect(page,'#recordsRecapBtn')
        create=rect(page,'#createModuleRecordBtn')
        combobox=rect(page,'#newModuleNameCombobox')
        filterbox=rect(page,'#recordsView .records-filter-workbench')
        check(all(r and r['w']>0 and r['h']>0 for r in (toolbar,title,recap,create,combobox,filterbox)),'toolbar missing element',width,theme)
        check(recap['left']>=toolbar['left']-2 and recap['right']<=toolbar['right']+2 and create['right']<=toolbar['right']+2 and combobox['left']>=toolbar['left']-2,'toolbar controls outside available width',width,theme,{'toolbar':toolbar,'recap':recap,'create':create})
        check(recap['h']>=43.5 and create['h']>=43.5,'touch target smaller than 44px',width,theme,{'recap':recap,'create':create})
        if width>760:
          check(abs(recap['y']-create['y'])<13 and abs(title['y']-create['y'])<30,'desktop recap or create is forced into lonely extra row',width,theme,{'title':title,'recap':recap,'create':create})
          check(toolbar['h']<180,'desktop toolbar has excess whitespace',width,theme,toolbar)
        else:
          check(abs(recap['y']-title['y'])<22 and create['y']>recap['y'],'mobile title, recap and create order incorrect',width,theme,{'title':title,'recap':recap,'create':create})
          check(toolbar['h']<215,'mobile toolbar has unnecessary extra row',width,theme,toolbar)
        check(filterbox['top']>create['top']+34 and filterbox['top']<create['bottom']+18,'search not immediately below create actions',width,theme,{'filter':filterbox,'create':create})
        check(page.evaluate('document.documentElement.scrollWidth-innerWidth')<=3,'record viewport horizontally overflowing',width,theme)
        if theme=='mist' and width in (375,1280):
          fn=f'records-{width}.png';page.screenshot(path=str(OUT/fn),full_page=False);shots.append(fn)
        page.evaluate('openPcEditor("audit-pc0")')
        pc=rect(page,'#pcRuleMenu > summary')
        close=rect(page,'#closePcEditorBtn')
        check(pc and pc['display']!='none' and pc['h']>=43.5 and pc['w']>=130,'PC rule trigger not visible and comfortably clickable',width,theme,pc)
        check(pc['right']<=width+2 and pc['left']>=-2 and (not close or pc['right']<=close['left']+2 or abs(pc['y']-close['y'])>20),'PC rule trigger overlaps close or exits viewport',width,theme,{'pc':pc,'close':close})
        if theme=='mist' and width in (375,1280):
          fn=f'pc-rule-{width}.png';page.screenshot(path=str(OUT/fn),full_page=False);shots.append(fn)
        closed=page.evaluate('async()=>await closePcEditor({force:true})')
        check(closed and page.evaluate('document.getElementById("pcEditorBackdrop").hidden'),'PC editor close completed before plan opens',width,theme)
        page.evaluate('openPlanEditor("audit-plan0")')
        # Wait for the actual visible editor state, not only a fixed animation delay.
        try:
          page.wait_for_function('''()=>{const e=document.getElementById('planEditorBackdrop'),d=document.getElementById('planEditorDrawer');return editingPlanId==='audit-plan0'&&e&&!e.hidden&&d&&d.getBoundingClientRect().width>200}''',timeout=5000)
        except Exception:
          state=page.evaluate('''()=>({editingPlanId,backdropHidden:document.getElementById('planEditorBackdrop')?.hidden,drawer:document.getElementById('planEditorDrawer')?.getBoundingClientRect().toJSON(),pcHidden:document.getElementById('pcEditorBackdrop')?.hidden})''')
          check(False,'plan drawer failed to open after completed PC close',width,theme,state)
          raise
        page.wait_for_timeout(270) # drawer translation must settle before popover geometry
        page.evaluate('document.querySelector("[data-run-rule-menu=plan]").open=true')
        drawer=rect(page,'#planEditorDrawer')
        panel=rect(page,'[data-run-rule-menu="plan"] .native-module-rule-popover')
        check(panel and panel['w']>200 and panel['h']>150 and panel['left']>=drawer['left']-3 and panel['right']<=drawer['right']+3,'plan rule panel escaped its drawer',width,theme,{'drawer':drawer,'panel':panel})
        check(panel['left']>=-2 and panel['right']<=width+3,'plan rule panel escaped viewport',width,theme,panel)
        check(page.evaluate('''()=>{let a=document.querySelector('[data-run-rule-menu=plan] .native-module-rule-popover');return a.scrollWidth<=a.clientWidth+2;}'''),'plan panel has internal horizontal overflow',width,theme)
        if theme=='mist' and width in (375,1280):
          fn=f'plan-rule-{width}.png';page.screenshot(path=str(OUT/fn),full_page=False);shots.append(fn)
        check(not errors,'uncaught browser error',width,theme,errors[:3])
      except Exception:
        failures.append({'width':width,'theme':theme,'issue':'setup / runtime exception','detail':traceback.format_exc()[-1400:]})
        try:page.screenshot(path=str(OUT/f'FAIL-{width}-{theme}.png'))
        except Exception:pass
      finally:
        page.close()
        print(f'Round158 {width}px / {theme}: completed; {checks} assertions, {len(failures)} failures',flush=True)
  browser.close()
result={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'kind':'live app scripts, isolated in-memory synthetic data, no real user data','widths':W,'themes':THEMES,'assertions':checks,'screenshots':shots,'failures':failures}
(OUT/'round158-control-visual.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROUND158:',checks,'assertions,',len(shots),'screenshots,',len(failures),'failures')
for f in failures[:10]:print('FAIL',json.dumps(f,ensure_ascii=False)[:550])
if failures:raise SystemExit(1)
