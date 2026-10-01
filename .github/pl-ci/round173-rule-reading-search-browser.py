#!/usr/bin/env python3
"""Synthetic in-memory use of production rule reader and filter logic, not native storage E2E."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci'))) / 'round173-evidence';OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){')])
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:#f8f7f5;color:#252525}body{padding:10px}#reader{max-width:900px;margin:auto;--t-line:#d8d5ce;--t-surface:#fff;--t-surface-2:#f5f3ef;--t-text:#252525;--t-text-2:#494949;--t-muted:#666;--t-ink:#252525;--t-accent:#b65d43;--t-accent-strong:#a34b2f}.pc-overview-section{border:1px solid var(--t-line);border-radius:12px;padding:12px;background:var(--t-surface);margin-bottom:10px}'''
css+=part('/* Stage24: rule field description','@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}')
css+='@media(max-width:430px){.pc-rule-reading-grid{grid-template-columns:1fr}.pc-rule-filter-controls>input[type=search]{flex-basis:100%}}'
setup=r'''
function clone(v){return structuredClone(v)}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const els={pcEditorBody:document.querySelector('#reader')};let pcDraft;
function render(){els.pcEditorBody.innerHTML=pcRuleReadingHTML(pcDraft)}
els.pcEditorBody.addEventListener('input',event=>{if(event.target.dataset.pcRuleReadingSearch)pcApplyRuleReadingSearch(event.target.closest('[data-pc-rule-reading-group]'),event.target.value)});
els.pcEditorBody.addEventListener('toggle',event=>{let token=event.target.dataset?.pcRuleReadToken;if(token&&!event.target.dataset.pcRuleSearchActive){if(event.target.open)pcRuleReadingOpenUi.add(token);else pcRuleReadingOpenUi.delete(token)}},true);
'''
fixture={'id':'PC-SYNTH','ruleMeta':{'systemId':'insane'},'ruleData':{'traits':[],'skills':[],'resources':[]},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[{'label':'无名空白','value':'','detail':''}]+[{'label':'特技'+str(i),'value':str(i),'detail':('第十项的公开说明\n马灯与钥匙' if i==10 else '普通说明'+str(i)), 'extension':{'id':i}} for i in range(14)],'resources':[],'futureSection':{'unknown':True}},'shinobigami':{'traits':[{'label':'流派','value':'甲'}],'skills':[],'resources':[]}},'coc':{'san':41},'excelEdits':[{'sheet':'旧卡','ref':'B2','value':'原始'}]}
checks=[]
def check(name,value):
 checks.append((name,bool(value)))
 if not value:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':850})
   page.set_content('<style>'+css+'</style><main id="reader"></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';const before=JSON.stringify(pcDraft);render();')
   if width in (375,1280):page.screenshot(path=str(OUT/f'reading-before-{width}.png'),full_page=True)
   out=page.evaluate('''() => {
      const root=els.pcEditorBody,section=root.querySelector('[data-pc-rule-reading-group="skills"]'),input=section.querySelector('input'),more=section.querySelector('details'),token=more.dataset.pcRuleReadToken;
      const first={rows:section.querySelectorAll('[data-pc-rule-reading-item]').length,search:!!input,closed:!more.open,hit:input.getBoundingClientRect().height>=43.5};
      input.value='马灯';input.dispatchEvent(new Event('input',{bubbles:true}));
      const matching=[...section.querySelectorAll('[data-pc-rule-reading-item]')].filter(x=>!x.hidden),matched={count:matching.length,correct:matching[0]?.textContent.includes('马灯'),opened:more.open,status:section.querySelector('[role=status]').textContent,summary:more.querySelector('summary').textContent};
      input.value='不存在';input.dispatchEvent(new Event('input',{bubbles:true}));const empty=[...section.querySelectorAll('[data-pc-rule-reading-item]')].every(x=>x.hidden)&&!section.querySelector('[data-pc-rule-reading-empty]').hidden&&more.hidden;
      input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));const cleared=[...section.querySelectorAll('[data-pc-rule-reading-item]')].every(x=>!x.hidden)&&!more.open&&!more.hidden&&more.querySelector('summary').textContent.startsWith('展开全部');
      more.open=true;pcRuleReadingOpenUi.add(token);input.value='马灯';input.dispatchEvent(new Event('input',{bubbles:true}));input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));const restored=more.open;
      input.value='钥匙';input.dispatchEvent(new Event('input',{bubbles:true}));render();const rerendered=root.querySelector('input[data-pc-rule-reading-search]').value==='钥匙'&&root.querySelector('[data-pc-rule-read-token]').open;
      pcDraft.ruleMeta.systemId='shinobigami';render();const otherRule=!!root.querySelector('.pc-rule-reading-item')&&!root.querySelector('[data-pc-rule-reading-search]');pcDraft.ruleMeta.systemId='insane';render();const back=root.querySelector('input[data-pc-rule-reading-search]').value==='钥匙';
      const other=structuredClone(pcDraft);other.id='another-pc';pcDraft=other;render();const otherPc=!root.querySelector('input[data-pc-rule-reading-search]').value;
      const safe=JSON.stringify(pcDraft)===before.replace('PC-SYNTH','another-pc')&&pcDraft.ruleSheets.insane.futureSection.unknown===true;
      return {first,matched,empty,cleared,restored,rerendered,otherRule,back,otherPc,safe,overflow:document.documentElement.scrollWidth>innerWidth+1};
   }''')
   for name,val in {'all-14-filled':out['first']['rows']==14,'search-for-long-list':out['first']['search'],'initial-collapsed':out['first']['closed'],'44px-search':out['first']['hit'],'match-description':out['matched']['count']==1 and out['matched']['correct'],'search-opens-remainder':out['matched']['opened'],'accurate-search-summary':out['matched']['summary']=='匹配的其他字段（1 项）','visible-hit-count':out['matched']['status']=='显示 1 / 14','no-match':out['empty'],'clear-restores':out['cleared'],'manual-state-restored':out['restored'],'rerender-preserves-search':out['rerendered'],'rule-isolation':out['otherRule'] and out['back'],'pc-isolation':out['otherPc'],'no-data-change':out['safe'],'no-horizontal-overflow':not out['overflow']}.items():check(f'{width}px:{name}',val)
   if width in (375,1280):
    page.evaluate("pcDraft.id='PC-SYNTH';render()")
    page.screenshot(path=str(OUT/f'reading-search-{width}.png'),full_page=True)
   page.close()
 finally:browser.close()
result={'tests':len(checks),'passed':sum(v for _,v in checks),'failed':[k for k,v in checks if not v],'mode':'production-code isolated in-memory Chromium, synthetic records only'}
(OUT/'round173-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(result,ensure_ascii=False))
