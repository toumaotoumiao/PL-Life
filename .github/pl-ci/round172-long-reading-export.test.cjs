'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const part=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);assert.ok(x>=0&&y>x,`missing ${a}`);return html.slice(x,y)};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=new Function('clone','escapeHTML',`${part('function normalizePcRuleData(', 'function normalizePcArchive(')}\n${part('function pcRuleReadingHTML(pc){','function pcOverviewDashboardHTML(pc){')}\nreturn {pcRuleReadingHTML,pcRuleReadingOpenUi,pcRuleReadingDetailOpenUi,pcCaptureRuleDisclosures,pcRuleSwapDisclosure,pcRuleRemoveDisclosure,normalizePcRuleSheets,pcRuleCurrentData};`)(structuredClone,escapeHTML);
const base=()=>({id:'synthetic-1',ruleMeta:{systemId:'insane'},ruleData:{traits:[],skills:[],resources:[]},ruleSheets:{insane:{traits:[{label:'生命力',value:'6'}],skills:[{label:'安静',value:'2',detail:'短说明'}, {label:'详细说明',value:'4',detail:'<img onerror=alert(1)>\n'+ '合理公开内容'.repeat(35)}],resources:[]},shinobigami:{traits:[{label:'流派',value:'甲'}],skills:[],resources:[]}},coc:{san:40},excelEdits:[{sheet:'人物卡',ref:'B6',value:23}]});
test('long notes start collapsed, short notes remain visible and all user content is escaped',()=>{
 const htmlResult=api.pcRuleReadingHTML(base());
 assert.match(htmlResult,/短说明<\/p>/);
 assert.match(htmlResult,/pc-rule-reading-detail-short/);
 assert.match(htmlResult,/&lt;img onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(htmlResult,/<img onerror=/);
 assert.match(htmlResult,/完整说明/);
 assert.match(htmlResult,/data-pc-rule-reading-detail-token="synthetic-1:insane:skills:1"/);
});
test('note disclosure state follows PC and rule; never changes archive data',()=>{
 const pc=base(),original=structuredClone(pc);
 const key='synthetic-1:insane:skills:1';api.pcRuleReadingDetailOpenUi.add(key);
 assert.match(api.pcRuleReadingHTML(pc),new RegExp(`data-pc-rule-reading-detail-token="${key}" open`));
 const alt=structuredClone(pc);alt.ruleMeta.systemId='shinobigami';assert.doesNotMatch(api.pcRuleReadingHTML(alt),/pc-rule-reading-detail/);
 assert.match(api.pcRuleReadingHTML(pc),new RegExp(`data-pc-rule-reading-detail-token="${key}" open`));
 assert.deepEqual(api.normalizePcRuleSheets(pc.ruleSheets).insane.skills[1].detail,original.ruleSheets.insane.skills[1].detail);
 assert.deepEqual(pc,original);
});
test('reading description disclosure follows its row on reorder and removal',()=>{
 const pc=base(),token=i=>`synthetic-1:insane:skills:${i}`;
 api.pcRuleReadingDetailOpenUi.clear();api.pcRuleReadingDetailOpenUi.add(token(1));
 api.pcRuleSwapDisclosure(pc,'skills',1,0);assert.ok(api.pcRuleReadingDetailOpenUi.has(token(0)));assert.ok(!api.pcRuleReadingDetailOpenUi.has(token(1)));
 api.pcRuleRemoveDisclosure(pc,'skills',0,2);assert.ok(!api.pcRuleReadingDetailOpenUi.has(token(0)));assert.ok(!api.pcRuleReadingDetailOpenUi.has(token(1)));
});
test('disclosure event, capture, PC isolation and safe export cap remain wired',()=>{
 assert.match(html,/data-pc-rule-reading-detail-token/);
 assert.match(html,/pcRuleReadingDetailOpenUi\.clear\(\)/);
 assert.match(html,/const description=e\.target\.dataset\?\.pcRuleReadingDetailToken/);
 assert.match(html,/pcArchiveTextLines\(measure,String\(value\),width-12,1600,bodyFont\)/);
 assert.match(html,/if\(lines\.length>=1600\)throw new Error/);
 assert.match(html,/原档案未修改/);
 assert.match(html,/const DATA_SCHEMA_VERSION = 26/);
 assert.match(html,/const APP_UI_VERSION = "\d+(?:\.\d+){3}"/);
});
