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

VIEW_MAP={'profiles':'profilesView','pcs':'pcsView','modules':'modulesView','plans':'plansView','records':'recordsView','selfIntro':'selfIntroView','stats':'statsView'}
WIDTHS=[320,375,390,430,768,1024,1280,1440]
BREAKER=[760,761,900,901,1100,1101]
failures=[]; checks=0;screenshots=[];profiles={}

def inspect(page,width,view):
    return page.evaluate('''({width,view})=>{
        const q=s=>document.querySelector(s),root=q('#'+view+'View'),r=root.getBoundingClientRect();
        const title=root.querySelector('.view-toolbar-title strong,.view-toolbar-title h2,.stats-toolbar .view-toolbar-title strong');
        const titleRect=title?.getBoundingClientRect();
        const toolbar=root.querySelector('.stats-toolbar,.view-toolbar,.toolbar');
        const tb=toolbar?.getBoundingClientRect();
        const out={view,width,rootWidth:r.width,rootX:r.x,docOverflow:document.documentElement.scrollWidth-innerWidth,
            title:title?.textContent.trim(),titleWidth:titleRect?.width,titleHeight:titleRect?.height,
            toolbarRight:tb?.right,toolbarWidth:tb?.width};
        if(view==='stats'){
            const bench=q('#statsView .stats-range-workbench'),br=bench.getBoundingClientRect(),
              h=q('#statsView .stats-toolbar>.view-toolbar-title strong').getBoundingClientRect(),
              events=[...document.querySelectorAll('#statsContent .stats-day-event em')];
            out.stats={workbenchWidth:br.width,toolbarWidth:tb.width,headingWidth:h.width,headingHeight:h.height,
             yearColumns:getComputedStyle(q('.stats-year-calendar')).gridTemplateColumns,
             labels:events.length,
             longestEvent:events.reduce((best,e)=>{const rect=e.getBoundingClientRect(),line=parseFloat(getComputedStyle(e).lineHeight);return rect.height>best.height?{height:rect.height,line,text:e.textContent,width:rect.width}:best;},{height:0,line:0,text:'',width:0}),
             titleData:q('.stats-day.calendar-v2.has-run')?.getAttribute('title')||'',
             firstLabelTitle:events[0]?.parentElement.getAttribute('title')||''};
        }
        return out;
    }''',{'width':width,'view':view})

def add_problem(width,view,details,reason):
    failures.append({'width':width,'view':view,'reason':reason,'details':details})

