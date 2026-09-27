"""Visual acceptance guard using actual HTML/CSS and isolated synthetic DOM.

This is a STRUCTURAL VISUAL check: it does not assert that the production app's
runtime rendering, real storage restore, or image exports have been exercised.
Actual browser workflows and per-feature tests are separate release gates.
"""
from __future__ import annotations
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / 'index.html').read_text(encoding='utf-8')
FIXTURE = re.sub(r'<script\b[^>]*>[\s\S]*?</script\s*>', '', SOURCE, flags=re.I)
VIEW_IDS = ['profilesView','pcsView','modulesView','plansView','recordsView','selfIntroView','statsView','settingsModal']
WIDTHS = [320,375,390,430,768,1024,1280,1440]
BREAKPOINTS = [720,760,761,900,901,1100,1101]
THEMES = ['mist','tomato','night']
MODAL_IDS = ['profileModalWrap','pcEditorBackdrop','nativeModuleEditorBackdrop','planEditorBackdrop','statsExportPanel']
SAVE = Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR', str(ROOT / '.github/pl-ci/visual-evidence'))) / 'round156-visual'
SAVE.mkdir(parents=True,exist_ok=True)

SETUP = r'''(mode)=>{
 const id=x=>document.getElementById(x), esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
 const samples={empty:0,normal:14,large:57};const n=samples[mode];
 const long='跨规则同名模组与PC角色资料巡检·Call of Cthulhu / Insane / BRP · 2026 年';
 for(const [target,className,prefix] of [['profileGrid','card profile-card','PL'],['pcGrid','card pc-card','PC'],['moduleNativeGrid','native-module-card','模组']]){
   const e=id(target);if(!e)continue;
   e.innerHTML=Array.from({length:n},(_,i)=>`<article class="${className}" style="min-width:0"><header><strong class="privacy-sensitive">${esc(i%3===0?long:prefix+' '+(i+1))}</strong></header><p>${esc(i%2?'CoC · 第七版':'BRP 通用')} · ${esc('调查、古风、武侠等题材不作为规则名称')}</p><p>${esc('历史资料、备注、参与者与完整时间记录。')}</p></article>`).join('');
 }
 const stats=id('statsContent');if(stats){
 const parts=[];
 for(let i=0;i<Math.max(1,mode==='large'?8:mode==='normal'?5:2);i++){
  const rows=Array.from({length:i===0?Math.min(n,24):Math.min(n,10)},(_,j)=>`<div class="stats-ranking-row"><b>${j+1}</b><span class="stats-rank-name privacy-sensitive">${esc(j%2===0?long:'模组 '+(j+1))}</span><strong>${j+1} 桌</strong></div>`).join('');
  parts.push(`<article class="stats-panel ${i===0?'full':''}"><div class="stats-panel-head"><strong>${['跑团回顾年历','逐桌时间带','人物关系','模组统计','跑团足迹','时间分布'][i%6]}</strong></div><div class="stats-panel-body">${rows||'<div class="muted">当前没有记录</div>'}</div></article>`);
 }
 stats.innerHTML=`<div class="stats-dashboard-grid">${parts.join('')}</div>`;
 }
 const intro=id('selfIntroGrid');if(intro){intro.innerHTML=Array.from({length:Math.max(1,Math.min(n,8))},(_,i)=>`<article class="self-intro-card"><h3>${i%2?'作为 KP':'作为 PL'} · 偏好</h3><p>${esc(long)}</p></article>`).join('')}
 const plans=id('planBoard');if(plans){plans.innerHTML+=`<div class="plan-queue-visual-audit">${Array.from({length:Math.min(n,20)},(_,i)=>`<article class="plan-row card"><strong>${esc(i%2?long:'开团计划 '+i)}</strong><span>BRP 通用 · 进行中</span></article>`).join('')}</div>`}
 const records=id('recordsBoard');if(records){records.innerHTML=Array.from({length:Math.min(n,18)},(_,i)=>`<article class="table-record"><div class="table-record-head"><strong class="record-title-name">${esc(i%2?long:'跑团记录 '+i)}</strong></div><p>CoC · 第七版 / BRP 通用</p></article>`).join('')}
 const panel=id('statsExportPanel');if(panel){const stage=id('statsExportPreviewStage');if(stage)stage.innerHTML='<div class="export-preview-canvas-wrap" style="max-width:100%;width:100%"><canvas width="1080" height="1440" style="max-width:100%;height:auto"></canvas></div>';}
 window.visualSetupReady=true;
}'''
POSITION_JS=SOURCE[SOURCE.index('function positionStatsExportPanel(){'):SOURCE.index('function toggleStatsExportCenter(',SOURCE.index('function positionStatsExportPanel(){'))]
SWITCH = r'''({name,theme,privacy})=>{
 document.documentElement.dataset.theme=theme;
 document.body.classList.toggle('privacy-mask',privacy);
 const ids=['profilesView','pcsView','modulesView','plansView','recordsView','selfIntroView','statsView'];
 ids.forEach(k=>{const e=document.getElementById(k);if(!e)return;const active=k===name;e.hidden=!active;e.style.setProperty('display',active?'':'none',active?'':'important');if(active)e.style.removeProperty('display')});
 const overlay=document.getElementById('overlay'),settings=document.getElementById('settingsModal'),profile=document.getElementById('profileModalWrap');
 if(overlay)overlay.classList.toggle('open',name==='settingsModal');
 if(profile)profile.style.setProperty('display','none','important'); // settings must not coexist with PL modal
 if(settings){settings.hidden=name!=='settingsModal';settings.style.setProperty('display',name==='settingsModal'?'':'none',name==='settingsModal'?'':'important');if(name==='settingsModal')settings.style.removeProperty('display')}
 const content=document.querySelector('.shell');if(content)content.style.display=name==='settingsModal'?'none':'';
}'''
GEOMETRY = r'''({name,width})=>{
 const q=s=>document.querySelector(s), rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}},
 root=q(name==='settingsModal'?'#settingsModal':'#'+name),toolbar=name==='settingsModal'?q('#settingsModal .modal-head'):q('#'+name+' >.view-toolbar'),title=toolbar?.querySelector('.view-toolbar-title strong')||toolbar?.querySelector('h2');
 const get=e=>e?rect(e):null;
 const result={root:get(root),toolbar:get(toolbar),title:get(title),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
 theme:document.documentElement.dataset.theme,privacy:document.body.classList.contains('privacy-mask')};
 if(name==='statsView'){
 const t=q('#statsView>.stats-toolbar'),bench=q('#statsView .stats-range-workbench'),labels=[...q('#statsView .stats-range-workbench').querySelectorAll(':scope>.stats-filter-field')];
 result.stats={toolbar:get(t),workbench:get(bench),heading:get(q('#statsView .stats-toolbar>.view-toolbar-title strong')),selects:labels.map(get),
 export:get(q('#statsExportBtn')),mobile:get(q('#statsView .mobile-page-tools-btn')),columns:getComputedStyle(bench).gridTemplateColumns};
 }
 return result;
}'''

