#!/usr/bin/env python3
"""Isolated product-code Chromium checks, synthetic records only. Not full-site or IndexedDB E2E."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci'))) / 'round172-evidence';OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join((part('function normalizePcRuleData(', 'function normalizePcArchive('),part('function pcRuleReadingHTML(pc){', 'function pcOverviewDashboardHTML(pc){'),part('  function pcArchiveTextLines(', '  function pcFullArchiveBlocks(')))
setup=r'''
function clone(v){return structuredClone(v)}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function moduleRuleDisplay(v){return String(v?.systemId||'generic')}
function pcStatusLabel(v){return String(v||'active')}
function pcOwnerProfile(){return null}function pcOwnerName(){return '合成PL'}function pcTimelineRows(){return []}
function theme(){return {muted:'#999',text2:'#333'}}
function canvasWrapLines(ctx,text,maxW){let out=[],line='';for(const ch of String(text)){if(line&&ctx.measureText(line+ch).width>maxW){out.push(line);line=ch}else line+=ch}out.push(line);return out}
const PC_BACKGROUND_KEYS=[],privacyMaskEnabled=false,els={pcEditorBody:document.getElementById('reader')};
'''
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:#f8f7f5;color:#252525}body{padding:10px}#reader{max-width:900px;margin:auto;--t-line:#d8d5ce;--t-surface:#fff;--t-surface-2:#f5f3ef;--t-text:#252525;--t-text-2:#494949;--t-muted:#666;--t-ink:#252525;--t-accent:#b65d43;--t-accent-strong:#a34b2f}.pc-overview-section{border:1px solid var(--t-line);border-radius:12px;padding:12px;background:var(--t-surface)}'''
css+=part('/* Stage24: rule field description', '@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')
css+='@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}'
fixture={'id':'PC-SYNTHETIC','name':'合成角色','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[{'label':'短字段','value':'2','detail':'短说明'}, {'label':'长说明','value':'4','detail':'<script>alert(1)</script>\n'+('公开说明语句。'*55),'extra':{'stable':1}}]+[{'label':f'技能-{i}','value':'3','detail':'第'+str(i)+'个说明'} for i in range(12)],'resources':[],'unknown':{'preserve':True}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]}},'coc':{'san':44},'excelEdits':[{'sheet':'人物卡','ref':'A1','value':'原始'}], 'status':'active','background':{},'inventory':'','assets':'','notes':''}
checks=[]
def check(k,ok):
 checks.append((k,bool(ok)));
 if not ok:raise AssertionError(k)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':850})
   page.set_content('<style>'+css+'</style><main id="reader"></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\nconst pc='+json.dumps(fixture,ensure_ascii=False)+';const before=JSON.stringify(pc);function render(){els.pcEditorBody.innerHTML=pcRuleReadingHTML(pc)};render();')
   if width in (375,1280):page.screenshot(path=str(OUT/f'long-reading-collapsed-{width}.png'),full_page=True)
   out=page.evaluate('''() => {
    const short=els.pcEditorBody.querySelector('.pc-rule-reading-item>p');
    const long=els.pcEditorBody.querySelector('[data-pc-rule-reading-detail-token="PC-SYNTHETIC:insane:skills:1"]');
    const group=els.pcEditorBody.querySelector('[data-pc-rule-read-token]');
    const initial={collapsed:!long.open&&!!short,summary:long.querySelector('summary').textContent,missingXss:!document.querySelector('script[src="x"]')&&!els.pcEditorBody.querySelector('.pc-rule-reading-detail script'),height:long.getBoundingClientRect().height,allCollapsed:!group.open};
    long.open=true;group.open=true;pcCaptureRuleDisclosures();render();
    const persisted=els.pcEditorBody.querySelector('[data-pc-rule-reading-detail-token="PC-SYNTHETIC:insane:skills:1"]').open&&els.pcEditorBody.querySelector('[data-pc-rule-read-token]').open;
    const expanded=els.pcEditorBody.querySelector('[data-pc-rule-reading-detail-token="PC-SYNTHETIC:insane:skills:1"]');
    const full=expanded.querySelector('p').textContent===pc.ruleSheets.insane.skills[1].detail&&getComputedStyle(expanded.querySelector('p')).whiteSpace==='pre-wrap';
    const expandedSummaryHeight=expanded.querySelector('summary').getBoundingClientRect().height;
    pc.ruleMeta.systemId='shinobigami';render();const alt=els.pcEditorBody.textContent.includes('流派');pc.ruleMeta.systemId='insane';render();const restored=els.pcEditorBody.querySelector('[data-pc-rule-reading-detail-token="PC-SYNTHETIC:insane:skills:1"]').open;
    const original=pc.ruleSheets.insane.skills[1].extra.stable===1&&pc.ruleSheets.shinobigami.traits[0].value==='甲'&&pc.excelEdits[0].value==='原始'&&pc.coc.san===44;
    const exact=JSON.stringify(pc)===before;
    const exportBlocks=pcGenericArchiveBlocks(pc,{density:'standard',showOwner:false,showExactDates:false},976),texts=[];const ctx=document.createElement('canvas').getContext('2d');ctx.fillText=(s)=>texts.push(String(s));exportBlocks.forEach(b=>b.draw(ctx,0,0,976));
    const longText=Array.from({length:1100},(_,i)=>'第'+String(i).padStart(4,'0')+'行').join('\\n');
    const test=structuredClone(pc);test.ruleSheets.insane.skills=[{label:'超长规则说明',value:'',detail:longText}];
    const longBlocks=pcGenericArchiveBlocks(test,{density:'standard',showOwner:false,showExactDates:false},976),lines=[];ctx.fillText=(s)=>lines.push(String(s));longBlocks.forEach(b=>b.draw(ctx,0,0,976));
    test.ruleSheets.insane.skills[0].detail=Array.from({length:1601},(_,i)=>'安全阈值行'+i).join('\\n');
    let stopped=false;try{pcGenericArchiveBlocks(test,{density:'standard',showOwner:false,showExactDates:false},976)}catch(err){stopped=String(err.message).includes('图片未生成')}
    return {initial,persisted,full,alt,restored,original,exact,exportDetail:texts.some(s=>s.includes('公开说明语句')),lineCount:lines.filter(s=>s.startsWith('第')).length,tail:lines.includes('第1099行'),stopped,overflow:document.documentElement.scrollWidth>innerWidth+1,summaryHeight:expandedSummaryHeight,groupCount:els.pcEditorBody.querySelectorAll('.pc-rule-reading-item').length};
   }''')
   for k,v in {'collapsed-initially':out['initial']['collapsed'],'summary-brief':len(out['initial']['summary'])<115,'no-xss-execution-elements':out['initial']['missingXss'],'group-summary-closed':out['initial']['allCollapsed'],'retain-long-disclosure':out['persisted'],'preserve-newlines':out['full'],'alternate-rule':out['alt'],'restore-rule-disclosure':out['restored'],'extension-and-old-coc':out['original'],'no-data-change':out['exact'],'export-real-detail':out['exportDetail'],'export-over-999':out['tail'] and out['lineCount']>=1100,'oversize-fail-closed':out['stopped'],'no-page-overflow':not out['overflow'],'44px-touch':out['summaryHeight']>=43.5,'all-rows':out['groupCount']==15}.items():check(f'{width}px:{k}',v)
   if width in (375,1280):
    page.screenshot(path=str(OUT/f'long-reading-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
result={'tests':len(checks),'passed':sum(v for _,v in checks),'failed':[k for k,v in checks if not v],'mode':'isolated production-code Chromium; synthetic data only'}
(OUT/'round172-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