with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox']}
    binary=os.environ.get('PL_CI_CHROMIUM_EXECUTABLE')
    if not binary and Path('/usr/bin/chromium').exists():binary='/usr/bin/chromium'
    if binary:opts['executable_path']=binary
    browser=p.chromium.launch(**opts)
    for width in WIDTHS:
        page=browser.new_page(viewport={'width':width,'height':844 if width<=760 else 900},device_scale_factor=1,service_workers='block')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        try:
            page.set_content(html,wait_until='domcontentloaded',timeout=90000)
            # The onboarding wizard is unrelated to this visual smoke; no user storage is available.
            page.evaluate("{const e=document.getElementById('onboardingBackdrop');e.hidden=true;e.style.setProperty('display','none','important');document.getElementById('appRoot')?.removeAttribute('inert')}")
            seed=page.evaluate(SEED)
            assert seed['records']==57 and seed['modules']==24 and seed['pcs']==24,seed
            for view in VIEW_MAP:
                page.evaluate('(view)=>switchView(view,{historyMode:"none",restoreScroll:false})',view)
                data=inspect(page,width,view);checks+=1;issue=[]
                if data['rootWidth']<min(160,width*.52):issue.append('main view collapsed')
                if data['docOverflow']>3:issue.append('document horizontal overflow '+str(data['docOverflow']))
                if data['titleWidth'] is not None and data['titleWidth']<40:issue.append('title crushed')
                if data['toolbarRight'] is not None and data['toolbarRight']>width+5:issue.append('toolbar outside viewport')
                if view=='stats':
                    s=data['stats'];assert s['labels']>=57,'year calendar missing real rendered module labels'
                    if s['headingHeight']>48:issue.append('statistics heading vertically crushed')
                    if s['workbenchWidth']<s['toolbarWidth']*.90:issue.append('statistics controls left compressed')
                    if s['longestEvent']['line'] and s['longestEvent']['height']>s['longestEvent']['line']*2.15:issue.append('calendar name wrapped into tall vertical stripe')
                    if 'Call of Cthulhu' not in s['titleData'] or 'Call of Cthulhu' not in s['firstLabelTitle']:issue.append('full day/label names inaccessible')
                    # On mobile the day cells remain short and a readable dated list carries full titles.
                    mobile=page.evaluate('''()=>{const list=[...document.querySelectorAll('.stats-month-mobile-event')];return {count:list.length,visible:!!list[0]&&getComputedStyle(list[0]).display==='grid',text:list[0]?.textContent||'',width:list[0]?.querySelector('.stats-mobile-event-name')?.getBoundingClientRect().width||0};}''');checks+=1
                    if width<=760 and (mobile['count']<57 or not mobile['visible'] or mobile['width']<80 or 'Call of Cthulhu' not in mobile['text']):issue.append('mobile month list lacks readable full names '+str(mobile))
                    # Desktop reveals full text on focus; mobile exposes the full name in the month list.
                    focus=page.evaluate('''()=>{const day=document.querySelector('.stats-day.calendar-v2.has-run');document.querySelectorAll('[inert]').forEach(el=>el.removeAttribute('inert'));day.focus({preventScroll:true});const em=day.querySelector('em'),st=getComputedStyle(em);return {focus:document.activeElement===day,tab:day.tabIndex,inert:day.closest('[inert]')?.id,clamp:st.webkitLineClamp,overflow:st.overflow,title:day.getAttribute('title')};}''');checks+=1
                    if width>760 and (not focus['focus'] or focus['clamp'] not in ('none','unset') or focus['overflow']=='hidden'):issue.append('desktop focused day cannot reveal entire name '+str(focus))
                    if width<=760 and not focus['focus']:issue.append('mobile date details not focusable')
                    if width in (375,1280):
                        page.evaluate('document.activeElement?.blur()')
                        shot=SAVE/f'yearCalendar-{width}-runtime.png'
                        page.locator('#statsContent .stats-year-calendar').screenshot(path=str(shot),timeout=60000)
                        screenshots.append(shot.name)
                if issue:add_problem(width,view,data,issue)
                if width in (375,1280):
                    target=SAVE/f'{view}-{width}-runtime.png'
                    page.screenshot(path=str(target),full_page=view not in ('stats',))
                    screenshots.append(target.name)
                if view=='stats':profiles[str(width)]=data['stats']
            if width in (375,1280):
                # Actual stats-export runtime with the same 57-table synthetic archive.
                page.evaluate('switchView("stats",{historyMode:"none",restoreScroll:false});toggleStatsExportCenter(true)')
                page.wait_for_timeout(250)
                preview=page.evaluate('''()=>{const panel=document.getElementById('statsExportPanel'),stage=document.getElementById('statsExportPreviewStage');return {open:!panel.hidden,canvas:stage.querySelectorAll('canvas').length,previewText:stage.textContent.slice(0,160),docOverflow:document.documentElement.scrollWidth-innerWidth};}''');checks+=1
                if not preview['open'] or preview['canvas']<1 or preview['docOverflow']>3:add_problem(width,'statsExport',preview,'actual preview did not generate or overflowed')
                target=SAVE/f'statsExport-{width}-runtime.png';page.screenshot(path=str(target),full_page=False);screenshots.append(target.name)
                final=page.evaluate('''async()=>{
                    const source=document.querySelector('#statsExportPreviewStage canvas');
                    const sourceSize=source?{w:source.width,h:source.height}:null;
                    const ok=await exportStatsImage();
                    const backdrop=document.getElementById('uxExportPreviewBackdrop');
                    const result=document.querySelector('#uxExportPreviewStage canvas');
                    return {ok,open:!backdrop.hidden,sourceSize,
                        finalSize:result?{w:result.width,h:result.height}:null,
                        downloadDisabled:document.getElementById('uxExportPreviewDownload')?.disabled};
                }''');checks+=1
                if not final['ok'] or not final['open'] or not final['finalSize'] or final['downloadDisabled']:
                    add_problem(width,'statsFinalExport',final,'final image preview could not be generated')
                target=SAVE/f'statsFinal-{width}-runtime.png';page.screenshot(path=str(target),full_page=False);screenshots.append(target.name)
                page.evaluate("document.getElementById('uxExportPreviewCancel')?.click()")
            if width in (375,1280):
                # Real Settings interface, not a static modal skeleton.
                page.evaluate('''()=>{toggleStatsExportCenter(false);openSettings();}''')
                page.wait_for_timeout(240)
                settings_view=page.evaluate('''()=>{const box=document.getElementById('settingsModal').getBoundingClientRect();return {open:!document.getElementById('settingsModal').hidden,width:box.width,right:box.right,top:box.top,bottom:box.bottom};}''')
                checks+=1
                if not settings_view['open'] or settings_view['width']<200 or settings_view['right']>width+4 or settings_view['bottom']>900:
                    add_problem(width,'settings',settings_view,'settings editor is clipped or unavailable')
                shot=SAVE/f'settings-{width}-runtime.png';page.screenshot(path=str(shot),full_page=False);screenshots.append(shot.name)
                page.evaluate('''()=>{const e=document.getElementById('settingsModal');e.hidden=true;document.getElementById('overlay')?.classList.remove('open');document.getElementById('appRoot')?.removeAttribute('inert');}''')
                # Theme/visibility are separately exercised against actual 57-table rendering.
                for theme in ('mist','tomato','night'):
                    for privacy in (False,True):
                        page.evaluate('''({theme,privacy})=>{applyTheme(theme);setPrivacyMaskExplicit(privacy);switchView('stats',{historyMode:'none',restoreScroll:false});}''',{'theme':theme,'privacy':privacy})
                        theme_geometry=inspect(page,width,'stats');checks+=1
                        if theme_geometry['docOverflow']>3 or theme_geometry['stats']['headingHeight']>48:
                            add_problem(width,'stats theme',theme_geometry,{'theme':theme,'privacy':privacy})
                        if not privacy:
                            shot=SAVE/f'stats-{width}-{theme}-runtime.png';page.screenshot(path=str(shot),full_page=False);screenshots.append(shot.name)
            if errors:add_problem(width,'app',errors[:4],'uncaught browser errors')
        except Exception as ex:
            add_problem(width,'setup',traceback.format_exc()[-1300:],str(ex))
            try:page.screenshot(path=str(SAVE/f'FAIL-{width}.png'),full_page=False)
            except Exception:pass
        finally:
            page.close()
            print(f'Round157 {width}px completed: {checks} checks; {len(failures)} failures',flush=True)
    browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([\d.]+)";',html).group(1),
  'kind':'real app scripts and renderer, isolated in-memory synthetic data; NOT real user data or native IndexedDB',
  'widths':WIDTHS,'breakpoints':BREAKER,'cases':checks,'failures':failures,'screenshots':screenshots,'stats':profiles}
(SAVE/'round157-runtime-visual.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROUND157 real-runtime visual checks:',checks,'screenshots:',len(screenshots),'failures:',len(failures))
for f in failures[:8]:print('FAIL',json.dumps(f,ensure_ascii=False)[:450])
if failures:raise SystemExit(1)
