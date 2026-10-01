#!/usr/bin/env python3
"""Isolated real Chromium canvas operation with production rule-card and export functions; synthetic records only."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round175-evidence';OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i;return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('  async function buildPcRuleShowcaseCardCanvas(pc,state){','  async function buildPcShowcaseCardCanvas(pc,state){'),part('  function pcFullArchiveImageCanvases(pc,state){','  function entityContinuousLongCanvas(')])
fixture={'id':'SYNTHETIC-01','name':'虚构角色','status':'active','era':'现代','occupation':'档案员','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[{'label':'已填技能','value':'65'},{'label':'','value':'','detail':'说明尾部保留'},{'label':'','value':'9','detail':''},{'label':'空白模板','value':'','detail':''}]+[{'label':'技能'+str(i),'value':str(i),'detail':'说明'+str(i)} for i in range(12)],'resources':[{'label':'资源','value':'','detail':'条目保留'}],'future':{'key':'keep'}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]}},'excelEdits':[{'sheet':'旧卡','ref':'B2','value':'保留'}],'coc':{'san':50}}
setup=r'''
const PC_BACKGROUND_KEYS=[],privacyMaskEnabled=false;
function clone(v){return structuredClone(v)}
function pcRuleIsCoc(){return false}
function moduleRuleDisplay(m){return String(m?.systemId||'')}function pcStatusLabel(s){return String(s||'')}function pcOwnerProfile(){return null}function pcOwnerName(){return '虚构PL'}function publicProfileName(){return '公开PL'}
function pcFullArchiveBlocks(){return [{h:850,title:'第一页',draw(){}},{h:850,title:'第二页',draw(){}}]}
const draws=[],titles=[],stats=[];
const native=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(text,...args){draws.push(String(text));return native.call(this,String(text),...args)};
function makeCanvas(w,h,scale=2){const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);return {canvas,ctx}}
function theme(){const palettes={mist:{bg:'#f7f6f3',surface:'#fff',surface2:'#f3f2ef',ink:'#232723',text2:'#444',muted:'#777',line:'#d7d9d4',accent:'#51795b'},tomato:{bg:'#fff2f0',surface:'#fffafa',surface2:'#fdece8',ink:'#4b2626',text2:'#754646',muted:'#987171',line:'#e7c8c5',accent:'#ba6761'},night:{bg:'#252231',surface:'#342f42',surface2:'#3f3850',ink:'#f5ecff',text2:'#dacbe8',muted:'#aa9bbd',line:'#60566d',accent:'#aa85cf'}};return palettes[document.documentElement.dataset.theme]||palettes.mist}
function canvasFillRound(ctx,x,y,w,h,r,fill,stroke){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h)}}
function canvasTextFit(ctx,value,max){const s=String(value||'');let t=s;while(t.length>1&&ctx.measureText(t).width>max)t=t.slice(0,-2)+'…';return t}
function header(ctx,W,t,eyebrow,title,subtitle,chips=[]){titles.push(eyebrow);stats.push(...chips);canvasFillRound(ctx,34,20,W-68,147,12,t.surface,t.line);ctx.fillStyle=t.muted;ctx.font='700 14px system-ui';ctx.fillText(eyebrow,55,49);ctx.fillStyle=t.ink;ctx.font='800 30px system-ui';ctx.fillText(title,55,91);ctx.font='12px system-ui';ctx.fillText(subtitle,55,113);ctx.font='12px system-ui';ctx.fillText(chips.join(' · '),55,141);return 175}
function panel(ctx,x,y,w,h,t,title,sub=''){canvasFillRound(ctx,x,y,w,h,12,t.surface,t.line);ctx.fillStyle=t.ink;ctx.font='700 17px system-ui';ctx.fillText(title,x+18,y+35);if(sub){ctx.fillStyle=t.muted;ctx.font='11px system-ui';ctx.fillText(sub,x+18,y+55)}return y+(sub?72:58)}
function footer(ctx,W,H,t){ctx.font='11px system-ui';ctx.fillStyle=t.muted;ctx.fillText('PC · 角色简卡',36,H-26)}
'''
checks=[]
def check(name,val):
 checks.append((name,bool(val)))
 if not val:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':900})
   page.set_content('<style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:#f7f6f3;padding:6px}#card canvas{display:block;width:100%;max-width:720px;height:auto;margin:auto;border-radius:12px;border:1px solid #ddd}</style><div id="card"></div>')
   page.add_script_tag(content=setup+'\n'+logic+'\nwindow.fixture='+json.dumps(fixture,ensure_ascii=False)+';window.before=JSON.stringify(window.fixture);')
   result=page.evaluate('''async()=>{const card=await buildPcRuleShowcaseCardCanvas(window.fixture,{showOwner:false,density:'standard'});document.getElementById('card').append(card);let full=pcFullArchiveImageCanvases(window.fixture,{density:'standard'});return {card:[card.width,card.height],full:full.length,summary:titles.includes('PC · 角色简卡'),onlySummary:!titles.includes('PC · 完整角色档案'),count:stats.includes('15 项技能'),groupCount:draws.some(x=>x==='展示 6 / 15 项'),unnamed:draws.includes('未命名字段 2'),detail:draws.some(x=>x.includes('说明尾部保留')),oldValue:window.fixture.excelEdits[0].value,untouched:window.before===JSON.stringify(window.fixture),outerOverflow:document.documentElement.scrollWidth>innerWidth+1,aspect:Math.abs(card.width/card.height-1080/(card.height/2))<.0001,fullCount:stats.filter(x=>x==='15 项技能').length};}''')
   expectations={'adaptive-card-size':result['card'][0]==2160 and 1520<=result['card'][1]<2060,'multi-page-full':result['full']==2,'summary-only':result['summary'],'counts-details':result['count'],'shows-count-and-limit':result['groupCount'],'fallback-unnamed':result['unnamed'],'public-detail':result['detail'],'no-mutation':result['untouched'],'old-excel-preserved':result['oldValue']=='保留','no-overflow':not result['outerOverflow'],'aspect-correct':result['aspect'],'full-header-count':result['fullCount']>=2}
   for name,ok in expectations.items():check(f'{width}px:{name}',ok)
   if width in (320,375,1280):page.screenshot(path=str(OUT/f'card-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
# Theme appearance smoke test uses synthetic palette tokens, not the app's full theme engine.
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for name in ('mist','tomato','night'):
   page=browser.new_page(viewport={'width':375,'height':900})
   page.set_content('<style>*{box-sizing:border-box}body{margin:0;padding:7px}canvas{display:block;width:100%;height:auto}</style><div id="card"></div>')
   page.add_script_tag(content=setup+'\n'+logic+'\nwindow.fixture='+json.dumps(fixture,ensure_ascii=False)+';')
   result=page.evaluate('''async name=>{document.documentElement.dataset.theme=name;const data=JSON.stringify(window.fixture),card=await buildPcRuleShowcaseCardCanvas(window.fixture,{showOwner:false});document.getElementById('card').append(card);return {color:[...card.getContext('2d').getImageData(0,0,1,1).data],width:card.width,untouched:data===JSON.stringify(window.fixture),overflow:document.documentElement.scrollWidth>innerWidth+1}}''',name)
   for field,ok in {'canvas-width':result['width']==2160,'nontransparent-canvas':result['color'][3]==255,'unchanged-data':result['untouched'],'no-overflow':not result['overflow']}.items():check(f'theme:{name}:{field}',ok)
   page.screenshot(path=str(OUT/f'card-{name}-375.png'),full_page=True)
   page.close()
 finally:browser.close()

report={'tests':len(checks),'passed':sum(ok for _,ok in checks),'failed':[name for name,ok in checks if not ok],'mode':'isolated actual production rendering + synthetic PC; not IDB end-to-end'}
(OUT/'round175-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
