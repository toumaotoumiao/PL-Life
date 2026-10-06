const fs=require('fs'),path=require('path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function block(name,next){const start=html.indexOf(`function ${name}`);assert.notEqual(start,-1,`${name} missing`);const end=next?html.indexOf(`function ${next}`,start+1):html.indexOf('\nfunction ',start+1);return html.slice(start,end<0?start+12000:end);}
test('anonymous evidence payload excludes PC identity and workbook content fields',()=>{
 const src=block('pcDndAcceptanceEvidenceCreate','pcDndAcceptanceRecordSuccess');
 for(const required of ["format:'pl-life-dnd-export-acceptance'",'appVersion:APP_UI_VERSION','schemaVersion:DATA_SCHEMA_VERSION','coverage:{','preflight:{','postbuild:{','manualReview:{'])assert.ok(src.includes(required),required);
 for(const forbidden of ['pc.name','file.name','fileName','background','skillValue','equipmentValue','pcRuleCurrentData','identityCombatMap'])assert.ok(!src.includes(forbidden),`evidence must not read ${forbidden}`);
});
test('successful post-build export records evidence only after browser accepts XLSX download',()=>{
 const src=block('pcExportDndTemplateWorkbook','pcRequestDndTemplateExport');
 const download=src.indexOf('downloadBlobFile(result.blob,filename)');
 const record=src.indexOf('pcDndAcceptanceRecordSuccess(draft,result,acceptanceAudit,{bindTemplate})');
 assert.ok(download>=0&&record>download,'record should happen after accepted workbook download');
 assert.ok(src.includes('acceptanceAudit=null'),'export must accept preflight audit');
 const confirm=block('pcDndExportCheckConfirm','pcExportDndTemplateWorkbook');
 assert.ok(confirm.includes('acceptanceAudit:payload.audit'),'preflight audit must flow into final evidence');
});
test('acceptance review is session-only and downloadable as generic anonymous JSON',()=>{
 assert.ok(html.includes('id="pcDndAcceptanceBackdrop"'));
 assert.ok(html.includes('data-pc-dnd-acceptance-open disabled'));
 assert.ok(html.includes('下载匿名验收 JSON'));
 const dl=block('pcDndAcceptanceDownload');
 assert.ok(dl.includes('PL-Life_DND5_匿名验收记录_v${APP_UI_VERSION}.json'));
 assert.ok(html.includes('let pcDndAcceptanceSession=null;'));
 assert.ok(!html.includes('pcDndAcceptanceSession:'));
});
test('acceptance submodal participates in modal lifecycle and manual review is four-state scoped',()=>{
 assert.ok(html.includes('"pcDndAcceptanceBackdrop", "pcDndExportCheckBackdrop"'));
 assert.ok(html.includes('id === "pcDndAcceptanceBackdrop"'));
 const set=block('pcDndAcceptanceSetManual','pcDndAcceptanceDownload');
 for(const key of ['excelOpen','wpsOpen','writeTargetsCorrect','structureIntact'])assert.ok(set.includes(key));
 assert.ok(set.includes("value==='pass'?true:value==='fail'?false:null"));
});
