#!/usr/bin/env python3
"""Isolated real-site JS: compare fully normalized business objects before write and after canonical save/re-hydration.
No native IndexedDB and no user's personal storage. The latter is a separate release gate."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round182-evidence'
OUT.mkdir(parents=True,exist_ok=True)
html=(ROOT/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(ROOT/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[];fail=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PL_CI_CHROMIUM_EXECUTABLE','/usr/bin/chromium'),args=['--no-sandbox'])
 try:
  for width in (375,1280):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   try:
    page.set_content(html,wait_until='domcontentloaded',timeout=90000)
    result=page.evaluate('''()=>{
      const me=selfProfileId(),owners=new Set(profiles.map(x=>String(x.id)));
      const pc=normalizePcArchive({id:'round182-pc',name:'虚构规则人物',ownerPlId:me,
       ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true,source:'user-selected'},
       ruleSheets:{insane:{traits:[{label:'生命力',value:'6',detail:'保留全文',unknown:{tail:'最后一行'}}],skills:[],resources:[],extra:{hold:true}},future:{keep:'yes'}},
       ruleData:{traits:[{label:'历史',value:'原值'}],skills:[],resources:[]},
       coc:{san:45},excelEdits:[{sheet:'旧表',ref:'B2',value:'历史 Excel'}]},owners);
      pcs.push(pc);
      const base={familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true,source:'user-selected'};
      modules.push(normalizeRichModule({id:'round182-mod',name:'合成同名模组',ruleMeta:base},settings.moduleArchive));
      runPlans.push(normalizeRunPlan({id:'round182-plan',moduleId:'round182-mod',ruleMeta:base,tableName:'合成计划',plIds:[me]},owners));
      runRecords.push(normalizeRunRecord({id:'round182-record',moduleId:'round182-mod',ruleMeta:base,tableName:'合成历史',runNotes:'记录原文',plIds:[me]},owners));
      const archive=buildCanonicalArchive(false);
      const incoming=ensureSelfProfileAndLinks(hydrateCanonicalArchive(archive));
      const projected=completeBackupRuleEvidence(incoming);
      // Actual restore commit starts from hydrated incoming, THEN saveState normalizes
      // the runtime and canonicalizes it again; test that exact boundary.
      settings=incoming.settings;profiles=incoming.profiles;pcs=incoming.pcs;modules=incoming.modules;
      runPlans=incoming.runPlans;runRecords=incoming.runRecords;
      const savedOk=saveState();
      const canonicalSaved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(!savedOk||!canonicalSaved)throw new Error("synthetic saveState refused");
      const reloaded=JSON.parse(JSON.stringify(canonicalSaved));
      const hydrated=ensureSelfProfileAndLinks(hydrateCanonicalArchive(reloaded));
      const unchanged=projected===completeBackupRuleEvidence(hydrated);
      const reloadSame=completeBackupRuleEvidence(ensureSelfProfileAndLinks(hydrateCanonicalArchive(JSON.parse(JSON.stringify(canonicalSaved)))))===projected;
      const modified=JSON.parse(JSON.stringify(hydrated));
      const one=modified.pcs.find(x=>x.id==='round182-pc');one.ruleSheets.insane.traits[0].unknown.tail='modified';
      const detectsNested=completeBackupRuleEvidence(modified)!==projected;
      modified.pcs=JSON.parse(JSON.stringify(hydrated.pcs));
      const profile=modified.profiles.find(x=>String(x.id)===String(me));
      const baseProfile=hydrated.profiles.find(x=>String(x.id)===String(me));
      profile.selfIntro={...baseProfile.selfIntro, future:'modified-future'};
      const detectsProfile=completeBackupRuleEvidence(modified)!==projected;
      modified.profiles=JSON.parse(JSON.stringify(hydrated.profiles));
      modified.settings={...hydrated.settings,futureSetting:{new:'changed'}};
      const detectsSettings=completeBackupRuleEvidence(modified)!==projected;
      modified.settings=JSON.parse(JSON.stringify(hydrated.settings));
      const row=modified.runRecords.find(x=>x.id==='round182-record');row.runNotes='';
      const detectsRecord=completeBackupRuleEvidence(modified)!==projected;
      return {unchanged,reloadSame,detectsNested,detectsRecord,detectsProfile,detectsSettings,savedOk};
    }''')
    # Any failure is explicit, never a disguised green. Keep values out of reports.
    for key in ('unchanged','reloadSame','detectsNested','detectsRecord','detectsProfile','detectsSettings'):
     checks.append((str(width)+':'+key,result[key]))
     if not result[key]:fail.append(str(width)+':'+key)
   except Exception as e:fail.append(str(width)+':exception:'+type(e).__name__)
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(ok for _,ok in checks),'failed':fail,'mode':'actual application JS, synthetic in-memory only; native IndexedDB not tested'}
(OUT/'round182-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fail:raise SystemExit(1)
