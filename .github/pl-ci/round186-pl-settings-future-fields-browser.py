#!/usr/bin/env python3
"""Stage40 PL/settings daily save and canonical roundtrip: synthetic in-memory actual application, not native IndexedDB."""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round186-evidence';OUT.mkdir(parents=True,exist_ok=True)
source=Path(os.environ.get('PL_ROUND186_HTML',str(ROOT/'index.html')))
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
    page.wait_for_function("typeof settings !== 'undefined' && typeof profiles !== 'undefined' && Array.isArray(profiles)",timeout=20000)
    result=page.evaluate('''()=>{
      const intro={...defaultSelfIntro(),futureIntro:{notes:['保留',0,false]},timeSlots:['上午'],timeRanges:{上午:{start:'08:00',end:'12:00',futureRange:{tz:'Asia/Shanghai'}}},
        weeklyAvailability:{days:{},halfHourDays:{},granularity:'hour',futureAvailability:{type:'future'}},
        pl:{...defaultSelfIntro().pl,modulePrefs:{...defaultIntroModulePrefs(),futurePref:{arc:'custom'}},boundaries:{futureBoundary:'special'},wantModules:[{moduleId:'m-future',name:'模组',note:'想跑',futureLink:{chapter:1}}],futurePL:{series:[1,2]}},
        kp:{...defaultSelfIntro().kp,interaction:{...defaultSelfIntro().kp.interaction,futureInteraction:{kind:'future'}},aftercare:{...defaultSelfIntro().kp.aftercare,futureAftercare:{keep:true}},futureKP:{flags:[false,'']}}};
      const introOriginal=JSON.stringify(intro),profileCanonical={id:'r186-pl',systemRole:'',identity:{name:'合成 PL',publicName:'公开名',contact:'仅测试',futureIdentity:{avatar:'future'}},
        trpg:{startDate:'2025-03-01',rpLength:{usual:'90',min:'40',max:'120',futureUnit:'minutes'},futureTrpg:{level:2}},
        ratings:{futureRating:{score:5,note:'观察',futureEvidence:{version:3}},custom_for_removal:{score:3,note:'用户将主动移除'}},blacklist:{active:true,reason:'测试',history:[{addedAt:100,reason:'已记录',futureLog:'long-term'}],futureBlacklist:{origin:'app'}},
        selfIntro:intro,createdAt:1000,updatedAt:2000,futurePLRecord:{flags:[0,false,'']}};
      const oldText=JSON.stringify(profileCanonical);
      const rawSetting={...clone(settings),futureSettings:{flag:false,zero:0},ui:{...settings.ui,futureUi:{density:'future'}},
        moduleArchive:{...settings.moduleArchive,futureArchive:{tag:'keep'},ratingSystems:[{id:'general',name:'通用',futureSystem:'v3',criteria:[{id:'c1',name:'叙事',weight:100,desc:'旧',futureCriterion:{note:'keep'}}]}]},
        fields:[...settings.fields.map((f,i)=>i===0?{...f,futureField:{type:'extension'}}:f),{key:'custom_for_removal',label:'旧自定义评分',labels:[...genericLabels],includeInTotal:false,weight:0,builtin:false}],
        scheduleBatches:[{id:'round186-batch',mode:'slots',sourceLabel:'合成排期',generated:[{planId:'r186-p',slotId:'r186-s',date:'2026-09-28',futureGenerated:{tz:8}}],futureBatch:{hint:'keep'}}]};
      const injected=JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":"bad","prototype":"bad"}');
      const st=normalizeSettings({...rawSetting,...injected});
      const p=runtimeProfileFromCanonical({...profileCanonical,...injected},st);
      const introOk=x=>x?.futureIntro?.notes?.[1]===0&&x?.timeRanges?.上午?.futureRange?.tz==='Asia/Shanghai'&&x?.weeklyAvailability?.futureAvailability?.type==='future'&&x?.pl?.futurePL?.series?.[1]===2&&x?.pl?.modulePrefs?.futurePref?.arc==='custom'&&x?.pl?.wantModules?.[0]?.futureLink?.chapter===1&&x?.kp?.interaction?.futureInteraction?.kind==='future'&&x?.kp?.aftercare?.futureAftercare?.keep===true&&x?.kp?.futureKP?.flags?.[0]===false;
      const settingOk=x=>x?.futureSettings?.zero===0&&x?.ui?.futureUi?.density==='future'&&x?.moduleArchive?.futureArchive?.tag==='keep'&&x?.moduleArchive?.ratingSystems?.[0]?.futureSystem==='v3'&&x?.moduleArchive?.ratingSystems?.[0]?.criteria?.[0]?.futureCriterion?.note==='keep'&&x?.fields?.[0]?.futureField?.type==='extension'&&x?.scheduleBatches?.[0]?.futureBatch?.hint==='keep'&&x?.scheduleBatches?.[0]?.generated?.[0]?.futureGenerated?.tz===8;
      const canonOk=x=>x?.futurePLRecord?.flags?.[1]===false&&x?.identity?.futureIdentity?.avatar==='future'&&x?.trpg?.futureTrpg?.level===2&&x?.trpg?.rpLength?.futureUnit==='minutes'&&x?.ratings?.futureRating?.futureEvidence?.version===3&&x?.blacklist?.futureBlacklist?.origin==='app'&&x?.blacklist?.history?.[0]?.futureLog==='long-term'&&introOk(x.selfIntro);
      const pKnown=p.name==='合成 PL'&&p.scores.futureRating===5&&p.notes.futureRating==='观察';
      const first=canonicalProfileFromRuntime(p),reloaded=runtimeProfileFromCanonical(first,st),second=canonicalProfileFromRuntime(reloaded);
      const rawNoMutation=JSON.stringify(intro)===introOriginal&&JSON.stringify(profileCanonical)===oldText;
      const noPollution=!Object.prototype.hasOwnProperty.call(p,'__proto__')&&!Object.prototype.hasOwnProperty.call(first,'constructor')&&!Object.prototype.hasOwnProperty.call(st,'prototype')&&({}).polluted===undefined;
      settings=st;p.contact='编辑后联系方式';profiles.push(p);
      const saved=saveState(),savedRaw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      const loaded=ensureSelfProfileAndLinks(hydrateCanonicalArchive(savedRaw)),lp=loaded.profiles.find(x=>x.id==='r186-pl'),cp=lp?canonicalProfileFromRuntime(lp):null;
      const lossEvidence=completeBackupRuleEvidence(loaded),broken=clone(loaded);
      if(broken.profiles.find(x=>x.id==='r186-pl'))delete broken.profiles.find(x=>x.id==='r186-pl').futurePLRecord;
      const defMissing=normalizeSettings({fields:null,futureOnEmpty:'keep'}).futureOnEmpty==='keep';
      const injectionIntro=normalizeSelfIntro({...intro,...injected});
      settings=loaded.settings;profiles=loaded.profiles;openSettings();
      const editorLoaded=settingOk(settingsDraft);if(settingsDraft){settingsDraft.profileLayout='compact';settingsDraft.fields=settingsDraft.fields.filter(x=>x.key!=='custom_for_removal');}
      saveSettings();const afterUiSave=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      const uiSaved=settingsDraft===null&&afterUiSave?.settings?.profileLayout==='compact'&&settingOk(afterUiSave.settings);
      const uiPl=afterUiSave?.data?.profiles?.find(x=>x.id==='r186-pl');
      return {editorLoaded,uiSaved,uiPlPreserved:canonOk(uiPl),removedSelectedField:!!uiPl&&!Object.prototype.hasOwnProperty.call(uiPl.ratings,'custom_for_removal'),originalUnchanged:rawNoMutation,prototypeSafe:noPollution,knownNormalized:pKnown,
        settingsNormalized:settingOk(st),introNormalized:introOk(p.selfIntro),canonicalFirst:canonOk(first),runtimeRoundtrip:introOk(reloaded.selfIntro)&&reloaded.profileFutureCanonicalParts?.identity?.futureIdentity?.avatar==='future',canonicalSecond:canonOk(second),
        cleanCanonical:!Object.prototype.hasOwnProperty.call(first,'profileFutureCanonicalParts')&&!Object.prototype.hasOwnProperty.call(first,'scores'),
        saved:!!saved,settingsPersisted:settingOk(savedRaw?.settings),profilePersisted:canonOk(savedRaw?.data?.profiles?.find(x=>x.id==='r186-pl')),
        loadedSettings:settingOk(loaded.settings),loadedProfile:!!lp&&lp.futurePLRecord?.flags?.[2]==='',loadedIntro:!!lp&&introOk(lp.selfIntro),reexportPreserved:canonOk(cp),editedKnown:lp?.contact==='编辑后联系方式',
        detectLoss:lossEvidence!==completeBackupRuleEvidence(broken),missingFieldsSettings:defMissing,
        safeIntro:!Object.prototype.hasOwnProperty.call(injectionIntro,'__proto__')&&!Object.prototype.hasOwnProperty.call(injectionIntro,'constructor'),
        legacyKnownValidation:normalizeSettings({...rawSetting,sortMode:'rpAmount_desc'}).sortMode==='total_desc'
      };
    }''')
    for key,value in result.items():
     checks.append((f'{width}:{key}',bool(value)))
     if not value:fails.append(f'{width}:{key}')
    if width in (375,1280):
     page.screenshot(path=str(OUT/f'pl-settings-{width}.png'),full_page=True)
   except Exception as e:fails.append(f'{width}:exception:{type(e).__name__}:{str(e)[:360]}')
   finally:page.close()
 finally:browser.close()
report={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':fails,'mode':'actual-app JS with synthetic in-memory storage; native IndexedDB/real ZIP not asserted'}
(OUT/'round186-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False))
if fails:raise SystemExit(1)
