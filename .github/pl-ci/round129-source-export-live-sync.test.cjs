'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const workflow=fs.readFileSync(path.join(__dirname,'../workflows/pl-browser-synthetic.yml'),'utf8');
function has(label,pattern){assert.match(source,pattern,label);}
test('Round129 source setting change refreshes currently open live preview and stays synchronized with final mode',()=>{
  has('source refresh',/if\(choice\)\{[^\n]*storeUnifiedExportLayout\(layout\)[^\n]*syncInlineExportLayoutControls\(\)[^\n]*PLExportLivePreview\?\.refresh\(panel\.id\)/);
  has('source preview API',/window\.PLExportLivePreview=\{mode:storedUnifiedExportLayout,mark:uxLivePreviewMark,render:uxLivePreviewRender,error:uxPreviewSetError/);
  has('same canonical preference',/exportLayout:storedUnifiedExportLayout\(\)/);
  has('preview does not silently keep page mode',/if\(mode==="long"&&entries\.length!==1\)throw new Error/);
  assert.doesNotMatch(source,/设置区仍按原分页预览，最终预览查看合并效果/);
});
test('Round129 PC/module source long preview uses semantic continuous builder rather than paginated canvases',()=>{
  has('entity renderer',/isContinuousPreview=window\.PLExportLivePreview\?\.mode\(\)==='long'/);
  has('semantic builder',/continuous:\(\)=>entityContinuousLongCanvas\(mode==='pc'\?'pc':'module',entity,state,pages\)/);
  has('race guard',/if\(seq!==previewSeq\)return;/);
  has('summary and error gate',/单张长图预览未生成/);
  has('return to paged preview',/else\{preview\.innerHTML='';const firstIds=new Set\(\)/);
});
test('Round129 annual/statistics/recap use exactly their final-export drawing routes',()=>{
  has('annual source long',/continuous:\(\)=>buildPlannerYearContinuousCanvas\(plannerYearShowcaseState\)/);
  has('annual final long',/longCanvasBuilder:\(\)=>buildPlannerYearContinuousCanvas\(plannerYearShowcaseState\)/);
  has('stats paged',/paged:\(\)=>buildStatsExportCanvases\(statsExportState,\{preview:true\}\)/);
  has('stats long',/continuous:\(\)=>buildStatsContinuousCanvas\(statsExportState\)/);
  has('recap long',/continuous:\(\)=>buildContinuousRecapCanvas\(\)/);
  has('recap indicator',/result\.mode==="long"\?"单张长图"/);
  has('organizer real-page count',/pagedStates=hoOrganizerPageStates\(hoOrganizerExportStyle/);
  has('organizer final paged route',/paged:\(\)=>buildHoOrganizerCanvases\(hoOrganizerExportStyle/);
  has('overridden organizer preview has the same live mode behavior',/renderHoOrganizerComposerPreview=function\(\)\{[^\n]*pagedStates=hoOrganizerPageStates\(/);
});
test('Round129 mode refresh covers every image export configuration panel',()=>{
  for(const [id,fn] of [
    ['selfIntroExportPanel','renderSelfIntroExportCenter'],['statsExportPanel','renderStatsExportCenter'],
    ['plannerYearShowcasePanel','renderPlannerYearShowcasePanel'],['recordShowcaseBackdrop','renderRecordShowcaseComposer'],
    ['entityShowcaseBackdrop','render'],['recordsRecapBackdrop','render'],
    ['hoExportComposerPanel','renderHoOrganizerExportComposer']
  ]){
    assert.ok(source.includes('register("'+id+'",')||source.includes("register('"+id+"',"),id+' missing live refresh registration');
    assert.ok(source.includes(fn),fn+' missing renderer');
  }
});
test('Round129 failed live generation invalidates preview and locks export without changing records',()=>{
  has('error banner',/function uxPreviewSetError\(stage,err,area,button\)/);
  has('disable',/if\(button\)button\.disabled=true/);
  has('clear old image',/stage\.replaceChildren\(box\)/);
  has('re-enable successful export',/if\(button\)button\.disabled=false/);
  has('diagnostics',/技术详情（可复制）/);
  has('mobile-preview responsive',/\.export-live-preview-page canvas\{[^}]*max-width:100%/);
});
test('Round129 contracts are part of the release CI',()=>{
  assert.match(workflow,/round129-source-export-live-sync\.test\.cjs/);
  assert.match(workflow,/round129-source-export-live-sync-browser\.cjs/);
});
