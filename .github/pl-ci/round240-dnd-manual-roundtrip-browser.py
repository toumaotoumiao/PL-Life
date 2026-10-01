#!/usr/bin/env python3
"""Synthetic full-app D&D edit -> canonical save -> reload -> public text + canvas blocks.
Uses a fresh in-memory storage shim; no real workbook or user's local data."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
# Test-only expose actual canvas section renderer without changing shipped code.
anchor='  function pcFullArchiveBlocks(pc,state,innerWidth=976){'
assert html.count(anchor)==1
html=html.replace(anchor,'  window.__round240GenericBlocks=pcGenericArchiveBlocks;\n'+anchor,1)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=(os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or None),args=['--no-sandbox'])
 try:
  for width in [375,1280]:
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   try:
    page.set_content(html,wait_until='domcontentloaded',timeout=90000)
    result=page.evaluate('''()=>{
      const fields=['背景','种族／物种','阵营','等级','熟练加值','先攻','生命值'];
      const me=selfProfileId(),editions=['5e-2014','5e-2024'];
      const expect=[{'等级':'4','生命值':'24','种族／物种':'虚构甲族'},{'等级':'3','生命值':'18','种族／物种':'虚构乙族'}];
      const source=[];
      for(let i=0;i<2;i++){
        const draft=makeBlankPc(me);draft.id='round240-fiction-'+i;draft.name='合成角色'+(i+1);
        draft.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:editions[i],confirmed:true,source:'user-selected'};
        const rows=pcRuleEditableData(draft).resources;
        for(const row of rows)if(Object.hasOwn(expect[i],row.label))row.value=expect[i][row.label];
        if(pcValidateArchiveInput(draft))throw Error('valid synthetic PC rejected');
        const normalized=normalizePcArchive(draft,new Set(profiles.map(x=>String(x.id))));
        pcs.push(normalized);source.push(JSON.stringify(normalized.ruleSheets));
      }
      const committed=saveState(),raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!committed||!raw)throw Error('canonical save not committed');
      const loaded=ensureSelfProfileAndLinks(hydrateCanonicalArchive(JSON.parse(JSON.stringify(raw))));
      const before=JSON.stringify(source);
      const results=loaded.pcs.filter(x=>x.id.startsWith('round240-fiction-')).sort((a,b)=>a.id.localeCompare(b.id));
      const per=results.map((pc,i)=>{
        const rows=pcRuleCurrentData(pc).resources,facts=pcDndCardStats(pc),card=pcCardHTML(pc),compact=pcCompactRowHTML(pc),reading=pcRuleReadingHTML(pc);
        const blocks=window.__round240GenericBlocks(pc,{density:'compact',showExactDates:true},976);
        const collector={save(){},restore(){},fillText(v){this.values.push(String(v))},values:[]};
        for(const block of blocks.filter(x=>x.title.includes('身份、战斗')))block.draw(collector,0,0,920);
        const words=collector.values.join('|');
        return {
          scope:pc.ruleMeta.editionId===editions[i],raw:JSON.stringify(pc.ruleSheets)===source[i],
          seven:rows.map(x=>x.label).join('|')===fields.join('|'),
          values:Object.entries(expect[i]).every(([k,v])=>rows.some(x=>x.label===k&&x.value===v)),
          blank:rows.filter(x=>!Object.hasOwn(expect[i],x.label)).every(x=>x.value===''),
          facts:facts.length===3&&Object.entries(expect[i]).every(([k,v])=>facts.some(([f,w])=>f===k&&w===v)),
          card:Object.values(expect[i]).every(v=>card.includes(v))&&Object.values(expect[i]).every(v=>compact.includes(v)),
          reading:Object.values(expect[i]).every(v=>reading.includes(v)),
          export:Object.values(expect[i]).every(v=>words.includes(v))&&['背景','阵营','先攻'].every(x=>!words.includes(x)),
          noCross:Object.entries(expect[1-i]).every(([k,v])=>!rows.some(x=>x.label===k&&x.value===v)),
        };
      });
      return {committed,per};
    }''')
    for i,row in enumerate(result['per']):
     for name,val in row.items():checks.append({'width':width,'edition':i,'check':name,'pass':bool(val)})
    if width==375:
     page.evaluate('''()=>{switchView('pcs',{historyMode:'none',restoreScroll:false});const chosen=pcs.filter(x=>x.id.startsWith('round240-fiction-'));document.querySelector('#pcGrid').innerHTML=chosen.map(pcCardHTML).join('');}''')
     for viewport in [320,375,390,430,768,1024,1280,1440]:
      page.set_viewport_size({'width':viewport,'height':900})
      dimensions=page.evaluate('''()=>{const cards=[...document.querySelectorAll('#pcGrid .pc-card')],species=[...document.querySelectorAll('#pcGrid .pc-dnd-species-stat strong')];return {count:cards.length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,escaped:cards.some(x=>x.getBoundingClientRect().right>innerWidth+2),facts:cards.every(x=>x.querySelectorAll('.pc-core-stat').length===3),readable:species.length===2&&species.every(x=>x.getBoundingClientRect().height<=24)}}''')
      ok=dimensions['count']==2 and dimensions['overflow']<=3 and not dimensions['escaped'] and dimensions['facts'] and dimensions['readable']
      checks.append({'width':viewport,'check':'card_visual', 'pass':ok})
      if viewport in (320,390,1280):page.screenshot(path=str(out/f'round240-dnd-card-{viewport}.png'),full_page=False)
      long_ok=page.evaluate('''()=>{const stat=document.querySelector('#pcGrid .pc-dnd-species-stat strong');const prev=stat.textContent;stat.textContent='FictionalSpeciesWithVeryLongUnbrokenName'.repeat(5);const ok=document.documentElement.scrollWidth<=document.documentElement.clientWidth+3&&stat.getBoundingClientRect().right<=innerWidth+2;stat.textContent=prev;return ok}''')
      checks.append({'width':viewport,'check':'long_species_no_overflow','pass':long_ok})
   except Exception as e:checks.append({'width':width,'check':'browser_exception','pass':False,'error_type':type(e).__name__})
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(bool(x['pass']) for x in checks),'failed':[x for x in checks if not x['pass']],'mode':'synthetic full application JS, in-memory save and reload, public canvas blocks; no native IndexedDB'}
(out/'round240-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({k:v for k,v in report.items() if k!='failed'}|{'failures':len(report['failed'])},ensure_ascii=False))
if report['failed']:print(json.dumps(report['failed'],ensure_ascii=False));raise SystemExit(1)
