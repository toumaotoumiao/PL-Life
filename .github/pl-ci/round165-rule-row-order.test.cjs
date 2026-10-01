'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/pl-browser-synthetic.yml'),'utf8');
const a=html.indexOf('function normalizePcRuleData('),b=html.indexOf('function normalizePcArchive(',a),c=html.indexOf('function pcGenericRuleEditorHTML('),d=html.indexOf('function pcProfileEditorHTML(',c);
assert.ok(a>0&&b>a&&c>0&&d>c);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const api=new Function('clone','moduleRuleDisplay','escapeHTML',`${html.slice(a,b)}\n${html.slice(c,d)}\nreturn {pcMoveRuleEntry,pcRuleEditableData,pcRuleCurrentData,normalizePcRuleSheets,pcGenericRuleEditorHTML};`)(structuredClone,m=>m.systemId||'规则',esc);
const make=(systemId='insane')=>({ruleMeta:{systemId},ruleData:{traits:[{label:'原有通用值',value:'保留'}],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'生命力',value:'6',meta:{future:true}}],skills:[{label:'A',value:'1',future:{x:1}},{label:'B',value:'2'},{label:'C',value:'3'}],resources:[],futureData:{keep:1}},shinobigami:{traits:[{label:'流派',value:'甲'}],skills:[],resources:[]}},coc:{san:55},excelEdits:[{sheet:'角色卡',ref:'B6',value:'原件差异'}]});
test('moving an active row keeps complete object metadata, order, and other sheets untouched',()=>{
 const x=make(),before=structuredClone(x),target=api.pcMoveRuleEntry(x,'skills',0,1);
 assert.equal(target,1);assert.deepEqual(x.ruleSheets.insane.skills.map(r=>r.label),['B','A','C']);assert.deepEqual(x.ruleSheets.insane.skills[1].future,{x:1});
 assert.deepEqual(x.ruleSheets.shinobigami,before.ruleSheets.shinobigami);assert.deepEqual(x.ruleData,before.ruleData);assert.deepEqual(x.coc,before.coc);assert.deepEqual(x.excelEdits,before.excelEdits);assert.deepEqual(x.ruleSheets.insane.futureData,before.ruleSheets.insane.futureData);
 assert.equal(api.pcMoveRuleEntry(x,'skills',1,-1),0);assert.deepEqual(x,before);
});
test('bounds and malformed move operations cannot mutate or initialize a template',()=>{
 const x=make(),before=structuredClone(x);
 for(const [key,index,dir] of [['skills',0,-1],['skills',2,1],['traits',0,-1],['bad',0,1],['skills',1,0],['skills',1,2],['skills',-1,1],['skills',1.5,1]])assert.equal(api.pcMoveRuleEntry(x,key,index,dir),-1);
 assert.equal(api.pcMoveRuleEntry(null,'skills',0,1),-1);assert.deepEqual(x,before);
 x.ruleMeta.systemId='shinobigami';assert.equal(api.pcMoveRuleEntry(x,'traits',0,1),-1);assert.deepEqual(x.ruleSheets.insane,before.ruleSheets.insane);
});
test('unsaved template defaults reorder independently without changing generic CoC fields',()=>{
 const x={ruleMeta:{systemId:'brp-generic'},ruleSheets:{},ruleData:{traits:[],skills:[],resources:[]},coc:{san:44},excelEdits:[{ref:'C4',value:'old'}]};
 assert.equal(api.pcMoveRuleEntry(x,'traits',0,1),1);assert.deepEqual(api.pcRuleCurrentData(x).traits.slice(0,2).map(r=>r.label),['CON','STR']);
 assert.deepEqual(x.ruleData,{traits:[],skills:[],resources:[]});assert.equal(x.coc.san,44);assert.equal(x.excelEdits[0].value,'old');
});
test('render counts filled rows without dropping blank or unknown future rows',()=>{
 const x=make(),v=api.pcGenericRuleEditorHTML(x);
 assert.match(v,/已填 3 \/ 3/);assert.match(v,/已填 1 \/ 1/);assert.match(v,/data-pc-generic-move="-1" disabled/);assert.match(v,/data-pc-generic-move="1" disabled/);
 assert.match(v,/原有通用规则数据（仅在编辑器查看）/);assert.doesNotMatch(v,/futureData/);
 x.ruleSheets.insane.skills.push({label:'',value:''});assert.match(api.pcGenericRuleEditorHTML(x),/已填 3 \/ 4/);
});
test('HTML sanitizes rule titles, labels, values and retains editor-only private guidance',()=>{
 const x=make();x.ruleSheets.insane.skills[0].label='<img src=x onerror=alert(1)>';x.ruleSheets.insane.skills[0].value='<script>bad</script>';
 const v=api.pcGenericRuleEditorHTML(x);assert.doesNotMatch(v,/<img src=x|<script>bad/);assert.match(v,/&lt;img/);assert.match(v,/&lt;script&gt;/);assert.match(v,/本页不收集秘密或使命/);
});
test('editor wiring and stylesheet expose actual 44px controls and preserve focus on reordering',()=>{
 assert.match(html,/const target=pcMoveRuleEntry\(pcDraft,key,index,direction\)/);assert.match(html,/data-pc-generic-index="\$\{target\}"\] \[data-pc-generic-move="\$\{direction\}"\]/);
 assert.match(html,/\.pc-rule-row-actions>\.btn\.small\{min-height:44px!important;min-width:44px!important/);
 assert.match(html,/@media\(max-width:760px\)\{\.pc-generic-rule-row\{grid-template-columns:/);
 assert.match(workflow,/round165-rule-row-order-browser\.py/);assert.match(workflow,/Round165:\$\{\{ steps\.round165_browser\.outcome \}\}/);
});
test('current cache, readme, schema and historic versions are synchronized',()=>{
 const v=html.match(/const APP_UI_VERSION = "([\d.]+)";/)?.[1];assert.match(v,/^\d+(?:\.\d+){3}$/);assert.ok(sw.includes(`CACHE_NAME=\`${"${CACHE_PREFIX}"}v${v}\``));assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 for(const n of ['229','230'])assert.equal((html.match(new RegExp('<strong class="version-log-version">v8\\.1\\.12\\.'+n+'</strong>','g'))||[]).length,1);
});
