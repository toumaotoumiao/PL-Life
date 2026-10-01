#!/usr/bin/env python3
"""PC nested-array and card-time preservation in actual app JS, synthetic isolated memory.

This is NOT a native IndexedDB / complete ZIP test; Round187 remains mandatory.
All records and URLs used here are entirely fictional.
"""
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round188-evidence'
OUT.mkdir(parents=True,exist_ok=True)
source=Path(os.environ.get('PL_STAGE42_HTML',str(ROOT/'index.html')))
html=source.read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def inline(m):return '<script>\n'+re.sub(r'</script','<\\/script',(ROOT/m.group(1)).read_text(),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',inline,html,flags=re.I)
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
    page.wait_for_function("typeof settings !== 'undefined' && typeof profiles !== 'undefined' && Array.isArray(profiles)",timeout=30000)
    result=page.evaluate(r'''()=>{
      const owners=new Set(profiles.map(x=>String(x.id))),owner=selfProfileId();
      const poisonous=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"danger":true},"prototype":{"bad":true}}');
      const wrapped=x=>({...x,...poisonous});
      const fixture={id:'round188-pc',ownerPlId:owner,name:'  合成 PC  ',
       ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',confirmed:true},
       cardTime:wrapped({year:' 1999 ',month:' 12 ',day:'',time:'',futureCalendar:{precision:['year',0,false,'']}}),
       skills:[wrapped({id:'skill-1',name:'  观察  ',value:65,note:' 原备注 ',futureSkill:{changes:[0,false,'']}}),
               {id:'skill-dup',name:'观察',value:20,futureSkill:{duplicate:'filtered'}},
               {id:'skill-invalid',name:'',value:'',futureSkill:{invalid:'filtered'}}],
       weapons:[wrapped({id:'weapon-1',name:'  道具  ',skill:'',damage:'1d3',attacks:'1',futureWeapon:{flags:[0,false,'']}}),
                {id:'weapon-invalid',name:'',skill:'',damage:'',futureWeapon:{invalid:'filtered'}}],
       excelEdits:[wrapped({sheet:'人物卡',ref:'B19',value:false,futureCell:{rawType:'boolean',flags:[0,false,'']}}),
                   {sheet:'人物卡',ref:'?',value:'invalid',futureCell:{invalid:'filtered'}}],
       snapshots:[wrapped({id:'snap-1',runRecordId:'r188-record',hp:6,san:43,note:'  当场变化  ',createdAt:100,updatedAt:101,futureSnapshot:{metadata:[0,false,'']}}),
                  {id:'snap-2',runRecordId:'r188-record',hp:1,futureSnapshot:{duplicate:'filtered'}}],
       futureTop:{preserve:false}};
      const before=JSON.stringify(fixture);
      const pc=normalizePcArchive(fixture,owners),second=normalizePcArchive(pc,owners);
      const safe=x=>!Object.prototype.hasOwnProperty.call(x,'__proto__')&&!Object.prototype.hasOwnProperty.call(x,'constructor')&&!Object.prototype.hasOwnProperty.call(x,'prototype');
      const fields=x=>x&&x.cardTime?.futureCalendar?.precision?.[2]===false&&x.skills?.[0]?.futureSkill?.changes?.[0]===0&&x.weapons?.[0]?.futureWeapon?.flags?.[1]===false&&x.excelEdits?.[0]?.futureCell?.rawType==='boolean'&&x.snapshots?.[0]?.futureSnapshot?.metadata?.[2]==='';
      pcs.push(second);second.name='已编辑合成 PC';second.skills[0].value=72;
      const saved=saveState(),savedRaw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      const persisted=savedRaw?.data?.pcs?.find(x=>x.id==='round188-pc');
      const live=ensureSelfProfileAndLinks(hydrateCanonicalArchive(savedRaw));
      const loaded=live.pcs.find(x=>x.id==='round188-pc');
      const roundtrip=loaded?normalizePcArchive(loaded,new Set(live.profiles.map(x=>String(x.id)))):null;
      const evidence=completeBackupRuleEvidence(live),tampered=clone(live);
      const target=tampered.pcs.find(x=>x.id==='round188-pc');if(target)delete target.snapshots[0].futureSnapshot;
      return {
        sourceUnchanged:JSON.stringify(fixture)===before,
        knownName:pc.name==='合成 PC',knownSkillName:pc.skills[0].name==='观察',
        knownSkillValue:pc.skills[0].value===65,knownSnapshotNote:pc.snapshots[0].note==='当场变化',
        knownCardTime:pc.cardTime.year==='1999',knownCellBoolean:pc.excelEdits[0].value===false,
        duplicateSkillFiltered:pc.skills.length===1,blankWeaponFiltered:pc.weapons.length===1,
        invalidCellFiltered:pc.excelEdits.length===1,duplicateSnapshotFiltered:pc.snapshots.length===1,
        inputSafe:({}).polluted===undefined,safeRows:safe(pc.cardTime)&&safe(pc.skills[0])&&safe(pc.weapons[0])&&safe(pc.excelEdits[0])&&safe(pc.snapshots[0]),
        normalizedNested:fields(pc),secondNormalized:fields(second),
        saved:!!saved,persisted:fields(persisted),reloaded:fields(loaded),againNormalized:fields(roundtrip),
        editedKnown:loaded?.name==='已编辑合成 PC'&&loaded?.skills?.[0]?.value===72,
        futureTop:loaded?.futureTop?.preserve===false,detectNestedLoss:evidence!==completeBackupRuleEvidence(tampered),
        noShadowPollution:!Object.prototype.hasOwnProperty.call(persisted||{},'profileFutureCanonicalParts')
      };
    }''')
    for key,value in result.items():
     checks.append((f'{width}:{key}',bool(value)))
     if not value:fails.append(f'{width}:{key}')
    if width in (375,1280):page.screenshot(path=str(OUT/f'pc-nested-{width}.png'),full_page=True)
   except Exception as e:fails.append(f'{width}:exception:{type(e).__name__}:{str(e)[:450]}')
   finally:page.close()
 finally:browser.close()
report={'stage':'Stage42 / Round188','checks':len(checks),'passed':sum(v for _,v in checks),'failed':fails,'scope':'actual application JS in isolated synthetic in-memory storage; NOT native IndexedDB / full ZIP / real device'}
(OUT/'round188-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fails:raise SystemExit(1)