failures=[]; checks=0; snaps=[]
with sync_playwright() as p:
    opts=dict(headless=True,args=['--no-sandbox'])
    binary=os.environ.get('PL_CI_CHROMIUM_EXECUTABLE')
    if not binary and Path('/usr/bin/chromium').exists():binary='/usr/bin/chromium'
    if binary:opts['executable_path']=binary
    browser=p.chromium.launch(**opts)
    for width in WIDTHS:
        page=browser.new_page(viewport={'width':width,'height':820},device_scale_factor=1)
        page.set_content(FIXTURE,wait_until='domcontentloaded',timeout=60000)
        page_errors=[];page.on('pageerror',lambda err:page_errors.append(str(err)))
        assert page.evaluate('document.querySelectorAll("#profilesView,#pcsView,#modulesView,#plansView,#recordsView,#selfIntroView,#statsView,#settingsModal").length')==8
        for mode in ['empty','normal','large']:
            page.evaluate(SETUP,mode)
            for theme in THEMES:
                for privacy in [False,True]:
                    for name in VIEW_IDS:
                        page.evaluate(SWITCH,{'name':name,'theme':theme,'privacy':privacy})
                        data=page.evaluate(GEOMETRY,{'name':name,'width':width})
                        checks+=1
                        issue=[]
                        r=data['root'];t=data['toolbar'];h=data['title'];
                        if r is None or r['w']<100:issue.append('root missing or <100px')
                        if data['overflow']>2:issue.append(f"document horizontal overflow {data['overflow']:.1f}px")
                        if t and (t['w']<80 or t['right']>width+5 or t['x']<-5):issue.append('toolbar outside viewport')
                        if h and h['w']<40:issue.append('page title crushed')
                        if name=='statsView':
                            s=data['stats'];bench=s['workbench'];hdr=s['heading']
                            if hdr['h']>46 or hdr['w']<min(160,t['w']*.65):issue.append('statistics heading vertically crushed')
                            if bench['w']<t['w']*.91:issue.append('statistics filter occupies <91% of toolbar')
                            if width>760:
                                if any(x['w']<100 for x in s['selects']):issue.append('statistics selector <100px')
                                if s['export']['w']<100:issue.append('statistics export action too narrow')
                            else:
                                if s['mobile']['h']<42 or s['export']['h']<42:issue.append('statistics mobile touch area <42px')
                        if issue:
                            failures.append({'view':name,'width':width,'theme':theme,'privacy':privacy,'mode':mode,'reasons':issue,'rects':data})
                            if len(failures)<=16:
                                page.screenshot(path=str(SAVE / f'FAIL-{name}-{width}-{theme}-{int(privacy)}-{mode}.png'),full_page=True)
                        # Keep small, deterministic visual evidence: all eight pages, themes, two viewport classes.
                        if mode=='normal' and not privacy and width in [375,1280] and (theme=='mist' or (theme in ('tomato','night') and name=='statsView')):
                            target=SAVE / f'{name}-{width}-{theme}.png'
                            page.screenshot(path=str(target),full_page=True)
                            snaps.append(str(target.name))
        # Real static modal skeletons (actual source HTML/CSS, synthetic fields).
        # Export panel positioning is the app's real function, not a CSS-only guess.
        for theme in THEMES:
            for name in MODAL_IDS:
                page.evaluate(SWITCH,{'name':'statsView' if name=='statsExportPanel' else 'profilesView','theme':theme,'privacy':False})
                page.evaluate('''name=>{
                  const ids=['profileModalWrap','pcEditorBackdrop','nativeModuleEditorBackdrop','planEditorBackdrop','statsExportPanel'];
                  for(const k of ids){const e=document.getElementById(k);if(!e)continue;e.hidden=k!==name;
                    if(k===name)e.style.removeProperty('display');else e.style.setProperty('display','none','important');}
                  const ov=document.getElementById('overlay');ov.classList.toggle('open',name==='profileModalWrap');
                  document.body.classList.toggle('stats-export-open',name==='statsExportPanel');
                }''',name)
                if name=='statsExportPanel':
                    page.evaluate('(code)=>{(0,eval)(code);positionStatsExportPanel();}',POSITION_JS)
                    page.wait_for_timeout(220) # judge settled 160ms rail fade, not its first animation frame
                if name=='planEditorBackdrop':page.wait_for_timeout(220) # test settled state, not the 180ms entrance transform
                data=page.evaluate('''name=>{const e=document.getElementById(name),visual=name==='pcEditorBackdrop'?e.querySelector('.pc-editor'):name==='nativeModuleEditorBackdrop'?e.querySelector('.native-module-editor'):name==='planEditorBackdrop'?e.querySelector('.plan-editor-drawer'):name==='profileModalWrap'?e.querySelector('.modal'):e,r=visual.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};}''',name)
                checks+=1;issue=[]
                if data['w']<175 or data['h']<150:issue.append('modal too small or not rendered')
                if data['x']<-3 or data['right']>width+3 or data['bottom']>823:issue.append('modal cropped outside viewport')
                if data['overflow']>2:issue.append('modal created horizontal page overflow')
                if width<=760 and name=='statsExportPanel':
                    rail=page.evaluate('''()=>{const rail=document.getElementById('mobileSideRail'),nav=document.getElementById('mobileBottomNav'),r=getComputedStyle(rail),n=getComputedStyle(nav);return {railOpacity:Number(r.opacity),railEvents:r.pointerEvents,navOpacity:Number(n.opacity)};}''')
                    if rail['railOpacity']>.01 or rail['railEvents']!='none' or rail['navOpacity']>.01:
                        issue.append('floating rail/nav overlays mobile export panel: '+str(rail))
                if issue:
                    failures.append({'view':name,'width':width,'theme':theme,'mode':'modal','reasons':issue,'rects':data})
                    if len(failures)<=16:page.screenshot(path=str(SAVE/f'FAIL-{name}-{width}-{theme}.png'),full_page=False)
                if width in [375,1280] and theme=='mist':
                    target=SAVE/f'{name}-{width}-{theme}.png';page.screenshot(path=str(target),full_page=False);snaps.append(target.name)
        if page_errors:failures.append({'width':width,'page_errors':page_errors})
        page.close()
    # Extra breakpoint-adjacent checks run at a representative data density.
    for width in BREAKPOINTS:
        page=browser.new_page(viewport={'width':width,'height':820},device_scale_factor=1)
        page.set_content(FIXTURE,wait_until='domcontentloaded',timeout=60000)
        page.evaluate(SETUP,'normal')
        for name in VIEW_IDS:
            page.evaluate(SWITCH,{'name':name,'theme':'mist','privacy':False})
            v=page.evaluate(GEOMETRY,{'name':name,'width':width});checks+=1
            problems=[]
            if v['overflow']>2:problems.append('horizontal overflow')
            if v['title'] and v['title']['w']<40:problems.append('crushed title')
            if name=='statsView':
                t=v['stats']['toolbar'];b=v['stats']['workbench'];h=v['stats']['heading']
                if b['w']<t['w']*.91 or h['h']>46:problems.append('stats toolbar breakpoint regression')
            if problems:failures.append({'view':name,'width':width,'mode':'breakpoint','reasons':problems,'rects':v})
        page.close()
    browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',SOURCE).group(1),
        'kind':'static actual HTML+CSS with isolated synthetic DOM; not production runtime or real user data',
        'widths':WIDTHS,'breakpoints':BREAKPOINTS,'themes':THEMES,'modes':['empty','normal','large'],
        'privacy':[False,True], 'views':VIEW_IDS,'checks':checks,'failures':failures,'screenshots':snaps}
(SAVE/'round156-visual-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f"Round156 visual structural checks={checks} screenshots={len(snaps)} failures={len(failures)}")
for x in failures[:12]:print('FAIL',json.dumps(x,ensure_ascii=False)[:260])
if failures:raise SystemExit(1)
