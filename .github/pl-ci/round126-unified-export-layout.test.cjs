'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const workflow=fs.readFileSync(path.join(__dirname,'../workflows/pl-browser-synthetic.yml'),'utf8');
function fns(){
 const a=html.indexOf('  function unifiedExportBaseFilename(pending)');
 const b=html.indexOf('  function syncUnifiedExportLayoutButtons(pending)',a);
 assert(a>=0&&b>a);
 const drawn=[],rects=[];
 const makeCanvas=()=>{
  const ctx={fillStyle:'',drawImage:(...args)=>drawn.push(args),fillRect:(...args)=>rects.push(args)};
  return{width:0,height:0,getContext:()=>ctx};
 };
 const c={Math,Array,Error,document:{createElement:name=>name==='canvas'?makeCanvas():null}};
 vm.createContext(c);vm.runInContext(html.slice(a,b)+'\nthis.renderLong=buildUnifiedLongExportCanvas;this.payload=resolveUnifiedExportPayload;this.sample=pickExportPreviewFill;',c);
 return{c,drawn,rects};
}
const page=(w,h,color=[0,0,0,255])=>({width:w,height:h,getContext:()=>({getImageData:()=>({data:color})})});
test('Round126 long mode creates one PNG canvas with all pages in original order, without cropping or stretching',()=>{
 const {c,drawn,rects}=fns(),first=page(100,160),second=page(200,230),pending={sourceCanvases:[first,second],filenames:['角色档案_1-2.png','角色档案_2-2.png'],exportLayout:'long'};
 const out=c.payload(pending);
 assert.equal(out.layout,'long');assert.equal(out.canvases.length,1);
 assert.equal(out.canvases[0].width,200);assert.equal(out.canvases[0].height,390);
 assert.deepEqual(Array.from(out.names),['角色档案.png']);
 assert.equal(drawn.length,2);
 assert.equal(drawn[0][0],first);assert.deepEqual(drawn[0].slice(1),[50,0,100,160]);
 assert.equal(drawn[1][0],second);assert.deepEqual(drawn[1].slice(1),[0,160,200,230]);
 assert.deepEqual(rects[0],[0,0,200,390]);
 assert.equal(pending.longCanvas,out.canvases[0]);
});
test('Round126 fallback keeps the original pages and reports why long mode cannot be generated',()=>{
 const {c,drawn}=fns(),first=page(1080,9000),second=page(1080,9000),pending={sourceCanvases:[first,second],filenames:['回顾_1-2.png','回顾_2-2.png'],exportLayout:'long'};
 const fallback=c.payload(pending,true);
 assert.equal(fallback.layout,'long-error');assert.equal(fallback.canvases.length,2);
 assert.match(fallback.error.message,/超出当前浏览器稳定导出范围/);
 assert.equal(drawn.length,0);
 assert.throws(()=>c.payload(pending,false),/超出当前浏览器稳定导出范围/);
 pending.exportLayout='pages';const paged=c.payload(pending);
 assert.equal(paged.error,null);assert.deepEqual(Array.from(paged.names),pending.filenames);
});
test('Round126 black source background stays black, transparent background uses opaque white fallback',()=>{
 const {c}=fns();assert.equal(c.sample(page(4,4,[0,0,0,255])),'rgba(0,0,0,1)');
 assert.equal(c.sample(page(4,4,[0,0,0,0])),'#ffffff');
});
test('Round126 source and final controls share the same format selection independent of density',()=>{
 assert.match(html,/const UX_EXPORT_SOURCE_PANELS=\[/);
 for(const id of ['selfIntroExportPanel','statsExportPanel','plannerYearShowcasePanel','recordShowcaseBackdrop','entityShowcaseBackdrop','recordsRecapBackdrop','hoExportComposerPanel'])assert(html.includes('"'+id+'"'));
 assert.match(html,/data-export-inline-layout="pages"/);assert.match(html,/data-export-inline-layout="long"/);
 assert.match(html,/data-ux-export-layout="pages"/);assert.match(html,/data-ux-export-layout="long"/);
 assert.match(html,/storeUnifiedExportLayout\(layout\);[\s\S]*?syncInlineExportLayoutControls\(\)/);
 assert.match(html,/exportLayout:storedUnifiedExportLayout\(\)/);
 assert.match(html,/exportLayoutObserver\.observe\(document\.body/);
 assert.match(html,/summary\.textContent=layout==="long"\?"单张长图"/);
 assert.match(html,/导出形式/);
 assert.doesNotMatch(html,/density==="long"/);
});
test('Round126 settings and final preview cannot lose edits when long mode exceeds canvas limits',()=>{
 assert.match(html,/download\.disabled=hasLongError/);
 assert.match(html,/if\(hasLongError\)layoutHint\.textContent=/);
 assert.match(html,/if\(!allowPreviewFallback\)throw err/);
 assert.match(html,/renderUnifiedExportStage\(uxPendingExport\)/);
 assert.match(html,/setTimeout\(syncInlineExportLayoutControls,0\)/);
 assert.match(workflow,/round126-unified-export-layout\.test\.cjs/);
});
