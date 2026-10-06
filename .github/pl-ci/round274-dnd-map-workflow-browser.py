#!/usr/bin/env python3
from pathlib import Path
import json, os, re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR',str(root/'.github/pl-ci')));out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text('utf8')
html=re.sub(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]*>','',html,flags=re.I)
def repl(m):return '<script>\n'+re.sub(r'</script','<\\/script',(root/m.group(1)).read_text('utf8'),flags=re.I)+'\n</script>'
html=re.sub(r'<script\s+src="\./([a-zA-Z0-9_.-]+\.js)"\s*></script>',repl,html,flags=re.I)
shim="""<script>(function(){const a=new Map(),b=new Map();function st(m){return{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}}};Object.defineProperty(window,'localStorage',{value:st(a),configurable:true});Object.defineProperty(window,'sessionStorage',{value:st(b),configurable:true});})();</script>"""
html=html.replace('<head>','<head>'+shim,1)
checks=[]
def record(label,ok):checks.append({'test':label,'pass':bool(ok)})
script=r'''async()=>{
 localStorage.setItem(ONBOARDING_KEY,'1');document.getElementById('onboardingBackdrop').hidden=true;document.getElementById('appRoot')?.removeAttribute('inert');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const cell=(ref,value,kind='inline')=>value===null?`<c r="${ref}"/>`:(kind==='formula'?`<c r="${ref}"><f>${value}</f><v>2</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${pcExcelXmlEscape(String(value))}</t></is></c>`);
 const rowsXml=(spec)=>Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])).map(([r,cells])=>`<row r="${r}">${cells.join('')}</row>`).join('');
 const sheetXml=index=>{const spec={};const put=(row,ref,value=null,kind='inline')=>(spec[row]||(spec[row]=[])).push(cell(ref,value,kind));
  if(index===0){put(5,'B5','背景');put(5,'D5');put(8,'B8','种族');put(8,'D8');put(8,'K8','阵营');put(8,'M8');}
  else if(index===1){put(3,'P3','熟练加值');put(3,'R3');put(3,'W3','等级');put(3,'Y3');put(27,'B27','先攻');put(27,'D27');put(27,'AF27','生命值');put(27,'AH27');const labels=['力量','敏捷','体质','智力','感知','魅力'],rs=[12,14,16,18,20,22];for(let i=0;i<6;i++){const r=rs[i];put(r,`C${r}`,labels[i]);put(r,`F${r}`,'1+1','formula');put(r,`I${r}`,8+i);}}
  else put(1,'A1',`保留页${index+1}`);return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rowsXml(spec)}</sheetData></worksheet>`;};
 const tags=[],rels=[],parts=[];for(let i=1;i<=21;i++){tags.push(`<sheet name="Sheet${i}" sheetId="${i}" r:id="rId${i}"/>`);rels.push(`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`);parts.push({name:`xl/worksheets/sheet${i}.xml`,data:sheetXml(i-1)});}
 const source=await pcMakeExcelZipEntries([{name:'[Content_Types].xml',data:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/workbook.xml',data:`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tags.join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`},...parts]);
 const pc=makeBlankPc(selfProfileId());pc.id='round274';pc.name='合成DND映射流程';pc.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:'5e-2024',confirmed:true,source:'user-selected'};const rd=pcRuleEditableData(pc);rd.traits.forEach((row,i)=>row.value=String([15,14,13,12,11,10][i]));
 for(const [label,value] of Object.entries({'背景':'侍从','等级':'9','熟练加值':'+99','生命值':'52'})){const row=rd.resources.find(x=>x.label===label);if(row)row.value=value;}
 let mem={pcId:pc.id,blob:new Blob([source],{type:PC_XLSX_MIME}),fileName:'fictional-template.xlsx',kind:'dnd-template',templateKey:'dnd:5e-2024',editionId:'5e-2024',layoutId:'layout-21',identityCombatMap:{version:1,layoutId:'layout-21',refs:{'背景':'D5','等级':'Y3'}},updatedAt:Date.now()};
 pcWorkbookGet=async id=>String(id)===pc.id?mem:null;pcWorkbookPut=async row=>(mem=row,row);pcs.push(pc);openPcEditor(pc.id);pcEditorTab='coc';renderPcEditor({resetScroll:true});await syncPcDndTemplateExportUi(pcDraft,pcExcelExportAvailability(pcDraft));
 const mapButton=document.querySelector('[data-pc-dnd-map-open]'),buttonBefore={text:mapButton.textContent,disabled:mapButton.disabled,count:mapButton.dataset.pcDndMapCount};await pcDndMapOpen();const body=document.getElementById('pcDndMapBody');
 const txt=sel=>body.querySelector(sel)?.textContent?.trim()||'';const summary=()=>({verified:txt('[data-pc-dnd-map-verified]'),filled:txt('[data-pc-dnd-map-filled]'),exportable:txt('[data-pc-dnd-map-exportable]')});
 const state=label=>body.querySelector(`[data-pc-dnd-map-row="${CSS.escape(label)}"]`)?.dataset.state||'';const stateText=label=>body.querySelector(`[data-pc-dnd-map-row="${CSS.escape(label)}"] [data-pc-dnd-map-state]`)?.textContent?.trim()||'';const input=label=>body.querySelector(`[data-pc-dnd-map-ref="${CSS.escape(label)}"]`);
 const initial={summary:summary(),background:state('背景'),level:state('等级'),species:state('种族／物种'),privateLeak:body.textContent.includes('侍从')||body.textContent.includes('52')||body.textContent.includes('+99'),touch:[...body.querySelectorAll('[data-pc-dnd-map-ref]')].every(x=>x.getBoundingClientRect().height>=44)};
 // lower-case input normalizes on blur and immediately updates progress
 input('种族／物种').value='d8';input('种族／物种').dispatchEvent(new Event('input',{bubbles:true}));input('种族／物种').dispatchEvent(new FocusEvent('focusout',{bubbles:true}));const afterSpecies={value:input('种族／物种').value,state:state('种族／物种'),summary:summary()};
 // unsafe states are visible before save
 input('熟练加值').value='F12';input('熟练加值').dispatchEvent(new Event('input',{bubbles:true}));input('先攻').value='Y3';input('先攻').dispatchEvent(new Event('input',{bubbles:true}));input('生命值').value='Z999';input('生命值').dispatchEvent(new Event('input',{bubbles:true}));const unsafe={prof:stateText('熟练加值'),initiative:stateText('先攻'),hp:stateText('生命值'),summary:summary()};
 // The same next-item selector used by Enter chooses the next unfinished field.
 let enterFocused='';const focusInputs=[...body.querySelectorAll('[data-pc-dnd-map-ref]')],focusOriginals=new Map();for(const el of focusInputs){focusOriginals.set(el,el.focus);el.focus=function(opts){enterFocused=this.dataset.pcDndMapRef||'';return focusOriginals.get(this).call(this,opts);};}pcDndMapFocusNext(input('种族／物种'));for(const el of focusInputs)el.focus=focusOriginals.get(el);
 // complete all coordinates
 for(const [label,ref] of Object.entries({'背景':'D5','种族／物种':'D8','阵营':'M8','等级':'Y3','熟练加值':'R3','先攻':'D27','生命值':'AH27'})){input(label).value=ref;input(label).dispatchEvent(new Event('input',{bubbles:true}));}
 const complete={summary:summary(),nextDisabled:body.querySelector('[data-pc-dnd-map-next]').disabled,saveText:document.querySelector('[data-pc-dnd-map-save]').textContent};body.querySelector('[data-pc-dnd-map-attest]').checked=true;await pcDndMapSave();await syncPcDndTemplateExportUi(pcDraft,pcExcelExportAvailability(pcDraft));
 const afterSave={text:document.querySelector('[data-pc-dnd-map-open]').textContent,count:document.querySelector('[data-pc-dnd-map-open]').dataset.pcDndMapCount,pending:Object.keys(pcWorkbookPending?.identityCombatMap?.refs||{}).length};
 return {buttonBefore,initial,afterSpecies,unsafe,enterFocused,complete,afterSave};
}'''
with sync_playwright() as p:
 executable=os.environ.get('PL_TEST_CHROMIUM_PATH') or os.environ.get('PL_CI_CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 browser=p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox'])
 try:
  for width in (390,1280):
   page=browser.new_page(viewport={'width':width,'height':980},service_workers='block');page.set_content(html,wait_until='domcontentloaded',timeout=90000);r=page.evaluate(script)
   record(f'{width}: editor button shows saved mapping progress',r['buttonBefore']=={'text':'模板字段映射 2/7','disabled':False,'count':'2'})
   record(f'{width}: live summary separates mapping, PC filled, and exportable',r['initial']['summary']=={'verified':'2/7','filled':'4/7','exportable':'2/7'})
   record(f'{width}: dialog does not echo current PC field values',not r['initial']['privateLeak'])
   record(f'{width}: coordinate controls remain touch sized',r['initial']['touch'])
   record(f'{width}: lower-case ref normalizes and becomes valid',r['afterSpecies']['value']=='D8' and r['afterSpecies']['state']=='valid' and r['afterSpecies']['summary']['verified']=='3/7')
   record(f'{width}: unsafe targets surface before save',r['unsafe']['prof']=='公式格' and '重复' in r['unsafe']['initiative'] and r['unsafe']['hp']=='模板中不存在')
   record(f'{width}: Enter/next route selects next unfinished item',r['enterFocused']=='阵营')
   record(f'{width}: complete mapping updates summary and save action',r['complete']['summary']=={'verified':'7/7','filled':'4/7','exportable':'3/7'} and r['complete']['nextDisabled'] and '7/7' in r['complete']['saveText'])
   record(f'{width}: saved pending mapping refreshes editor progress',r['afterSave']=={'text':'模板字段映射 7/7','count':'7','pending':7})
   page.screenshot(path=str(out/f'round274-dnd-map-workflow-{width}.png'),full_page=True);page.close()
 finally: browser.close()
report={'version':re.search(r'const APP_UI_VERSION = "([0-9.]+)";',html).group(1),'checks':len(checks),'passed':sum(x['pass'] for x in checks),'failures':[x for x in checks if not x['pass']],'mode':'D&D mapping UX: progress/status/keyboard; synthetic workbook only'}
(out/'round274-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print('ROUND274',report['passed'],'/',report['checks'],'failures',len(report['failures']))
if report['failures']:
 print(json.dumps(report['failures'],ensure_ascii=False,indent=2));raise SystemExit(1)
