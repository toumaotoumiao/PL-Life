#!/usr/bin/env python3
"""Isolated real Chromium exercising production rule-store, selector and menu events on fictional PCs."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=(ROOT/'index.html').read_text('utf8')
OUT=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(ROOT/'.github/pl-ci')))/'round178-evidence'
OUT.mkdir(parents=True,exist_ok=True)
def part(a,b):
 i=SRC.index(a);j=SRC.index(b,i);assert j>i,(a,b);return SRC[i:j]
logic='\n'.join([part('function normalizePcRuleData(','function normalizePcArchive('),part('function pcGenericRuleEditorHTML(pc){','function pcProfileEditorHTML(pc){'),part("document.getElementById('pcRuleMenu')?.addEventListener('change'",'els.closeModuleAdvanced.addEventListener')])
fixture={'id':'synthetic-stage32-A','name':'虚构 PC','ruleMeta':{'familyId':'other','systemId':'custom','editionId':'','customName':'规则甲','customEdition':'初版','confirmed':True,'source':'user-selected'},'ruleData':{'traits':[{'label':'旧属性','value':'历史原件','extra':{'keep':True}}],'skills':[],'resources':[]},'ruleSheets':{'future-version':{'note':'must-stay'},'insane':{'traits':[{'label':'生命力','value':'6'}],'skills':[],'resources':[]}},'coc':{'san':51},'excelEdits':[{'sheet':'虚构表','ref':'B7','value':'不可修改'}]}
css='''*{box-sizing:border-box}html,body{margin:0;width:100%;max-width:100%;font:14px system-ui;background:var(--page,#f8f6f3);color:var(--ink,#292929)}main{max-width:960px;margin:auto;padding:12px}button,input,select{font:inherit;min-height:44px;max-width:100%}.menu{padding:12px;background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:12px}.pc-rule-existing-scope{display:grid;gap:5px}.pc-rule-scope-notice{padding:9px;border:1px solid var(--line,#ddd);border-radius:8px}.pc-form-section{padding:12px;border:1px solid var(--line,#ddd);background:var(--surface,#fff);border-radius:12px;margin-top:10px}.pc-form-grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pc-generic-rule-row{min-width:0;border:1px solid var(--line,#ddd);border-radius:8px;padding:8px;display:flex;flex-wrap:wrap;gap:7px}.pc-generic-rule-row input{width:100%}.pc-rule-row-actions{display:flex;gap:5px}.pc-generic-rule-group header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px}textarea{max-width:100%}@media(max-width:600px){.pc-form-grid.two{grid-template-columns:1fr}}'''
setup=r'''
function clone(x){return structuredClone(x)}
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function moduleRuleDisplay(m){return m?.customName||m?.systemId||'规则未指定'}
function normalizeModuleRuleMeta(m){return {...m,confirmed:true}}
const els={pcEditorBody:document.getElementById('editor')};let pcDraft;
function renderPcEditor(){
 const popover=document.getElementById('pcRulePopover');const saved=pcRuleSavedGenericOptions(pcDraft);
 popover.innerHTML=`<input data-pc-rule-custom-name aria-label="规则名称" value="${escapeHTML(pcDraft.ruleMeta.customName||'')}"><input data-pc-rule-custom-edition aria-label="规则版次" value="${escapeHTML(pcDraft.ruleMeta.customEdition||'')}">${saved.length?`<label class="pc-rule-existing-scope">切换已有规则<select data-pc-rule-existing-scope aria-label="切换已有规则"><option value="">选择已保存的规则</option>${saved.map(option=>`<option value="${escapeHTML(option.key)}">${escapeHTML(option.label)}</option>`).join('')}</select></label>`:''}`;
 document.getElementById('pcRuleSummary').textContent=moduleRuleDisplay(pcDraft.ruleMeta);
 els.pcEditorBody.innerHTML=pcGenericRuleEditorHTML(pcDraft);
}
function updatePcEditorSaveState(){}
function syncPcExcelExportUi(){}
let pcDndDraftImportReview=null;
'''
checks=[]
def check(name,yes):
 checks.append((name,bool(yes)))
 if not yes:raise AssertionError(name)
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 try:
  for w in (320,375,390,430,768,1024,1280,1440):
   page=browser.new_page(viewport={'width':w,'height':950})
   page.set_content('<style>'+css+'</style><main><div class="menu" id="pcRuleMenu"><strong id="pcRuleSummary"></strong><div id="pcRulePopover"></div></div><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';renderPcEditor();')
   result=page.evaluate('''()=>{
      const initial=JSON.stringify(pcDraft.ruleData),originalCoc=JSON.stringify(pcDraft.coc),originalExcel=JSON.stringify(pcDraft.excelEdits);
      pcRuleEditableData(pcDraft).traits.push({label:'甲',value:'11',detail:'甲说明',future:{keep:1}});
      const keyA=pcRuleGenericKey(pcDraft);
      pcRuleFreezeBeforeSwitch(pcDraft);pcDraft.ruleMeta.customName='规则乙';pcRuleEditableData(pcDraft).skills.push({label:'乙',value:'22'});renderPcEditor();
      const keyB=pcRuleGenericKey(pcDraft),originalA=JSON.stringify(pcDraft.ruleSheets[keyA]),originalB=JSON.stringify(pcDraft.ruleSheets[keyB]);
      const input=document.querySelector('[data-pc-rule-custom-name]');input.value='规则甲';input.dispatchEvent(new Event('input',{bubbles:true}));
      const blocked=pcDraft.ruleMeta.customName==='规则乙'&&input.value==='规则乙'&&document.querySelector('[data-pc-rule-scope-notice]')?.hidden===false;
      const noMutation=JSON.stringify(pcDraft.ruleSheets[keyA])===originalA&&JSON.stringify(pcDraft.ruleSheets[keyB])===originalB;
      const chooser=document.querySelector('[data-pc-rule-existing-scope]');const explicit=Boolean(chooser&&[...chooser.options].some(o=>o.value===keyA));
      chooser.value=keyA;chooser.dispatchEvent(new Event('change',{bubbles:true}));
      const switched=pcDraft.ruleMeta.customName==='规则甲'&&pcRuleCurrentData(pcDraft).traits.at(-1).future.keep===1;
      const renamed=pcRuleRetargetCustomScope(pcDraft,'customName','规则丙')&&pcRuleCurrentData(pcDraft).traits.at(-1).value==='11';renderPcEditor();
      const serial=JSON.parse(JSON.stringify(pcDraft));serial.ruleSheets=normalizePcRuleSheets(serial.ruleSheets);
      const preserved=JSON.stringify(serial.ruleData)===initial&&JSON.stringify(serial.coc)===originalCoc&&JSON.stringify(serial.excelEdits)===originalExcel&&serial.ruleSheets['future-version'].note==='must-stay'&&serial.ruleSheets[keyB].skills[0].value==='22';
      const second={...serial,id:'synthetic-stage32-B'};pcRuleGroupUi(pcDraft,'skills').query='本 PC 的搜索';
      const isolated=pcRuleGroupUi(second,'skills').query==='';
      return {blocked,noMutation,explicit,switched,renamed,preserved,isolated,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,selectorHeight:document.querySelector('[data-pc-rule-existing-scope]')?.getBoundingClientRect().height||0,notice:document.querySelector('[data-pc-rule-scope-notice]')?.textContent||''};
   }''')
   for name,v in result.items():
    if name=='notice':continue
    check(f'{w}:{name}', v>=44 if name=='selectorHeight' else v)
   if w in (320,375,1280):page.screenshot(path=str(OUT/f'rule-switch-{w}.png'),full_page=True)
   page.close()
  for theme,vars in [('plain',('#f8f6f3','#fff','#ddd','#292929')),('tomato',('#fff0ec','#fff8f4','#edc5bb','#422626')),('night',('#24202f','#342c42','#695876','#f4eefd'))]:
   page=browser.new_page(viewport={'width':375,'height':950})
   page.set_content('<style>'+css+'</style><main><div class="menu" id="pcRuleMenu"><strong id="pcRuleSummary"></strong><div id="pcRulePopover"></div></div><div id="editor"></div></main>')
   page.add_script_tag(content=setup+'\n'+logic+'\npcDraft='+json.dumps(fixture,ensure_ascii=False)+';pcRuleEditableData(pcDraft).traits.push({label:"甲",value:"11"});pcRuleFreezeBeforeSwitch(pcDraft);pcDraft.ruleMeta.customName="规则乙";pcRuleEditableData(pcDraft).skills.push({label:"乙",value:"22"});renderPcEditor();')
   page.evaluate('''v=>['--page','--surface','--line','--ink'].forEach((k,i)=>document.documentElement.style.setProperty(k,v[i]))''',list(vars))
   inp=page.locator('[data-pc-rule-custom-name]');inp.fill('规则甲');
   check(theme+':collision-notice',page.locator('[data-pc-rule-scope-notice]').is_visible())
   check(theme+':select-existing',page.locator('[data-pc-rule-existing-scope]').count()==1)
   check(theme+':no-overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   page.screenshot(path=str(OUT/f'collision-{theme}-375.png'),full_page=True);page.close()
 finally:browser.close()
result={'checks':len(checks),'passed':sum(v for _,v in checks),'failed':[k for k,v in checks if not v],'mode':'production rule scope functions and actual menu event handlers in isolated Chromium; synthetic PCs, no native IndexedDB'}
(OUT/'round178-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(result,ensure_ascii=False))
