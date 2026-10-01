#!/usr/bin/env python3
"""Synthetic actual app JS test for PC future-extension survival; no real user storage."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round183-evidence'
OUT.mkdir(parents=True,exist_ok=True)
source=Path(os.environ.get('PL_STAGE37_HTML',str(ROOT/'index.html')))
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
       const me=selfProfileId(), owners=new Set(profiles.map(p=>String(p.id)));
       const original=JSON.parse(JSON.stringify({id:'round183-pc',name:'  合成 PC  ',ownerPlId:me,
          ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',editionId:'',confirmed:true,source:'user-selected',futureRule:{editionSource:'kept'}},
          ruleSheets:{insane:{traits:[{label:'生命力',value:'6',detail:'不应丢失',futureRow:{original:42}}],skills:[],resources:[]},futureEdition:{sheet:true}},
          ruleData:{traits:[{label:'历史属性',value:'旧值'}],skills:[],resources:[]},
          coc:{san:42,futureCoc:{original:true}},background:{appearance:'合成资料',futureBackground:{lines:['A','B']}},
          excelEdits:[{sheet:'导入差异',ref:'B2',value:'保留原值'}],excelSource:{kind:'fixed',fileName:'synthetic.xlsx',futureWorkbook:{checksum:'fake'}},
          importSource:{type:'excel',fileName:'synthetic.xlsx',futureImporter:{version:99}},
          importReports:[{fileName:'synthetic.xlsx',at:1,changes:['保留'],futureReport:{detail:'keep'}}],
          futurePcField:{deep:[{identity:'preserve',values:[0,false,'']}]} }));
       const injected=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"bad":true}}');
       const raw={...original,...injected};
       const stable=JSON.stringify(raw);
       const normalized=normalizePcArchive(raw,owners),again=normalizePcArchive(normalized,owners);
       const stableRaw=JSON.stringify(raw)===stable,invalidOwnerSafe=normalizePcArchive({...original,ownerPlId:'foreign'},owners).ownerPlId==='';
       pcs.push(again);again.name='已编辑 PC';
       const saved=saveState();
       const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
       const rehydrated=ensureSelfProfileAndLinks(hydrateCanonicalArchive(persisted));
       const pc=rehydrated.pcs.find(x=>x.id==='round183-pc');
       const keys=['futurePcField','ruleMeta','ruleSheets','coc','background','excelSource','importSource','importReports'];
       const compare=pc&&Object.fromEntries(keys.map(k=>[k,JSON.stringify(pc[k])===JSON.stringify(again[k])]));
       const sourceEvidence=completeBackupRuleEvidence({settings:rehydrated.settings,profiles:rehydrated.profiles,pcs:rehydrated.pcs,modules:rehydrated.modules,runPlans:rehydrated.runPlans,runRecords:rehydrated.runRecords});
       const reconstructed=JSON.parse(JSON.stringify(rehydrated)),changed=reconstructed.pcs.find(x=>x.id==='round183-pc');delete changed.futurePcField;
       const detectsLoss=sourceEvidence!==completeBackupRuleEvidence(reconstructed);
       return {stableRaw,invalidOwnerSafe,notPolluted:!Object.prototype.hasOwnProperty.call(normalized,'__proto__')&&!Object.prototype.hasOwnProperty.call(normalized,'constructor')&&({}).polluted===undefined,
         knownNormalized:normalized.name==='合成 PC',saved:Boolean(saved),present:Boolean(pc),future:JSON.stringify(pc?.futurePcField)===JSON.stringify(original.futurePcField),
         futureRule:JSON.stringify(pc?.ruleMeta?.futureRule)===JSON.stringify(original.ruleMeta.futureRule),
         futureSheet:JSON.stringify(pc?.ruleSheets?.futureEdition)===JSON.stringify(original.ruleSheets.futureEdition),
         futureCoc:JSON.stringify(pc?.coc?.futureCoc)===JSON.stringify(original.coc.futureCoc),
         futureBackground:JSON.stringify(pc?.background?.futureBackground)===JSON.stringify(original.background.futureBackground),
         futureWorkbook:JSON.stringify(pc?.excelSource?.futureWorkbook)===JSON.stringify(original.excelSource.futureWorkbook),
         futureImporter:JSON.stringify(pc?.importSource?.futureImporter)===JSON.stringify(original.importSource.futureImporter),
         futureReport:JSON.stringify(pc?.importReports?.[0]?.futureReport)===JSON.stringify(original.importReports[0].futureReport),
         originalExcel:pc?.excelEdits?.[0]?.value==='保留原值',ruleData:pc?.ruleData?.traits?.[0]?.value==='旧值',compareAll:Boolean(compare)&&Object.values(compare).every(Boolean),detectsLoss};
    }''')
    for key,value in result.items():
     checks.append((f'{width}:{key}',bool(value)))
     if not value:fails.append(f'{width}:{key}')
   except Exception as e:
    fails.append(f'{width}:exception:{type(e).__name__}:{str(e)[:160]}')
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':fails,'mode':'actual app JS, synthetic memory storage; native persistence not tested'}
(OUT/'round183-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fails:raise SystemExit(1)
