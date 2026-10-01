#!/usr/bin/env python3
"""Synthetic in-memory actual-app module roundtrip. Native IndexedDB not asserted."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round184-evidence'
OUT.mkdir(parents=True,exist_ok=True)
source=Path(os.environ.get('PL_STAGE38_HTML',str(ROOT/'index.html')))
html=source.read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(ROOT/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim='''<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>'''
html=html.replace('<head>','<head>'+shim,1)
checks=[];fails=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PL_CI_CHROMIUM_EXECUTABLE','/usr/bin/chromium'),args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':900},service_workers='block')
   try:
    page.set_content(html,wait_until='domcontentloaded',timeout=90000)
    result=page.evaluate('''()=>{
      const raw=JSON.parse(JSON.stringify({id:'round184-m',name:'  合成模组  ',rules:'Insane',
        ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',confirmed:true,futureEdition:{source:'future'}},
        recruitment:{rules:'Insane',recommendedSkills:'调查',futureRecruitment:{handout:['H1','H2']}},
        rating:{manualScore:8,scores:{mood:7},futureRating:{quality:'reviewed'}},
        legacySideOffset:{pl:2,kp:1,futureOffset:{custom:'keep'}},
        futureModule:{customFields:[0,false,''],nextRules:{edition:99}}}));
      const rawBefore=JSON.stringify(raw);const injection=JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"prototype":2}');
      const module=normalizeRichModule({...raw,...injection},settings.moduleArchive);
      const canonical=canonicalModuleFromRuntime(module);
      const recreated=normalizeCanonicalModule(canonical,settings.moduleArchive);
      const a=canonicalModuleFromRuntime(recreated);
      const knownNormalized=module.name==='合成模组'&&module.legacySideOffset.pl===2;
      const originalUnchanged=JSON.stringify(raw)===rawBefore;
      const noPollution=!Object.prototype.hasOwnProperty.call(module,'__proto__')&&!Object.prototype.hasOwnProperty.call(canonical,'constructor')&&!Object.prototype.hasOwnProperty.call(recreated,'prototype')&&({}).polluted===undefined;
      modules.push(module);module.name='新标题';
      const saved=saveState();const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      const loaded=ensureSelfProfileAndLinks(hydrateCanonicalArchive(persisted));
      const final=loaded.modules.find(x=>x.id==='round184-m');
      const all=(x)=>x&&JSON.stringify(x.futureModule)===JSON.stringify(raw.futureModule)&&
        JSON.stringify(x.ruleMeta?.futureEdition)===JSON.stringify(raw.ruleMeta.futureEdition)&&
        JSON.stringify(x.recruitment?.futureRecruitment)===JSON.stringify(raw.recruitment.futureRecruitment)&&
        JSON.stringify(x.rating?.futureRating)===JSON.stringify(raw.rating.futureRating)&&
        JSON.stringify(x.legacySideOffset?.futureOffset)===JSON.stringify(raw.legacySideOffset.futureOffset);
      const sourceEvidence=completeBackupRuleEvidence({settings:loaded.settings,profiles:loaded.profiles,pcs:loaded.pcs,modules:loaded.modules,runPlans:loaded.runPlans,runRecords:loaded.runRecords});
      const tamper=JSON.parse(JSON.stringify(loaded)); delete tamper.modules.find(x=>x.id==='round184-m').futureModule;
      const detectsLoss=sourceEvidence!==completeBackupRuleEvidence(tamper);
      return {knownNormalized,originalUnchanged,noPollution,canonicalPreserved:!!all(canonical),recreatedPreserved:!!all(a),saved:!!saved,present:!!final,finalPreserved:!!all(final),renamed:final?.name==='新标题',differentRuleUnchanged:final?.ruleMeta?.systemId==='insane',detectsLoss};
    }''')
    for key,value in result.items():
     checks.append((f'{width}:{key}',bool(value)))
     if not value:fails.append(f'{width}:{key}')
   except Exception as e:fails.append(f'{width}:exception:{type(e).__name__}:{str(e)[:180]}')
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':fails,'mode':'actual application JS, synthetic in-memory storage; not native IndexedDB'}
(OUT/'round184-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fails:raise SystemExit(1)
