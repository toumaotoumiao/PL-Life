'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('const PC_DND_STRUCTURE_LAYOUTS=Object.freeze({'),b=html.indexOf('async function pcDndStructurePreviewFile(',a);
assert.ok(a>0&&b>a);
const cell=(sheet,ref)=>{const m=/^([A-Z]+)(\d+)$/.exec(ref);let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;return sheet?.rows?.[+m[2]-1]?.[col-1]??'';};
const api=new Function('pcInsaneSheetCell',html.slice(a,b)+'return {read:pcDndStructurePreviewFromSheets,render:pcDndStructurePreviewHTML,anchors:PC_DND_SOURCE_ANCHORS,layout:PC_DND_STRUCTURE_LAYOUTS,outline:pcDndSourceOutlineFromSheets};')(cell);
const put=(rows,ref,value)=>{const m=/^([A-Z]+)(\d+)$/.exec(ref);let col=0;for(const c of m[1])col=col*26+c.charCodeAt(0)-64;(rows[+m[2]-1]??=[])[col-1]=value;};
const abilities=['力量','敏捷','体质','智力','感知','魅力'];
function sample(id){const profile=api.layout[id],rows=Array.from({length:profile.sheetCount},(_,i)=>({name:'PRIVATE_SHEET_NOT_UI',rows:[]}));
 for(let i=0;i<rows.length;i++)Object.defineProperty(rows[i].rows,'formulaRefs',{value:new Set(i===1?profile.companionFormulas:[])});
 profile.refs.forEach((ref,i)=>put(rows[1].rows,ref,abilities[i]));profile.candidateRefs.forEach((ref,i)=>put(rows[1].rows,ref,12+i));
 for(const anchor of api.anchors[id])put(rows[anchor.sheet].rows,anchor.ref,anchor.aliases[0]);
 put(rows[0].rows,'A1','PRIVATE_CHARACTER_SENTINEL');return rows;}
for(const id of ['layout-21','layout-8']){
 test(`Round221 ${id} allows exact fixed labels and safe punctuation variants`,()=>{const rows=sample(id),anchors=api.anchors[id];for(const anchor of anchors)put(rows[anchor.sheet].rows,anchor.ref,`  ${anchor.aliases[0]} ： `);const out=api.read(rows);assert.equal(out.sourceOutline.filter(x=>x.status==='label-match').length,7);assert.equal(out.identityCombatImport,false);assert.ok(out.sourceOutline.every(x=>x.inputCell==='unmapped'));});
 test(`Round221 ${id} rejects notes and misleading near-matches without leaking text`,()=>{const rows=sample(id),anchor=api.anchors[id][0];put(rows[anchor.sheet].rows,anchor.ref,'背景：PRIVATE_CHARACTER_SENTINEL');const out=api.read(rows),shown=api.render(out,true);assert.equal(out.sourceOutline[0].status,'unverified');assert.doesNotMatch(JSON.stringify(out),/PRIVATE_CHARACTER_SENTINEL/);assert.doesNotMatch(shown,/PRIVATE_CHARACTER_SENTINEL/);assert.match(shown,/输入格未核对/);});
 test(`Round221 ${id} formula and numeric labels cannot pass`,()=>{const rows=sample(id),anchor=api.anchors[id][1];rows[anchor.sheet].rows.formulaRefs.add(anchor.ref);assert.equal(api.read(rows).sourceOutline[1].status,'unverified');rows[anchor.sheet].rows.formulaRefs.delete(anchor.ref);put(rows[anchor.sheet].rows,anchor.ref,123);assert.equal(api.read(rows).sourceOutline[1].status,'unverified');});
 test(`Round221 ${id} no import controls for identity/combat even after reveal`,()=>{const shown=api.render(api.read(sample(id)),true,true);assert.equal((shown.match(/data-pc-dnd-pick=/g)||[]).length,6);assert.equal((shown.match(/pc-dnd-outline-row/g)||[]).length,7);assert.doesNotMatch(shown,/data-pc-dnd-source-pick|data-pc-dnd-identity-apply/);});
}
test('Round221 static aliases are small, exact and never inferred from neighboring values',()=>{const region=html.slice(a,b);assert.doesNotMatch(region,/anchor\.term\.test\(clean\)/);assert.match(region,/anchor\.aliases\.some\(alias=>pcDndSourceLabelToken\(alias\)===clean\)/);assert.doesNotMatch(region,/sourceOutline.*\.value/);});
test('Round221 version/cache, prior round and CI paths remain in sync',()=>{assert.match(html,/const APP_UI_VERSION = "[0-9.]+"/);assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('v'+html.match(/const APP_UI_VERSION = "([0-9.]+)"/)[1]));assert.ok((html.match(/class="version-log-version"/g)||[]).length>1);for(const workflow of ['pl-browser-synthetic.yml','pl-native-restore-gate.yml']){const text=fs.readFileSync(path.join(root,'.github/workflows',workflow),'utf8');assert.match(text,/round220-dnd5-source-outline\.test\.cjs/);assert.match(text,/round221-dnd5-strict-anchor\.test\.cjs/);}assert.ok(!fs.readdirSync(root).some(x=>/\.xlsx$|\.pdf$/i.test(x)));});
