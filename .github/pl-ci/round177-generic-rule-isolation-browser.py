#!/usr/bin/env python3
"""Stage31 isolated Chromium: actual rule-sheet/parser/editor and rule-menu handler with synthetic PC. No private files, no native storage E2E."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round177-evidence'
OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){'),part("document.getElementById('pcRuleMenu')?.addEventListener('change'","els.closeModuleAdvanced.addEventListener")])
css='''*{box-sizing:border-box}html,body{margin:0;max-width:100%;font:14px system-ui;background:var(--page,#f7f6f4);color:var(--ink,#252525)}body{padding:8px}main{max-width:880px;margin:auto}.pc-form-section{background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:14px;padding:12px}.pc-form-grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pc-generic-rule-group{margin:12px 0}.pc-generic-rule-row{min-width:0;border:1px solid var(--line,#ddd);border-radius:10px;padding:8px;display:flex;flex-wrap:wrap;gap:6px}.pc-generic-rule-row input{width:100%;min-width:0;min-height:44px}.pc-rule-row-actions{display:flex;gap:4px;width:100%}.pc-rule-row-actions button{min-height:44px}.pc-rule-public-detail{width:100%}.pc-rule-public-detail textarea{width:100%}.pc-generic-rule-group header{display:flex;justify-content:space-between;gap:8px}button,select,input{font:inherit}#pcRuleMenu{display:flex;flex-wrap:wrap;gap:8px;padding:10px}#pcRuleMenu input,#pcRuleMenu select{min-height:44px;max-width:100%}@media(max-width:600px){.pc-form-grid.two{grid-template-columns:1fr}}'''
fixture={'id':'STAGE31-VIRTUAL','name':'虚构规则 PC','ruleMeta':{'familyId':'other','systemId':'custom','editionId':'','customName':'规则甲','customEdition':'','confirmed':True,'source':'user-selected'},'ruleData':{'traits':[{'label':'','value':'历史内容','detail':'旧公开说明','future':{'id':901}}],'skills':[],'resources':[],'extension':{'untouched':1}},'ruleSheets':{'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[],'resources':[]},'future-version':{'keep':1}},'coc':{'san':50},'excelEdits':[{'sheet':'角色卡','ref':'A1','value':'原样保留'}]}
setup=r'''
function clone(x){return structuredClone(x)}
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function moduleRuleDisplay(m){return m?.customName||m?.systemId||'未指定规则';}
function normalizeModuleRuleMeta(m){return {...m,confirmed:true};}
const els={pcEditorBody:document.getElementById('editor')};let pcDraft;
function renderPcEditor(){els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);}
function updatePcEditorSaveState(){}
function syncPcExcelExportUi(){}
let pcDndDraftImportReview=null;
els.pcEditorBody.addEventListener('input',e=>{const field=e.target.dataset.pcGenericField;if(!field)return;const row=e.target.closest('[data-pc-generic-row]'),key=row?.dataset.pcGenericRow,i=Number(row?.dataset.pcGenericIndex);pcRuleEditableData(pcDraft)[key][i][field]=e.target.value;});
'''
checks=[]
def check(name,yes):
 checks.append((name,bool(yes)))
 if not yes:raise AssertionError(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for width in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':width,'height':900})
   page.set_content('<style>'+css+'</style><main><div id="pcRuleMenu"><select data-pc-rule-system><option value="custom">自定义规则</option><option value="other">其他规则</option></select><input data-pc-rule-custom-name value="规则甲"></div><div id="pcRuleSummary"></div><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';renderPcEditor();')
   result=page.evaluate('''()=>{
    const el=()=>document.getElementById('editor');const old=JSON.stringify(pcDraft.ruleData);
    const row=el().querySelector('[data-pc-generic-field="value"]');row.value='甲的修改';row.dispatchEvent(new Event('input',{bubbles:true}));
    const oldNow=JSON.stringify(pcDraft.ruleData)===old;
    const ruleName=document.querySelector('[data-pc-rule-custom-name]');ruleName.value='规则乙';ruleName.dispatchEvent(new Event('input',{bubbles:true}));
    const renamed=pcRuleCurrentData(pcDraft).traits[0].value==='甲的修改';
    const system=document.querySelector('[data-pc-rule-system]');system.value='other';system.dispatchEvent(new Event('change',{bubbles:true}));
    const otherEmpty=pcRuleCurrentData(pcDraft).traits.length===0;const oldAccessible=el().textContent.includes('历史内容')&&el().textContent.includes('原有通用规则数据');
    pcRuleEditableData(pcDraft).skills.push({label:'其他规则技能',value:'42'});renderPcEditor();
    system.value='custom';system.dispatchEvent(new Event('change',{bubbles:true}));
    const chosen=pcRuleSavedGenericOptions(pcDraft).find(option=>option.meta.customName==='规则乙');
    const explicitlySwitched=Boolean(chosen&&pcRuleSwitchToSavedScope(pcDraft,chosen.key));renderPcEditor();
    const restored=pcRuleCurrentData(pcDraft).traits[0].value==='甲的修改';
    const preserved=JSON.stringify(pcDraft.ruleData)===old&&pcDraft.coc.san===50&&pcDraft.excelEdits[0].value==='原样保留'&&pcDraft.ruleSheets['future-version'].keep===1;
    const data=JSON.stringify(pcDraft),readback=JSON.parse(data);readback.ruleSheets=normalizePcRuleSheets(readback.ruleSheets);const same=JSON.stringify(readback.ruleSheets)===JSON.stringify(pcDraft.ruleSheets);
    readback.ruleMeta.systemId='other';readback.ruleMeta.customName='';const otherBack=pcRuleCurrentData(readback).skills[0].value==='42';
    return {explicitlySwitched,oldNow,renamed,otherEmpty,oldAccessible,restored,preserved,same,otherBack,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,editorRows:el().querySelectorAll('.pc-generic-rule-row').length,controlHeight:Math.min(...[...document.querySelectorAll('#pcRuleMenu input,#pcRuleMenu select')].map(x=>x.getBoundingClientRect().height)),legacySafe:pcDraft.ruleData.traits[0].future.id===901};
   }''')
   for k,v in {'legacy-original-unchanged':result['oldNow'],'rename-preserves-current-sheet':result['renamed'],'new-rule-starts-empty':result['otherEmpty'],'legacy-can-be-read-and-copied':result['oldAccessible'],'explicit-switch':result['explicitlySwitched'],'switch-back-restores':result['restored'],'other-data-preserved':result['preserved'],'serialized-and-normalized':result['same'],'second-rule-survives-reload':result['otherBack'],'no-horizontal-overflow':result['noOverflow'],'fields-are-present':result['editorRows']>=1,'rule-controls-44px':result['controlHeight']>=44,'future-row-extension':result['legacySafe']}.items():check(f'{width}:{k}',v)
   if width in (320,375,1280):page.screenshot(path=str(OUT/f'generic-rule-{width}.png'),full_page=True)
   page.close()
  for theme,colors in [('mist',('#f7f6f4','#fff','#ddd','#252525')),('tomato',('#fff1ef','#fffafa','#e9c9c5','#4c2525')),('night',('#282435','#332c44','#665878','#f2eafa'))]:
   page=browser.new_page(viewport={'width':375,'height':900});page.set_content('<style>'+css+'</style><main id="editor"></main>')
   page.add_script_tag(content=setup.replace("const els={pcEditorBody:document.getElementById('editor')};","const els={pcEditorBody:document.getElementById('editor')};")+'\n'+part('function normalizePcRuleData(','function normalizePcArchive(')+'\n'+part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){')+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';renderPcEditor();')
   page.evaluate('''([page,surface,line,ink])=>{document.documentElement.style.setProperty('--page',page);document.documentElement.style.setProperty('--surface',surface);document.documentElement.style.setProperty('--line',line);document.documentElement.style.setProperty('--ink',ink);}''',list(colors))
   check(theme+':visible',page.locator('.pc-generic-rule-row').count()>=1)
   check(theme+':no-overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   page.screenshot(path=str(OUT/f'generic-rule-{theme}-375.png'),full_page=True);page.close()
 finally:browser.close()
result={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':[k for k,v in checks if not v],'mode':'actual source parser/rule-menu/editor in synthetic memory; not native IndexedDB or actual full-site UI'}
(OUT/'round177-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf8');print(json.dumps(result,ensure_ascii=False))
