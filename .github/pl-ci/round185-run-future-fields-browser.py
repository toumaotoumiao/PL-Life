#!/usr/bin/env python3
"""Synthetic actual-app plan/record future-field roundtrip; native IndexedDB remains a separate gate."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round185-evidence';OUT.mkdir(parents=True,exist_ok=True)
html=Path(os.environ.get('PL_ROUND185_HTML',str(ROOT/'index.html'))).read_text('utf8')
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
      const owner=selfProfileId(), valid=new Set(profiles.map(p=>p.id));modules.push(normalizeRichModule({id:'r185-m',name:'测试模组'},settings.moduleArchive));
      const base={id:'r185-p',moduleId:'r185-m',moduleName:'测试模组',tableName:'测试桌',kp:'合成主持人',plIds:[owner],
        ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',confirmed:true,futureRule:{edition:'beta'}},
        participantAssignments:[{plId:owner,pcName:'虚构调查员',hoMode:'custom',hoCustom:'H1',futureSeat:{notes:['甲','乙']}}],
        kpc:{enabled:true,pcName:'虚构 KPC',futureKpc:{kind:'assistant'}},
        futureRun:{flags:[false,0,''],notes:{custom:'未改动'}},futureEmpty:'',futureZero:0,runFutureCanonicalParts:{kp:{futureKp:{staff:'archive'}},dateRange:{futureDate:{timezone:'Asia/Shanghai'}},experience:{futureExperience:{flags:[0,false,'']}}}};
      const slot={id:'r185-slot',date:'2026-09-28',daypart:'evening',order:0,startTime:'19:00',endTime:'21:00',futureSlot:{timezone:'UTC+8'}};
      const sourcePlan={...base,timeSlots:[slot],postRunDraft:{sideRole:'kp',thoughts:'虚构后记',futureDraft:{chapter:1}}};
      const sourceRecord={...base,id:'r185-r',sessionSlots:[slot],thoughts:'回顾正文',runNotes:'记录备注',archivedAt:1720000000000};
      const protect=x=>JSON.stringify(x?.futureRun)===JSON.stringify(base.futureRun)&&x?.futureEmpty===''&&x?.futureZero===0;
      const fields=x=>x?.ruleMeta?.futureRule?.edition==='beta'&&x?.participantAssignments?.[0]?.futureSeat?.notes?.[1]==='乙'&&x?.kpc?.futureKpc?.kind==='assistant';
      const slotOk=x=>x?.futureSlot?.timezone==='UTC+8';
      const nestedOk=x=>x?.kp?.futureKp?.staff==='archive'&&x?.dateRange?.futureDate?.timezone==='Asia/Shanghai'&&x?.experience?.futureExperience?.flags?.[1]===false;
      const runtimeNested=x=>x?.runFutureCanonicalParts?.kp?.futureKp?.staff==='archive'&&x?.runFutureCanonicalParts?.dateRange?.futureDate?.timezone==='Asia/Shanghai'&&x?.runFutureCanonicalParts?.experience?.futureExperience?.flags?.[2]==='';
      const noPollution=(()=>{const injection=JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad"}');const x=normalizeRunPlan({...sourcePlan,...injection},valid);return !Object.prototype.hasOwnProperty.call(x,'__proto__')&&!Object.prototype.hasOwnProperty.call(x,'constructor')&&!Object.prototype.hasOwnProperty.call(x,'prototype')&&({}).polluted===undefined;})();
      const p=normalizeRunPlan(sourcePlan,valid),r=normalizeRunRecord(sourceRecord,valid);
      const cp=canonicalRunFromRuntime(p,'planned',''),cr=canonicalRunFromRuntime(r,'completed','');
      const sourceStable=JSON.stringify(sourcePlan.futureRun)===JSON.stringify(base.futureRun);
      p.tableName='编辑后的计划';r.tableName='编辑后的记录';runPlans.push(p);runRecords.push(r);
      const saved=saveState(),raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!isCanonicalArchive(raw))throw new Error("invalid-save:"+JSON.stringify({saved,raw,keys:Object.keys(localStorage),id:STORAGE_KEY}).slice(0,1200));
      const loaded=ensureSelfProfileAndLinks(hydrateCanonicalArchive(raw)),fp=loaded.runPlans.find(x=>x.id===p.id),fr=loaded.runRecords.find(x=>x.id===r.id);
      const second=[...loaded.runPlans.map(x=>canonicalRunFromRuntime(x,'planned',x.moduleId)),...loaded.runRecords.map(x=>canonicalRunFromRuntime(x,'completed',x.moduleId))];
      const resavePlan=second.find(x=>x.id===p.id),resaveRecord=second.find(x=>x.id===r.id);
      const evidence=completeBackupRuleEvidence(loaded),broken=clone(loaded);delete broken.runPlans.find(x=>x.id===p.id).futureRun;
      return {owner:!!owner,sourceStable,noPollution,
        normalizedPlan:protect(p),normalizedRecord:protect(r),canonicalPlan:protect(cp),canonicalRecord:protect(cr),
        normalizedChildren:fields(p)&&fields(r)&&slotOk(p.timeSlots[0])&&slotOk(r.sessionSlots[0]),
        canonicalChildren:fields(cp)&&fields(cr)&&slotOk(cp.schedule[0])&&slotOk(cr.schedule[0]),
        canonicalNested:nestedOk(cp)&&nestedOk(cr)&&cp.experience?.futureDraft?.chapter===1,canonicalShadowAbsent:!Object.prototype.hasOwnProperty.call(cp,'runFutureCanonicalParts'),
        saved:!!saved,persisted:!!raw,loadedPlan:protect(fp),loadedRecord:protect(fr),
        loadedChildren:fields(fp)&&fields(fr)&&slotOk(fp.timeSlots[0])&&slotOk(fr.sessionSlots[0]),
        loadedNested:runtimeNested(fp)&&runtimeNested(fr),
        secondPlan:protect(resavePlan),secondRecord:protect(resaveRecord),
        secondChildren:fields(resavePlan)&&fields(resaveRecord)&&slotOk(resavePlan.schedule[0])&&slotOk(resaveRecord.schedule[0]),
        secondNested:nestedOk(resavePlan)&&nestedOk(resaveRecord)&&resavePlan.experience?.futureDraft?.chapter===1,
        editing:fp?.tableName==='编辑后的计划'&&fr?.tableName==='编辑后的记录',
        plannedStatus:resavePlan?.status==='planned',completedStatus:resaveRecord?.status==='completed',
        originalLog:fr?.runNotes==='记录备注',snapshotIsolation:cp.ruleMeta?.systemId==='insane',detectLoss:evidence!==completeBackupRuleEvidence(broken)};
    }''')
    for key,value in result.items():
     checks.append((f'{width}:{key}',bool(value)))
     if not value:fails.append(f'{width}:{key}')
   except Exception as e:fails.append(f'{width}:exception:{type(e).__name__}:{str(e)[:260]}')
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':fails,'mode':'actual application JS with synthetic in-memory storage, not native IndexedDB'}
(OUT/'round185-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fails:raise SystemExit(1)
