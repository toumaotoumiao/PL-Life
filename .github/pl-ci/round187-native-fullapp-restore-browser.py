#!/usr/bin/env python3
"""Production application + native browser storage release gate; entirely fictional data.

Runs on a fresh ephemeral localhost origin. No shimmed storage, no private backup,
no production/test website, no existing browser profile, no external navigation.
Failures (including browser policy blocking origin navigation) are NOT skipped.
"""
from __future__ import annotations
import http.server
import json
import os
from pathlib import Path
import socketserver
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
REPORT = Path(os.environ.get('PL_SYNTHETIC_REPORT_DIR', str(ROOT / '.github/pl-ci'))) / 'round187-evidence'
REPORT.mkdir(parents=True, exist_ok=True)

class LocalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *_):
        pass
class LocalServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

checks: list[str] = []
def check(name: str, condition: bool):
    if not condition:
        raise AssertionError('Round187 check failed: ' + name)
    checks.append(name)
    report['phase'] = name

def evaluate(page, js: str):
    return page.evaluate(js)

# Only metadata and test labels enter the report; do not serialize app archives/blobs.
report = {'test': 'round187', 'commit': os.environ.get('GITHUB_SHA', 'local'), 'scope': 'real app / localhost / native localStorage and IndexedDB',
          'checks': [], 'status': 'NOT_RUN', 'phase': 'setup', 'external_requests_blocked': 0,
          'limitations': 'Isolated browser test, not hosted site or mobile hardware acceptance.'}
server = LocalServer(('127.0.0.1', 0), LocalHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
page = None
try:
    with sync_playwright() as p:
        # The hosted CI installs a pinned Playwright browser: use THAT executable,
        # rather than silently choosing an unrelated system Chromium. Local runs
        # retain their normal browser policy and do not change browser settings.
        mode = os.environ.get('PL_NATIVE_BROWSER_MODE', 'auto')
        if mode not in ('auto', 'bundled'):
            raise ValueError('Unsupported native browser mode')
        explicit = os.environ.get('PL_CI_CHROMIUM_EXECUTABLE')
        binary = explicit or ('/usr/bin/chromium' if mode == 'auto' and Path('/usr/bin/chromium').exists() else None)
        report['browser_source'] = 'explicit' if explicit else ('system' if binary else 'playwright-bundled')
        browser = p.chromium.launch(headless=True, executable_path=binary, args=['--no-sandbox'])
        try:
            context = browser.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
            # The test must not access GitHub, user sites, or any external service.
            # Preserve only the count; never record URL contents or user data.
            allowed_origin = f'http://127.0.0.1:{server.server_address[1]}/'
            def isolate_requests(route):
                url = route.request.url
                if url.startswith(allowed_origin) or url.startswith(('data:', 'blob:')):
                    route.continue_()
                else:
                    report['external_requests_blocked'] += 1
                    route.abort()
            context.route('**/*', isolate_requests)
            page = context.new_page()
            page_errors = []
            page.on('pageerror', lambda e: page_errors.append(str(e)))
            # A real HTTP origin is essential. about:blank/set_content cannot prove native IDB.
            report['phase'] = 'navigate-native-local-origin'
            page.goto(f'http://127.0.0.1:{server.server_address[1]}/index.html',
                      wait_until='domcontentloaded', timeout=90000)
            page.wait_for_function("typeof buildUnifiedCompleteBackupBlob === 'function' && typeof restoreUnifiedCompleteBackup === 'function' && typeof profiles !== 'undefined' && Array.isArray(profiles)", timeout=30000)
            report['app_version'] = evaluate(page, "() => APP_UI_VERSION")
            check('startup-native-origin', evaluate(page, "() => location.protocol==='http:' && !!indexedDB && !!localStorage && !!profiles.find(x => x.systemRole==='self')"))
            check('initial-page-errors', not page_errors)
            # A freshly chosen ephemeral origin must not inherit any previous
            # attachment row. A native pass cannot rely on old test data.
            check('fresh-native-attachment-stores', evaluate(page,
                'async () => (await pcMediaAllRows()).length===0 && (await pcWorkbookAllRows()).length===0'))
            seed = evaluate(page, r'''async () => {
              const me=selfProfileId(), owners=new Set(profiles.map(x=>x.id));
              if(!me)throw Error('self profile missing');
              const profile=runtimeProfileFromCanonical({id:'r187-pl',systemRole:'',
                identity:{name:'合成 PL',futureIdentity:{flag:false}},trpg:{startDate:'2025-01-01',futureTrpg:{zero:0}},
                ratings:{futureRating:{score:5,note:'虚构',futureEvidence:{part:1}}},
                futurePLRecord:{values:[0,false,'']}},settings);
              profiles.push(profile);owners.add(profile.id);
              settings=normalizeSettings({...settings,futureSettings:{zero:0,flags:[false,'']},
                ui:{...settings.ui,futureUi:{kind:'synthetic'}}});
              const pc=normalizePcArchive({id:'r187-pc',ownerPlId:profile.id,name:'合成规则角色',
                ruleMeta:{familyId:'saikoro-fiction',systemId:'insane',confirmed:true},
                ruleSheets:{insane:{traits:[],skills:[],resources:[],futureNested:{keep:true}}},
                avatarMediaId:'r187-image',galleryMediaIds:['r187-image'],
                excelSource:{kind:'fixed',fileName:'synthetic.xlsx',futureExcel:{preserve:true}},
                futurePC:{values:[0,false,'']}},owners);
              pcs.push(pc);
              // The native ZIP must preserve BOTH independently confirmed D&D editions.
              // This is fictional hand-entered data, never guessed original-card cells.
              for(const [i,edition,hp,species] of [[0,'5e-2014','024','合成甲族'],[1,'5e-2024','018','合成乙族']]){
                const draft=makeBlankPc(profile.id);draft.id='r187-dnd-'+i;draft.name='合成DND'+i;
                draft.ruleMeta={familyId:'d20-osr',systemId:'dnd',editionId:edition,confirmed:true,source:'user-selected'};
                for(const row of pcRuleEditableData(draft).resources){
                  if(row.label==='生命值')row.value=hp;
                  if(row.label==='种族／物种')row.value=species;
                  if(row.label==='等级')row.value=i===0?'4':'3';
                }
                pcs.push(normalizePcArchive(draft,owners));
              }
              modules.push(normalizeRichModule({id:'r187-module',name:'合成模组',rules:'Insane',futureModule:{tag:'keep'}},settings.moduleArchive));
              runPlans.push(normalizeRunPlan({id:'r187-plan',moduleId:'r187-module',moduleName:'合成模组',tableName:'计划',plIds:[profile.id],futureRun:{n:0}},owners));
              runRecords.push(normalizeRunRecord({id:'r187-record',moduleId:'r187-module',moduleName:'合成模组',tableName:'已归档',plIds:[profile.id],runNotes:'原始记录',futureRun:{keep:false}},owners));
              const pic=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
              const workbook=await pcMakeZipEntries([
                {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'},
                {name:'xl/workbook.xml',data:'<workbook/>'}
              ]);
              const wb=new Uint8Array(await workbook.arrayBuffer());
              await pcMediaPut({id:'r187-image',pcId:'r187-pc',name:'synthetic.png',type:'image/png',createdAt:1,
                blob:new Blob([pic],{type:'image/png'}),thumbBlob:new Blob([pic],{type:'image/png'}),futureMedia:{keep:0}});
              await pcWorkbookPut({pcId:'r187-pc',kind:'fixed',fileName:'synthetic.xlsx',createdAt:1,
                blob:new Blob([wb],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),futureWorkbook:{keep:false}});
              // Unlinked originals from a retired fictional PC must also survive the full ZIP.
              const oldPic=new Uint8Array([137,80,78,71,13,10,26,10,0,44,22]);
              const oldThumb=new Uint8Array([1,0,2,0]);
              await pcMediaPut({id:'r187-orphan-image',pcId:'r187-retired',name:'old-fiction.png',type:'image/png',createdAt:2,
                blob:new Blob([oldPic],{type:'image/png'}),thumbBlob:new Blob([oldThumb],{type:'image/webp'}),
                futureOrphan:{values:[0,false,'']}});
              await pcWorkbookPut({pcId:'r187-retired',kind:'fixed',fileName:'old-fiction.xlsx',createdAt:2,
                blob:new Blob([wb],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
                futureOrphanWorkbook:{values:[0,false,'']}});
              if(!saveState())throw Error('initial application save failed');
              const built=await buildUnifiedCompleteBackupBlob({includeWorkbooks:true});
              const file=new File([built.blob],'round187-synthetic.zip',{type:'application/zip'});
              const verified=await verifyCompleteBackupZipFile(file,built);
              const parsed=await parseUnifiedCompleteBackupFile(file);
              const evidence=completeBackupRuleEvidence(parsed.incoming);
              window.__r187Zip=file;
              sessionStorage.setItem('r187-source-evidence',evidence);
              const saved=localStorage.getItem(STORAGE_KEY);
              const a=await pcMediaAllRows(),b=await pcWorkbookAllRows();
              const hash=async blob=>backupSha256Bytes(new Uint8Array(await blob.arrayBuffer()));
              const attachmentEvidence=async(media,books)=>{
                const mediaRows=await Promise.all(media.map(async row=>({id:row.id,pcId:row.pcId,name:row.name,type:row.type,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:row.blob?await hash(row.blob):null,thumbType:row.thumbBlob?.type||'',thumbHash:row.thumbBlob?await hash(row.thumbBlob):null,
                  futureMedia:row.futureMedia??null,futureOrphan:row.futureOrphan??null})));
                const workbookRows=await Promise.all(books.map(async row=>({pcId:row.pcId,kind:row.kind,fileName:row.fileName,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:row.blob?await hash(row.blob):null,futureWorkbook:row.futureWorkbook??null,futureOrphanWorkbook:row.futureOrphanWorkbook??null})));
                mediaRows.sort((x,y)=>String(x.id).localeCompare(String(y.id)));workbookRows.sort((x,y)=>String(x.pcId).localeCompare(String(y.pcId)));
                return backupSha256Bytes(new TextEncoder().encode(JSON.stringify({mediaRows,workbookRows})));
              };
              sessionStorage.setItem('r187-media-hash',await hash(a.find(x=>x.id==='r187-image').blob));
              sessionStorage.setItem('r187-thumb-hash',await hash(a.find(x=>x.id==='r187-image').thumbBlob));
              sessionStorage.setItem('r187-book-hash',await hash(b.find(x=>x.pcId==='r187-pc').blob));
              sessionStorage.setItem('r187-orphan-media-hash',await hash(a.find(x=>x.id==='r187-orphan-image').blob));
              sessionStorage.setItem('r187-orphan-thumb-hash',await hash(a.find(x=>x.id==='r187-orphan-image').thumbBlob));
              sessionStorage.setItem('r187-orphan-book-hash',await hash(b.find(x=>x.pcId==='r187-retired').blob));
              return {save:!!saved,zip:built.blob.size>0,verified:verified.mediaCount===1&&verified.workbookCount===1,
                manifestOrphans:built.manifest.unlinkedAttachments?.media?.length===1&&built.manifest.unlinkedAttachments?.workbooks?.length===1,
                parsedOrphans:parsed.rows.some(x=>x.id==='r187-orphan-image')&&parsed.workbookRows.some(x=>x.pcId==='r187-retired'),
                parsed:!!parsed.incoming.pcs.find(x=>x.id==='r187-pc'),
                parsedDnd:['5e-2014','5e-2024'].every((e,i)=>{const x=parsed.incoming.pcs.find(v=>v.id==='r187-dnd-'+i);return x?.ruleMeta?.editionId===e&&pcRuleCurrentData(x).resources.some(r=>r.label==='生命值'&&r.value===(i?'018':'024'));}),
                nativeMedia:a.length===2,nativeWorkbooks:b.length===2,
                sourceExt:parsed.incoming.profiles.find(x=>x.id==='r187-pl')?.futurePLRecord?.values?.[1]===false,
                canonicalSource:built.archive.data.profiles.some(x=>x.id==='r187-pl'),
                evidenceHash:await backupSha256Bytes(new TextEncoder().encode(evidence)),
                attachmentEvidenceHash:await attachmentEvidence(a,b)};
            }''')
            source_evidence_hash=seed.pop('evidenceHash',None)
            source_attachment_hash=seed.pop('attachmentEvidenceHash',None)
            if source_evidence_hash: report['archive_evidence']={'source':source_evidence_hash}
            if source_attachment_hash: report['attachment_evidence']={'source':source_attachment_hash}
            for k,v in seed.items(): check('seed-'+k, bool(v))
            altered = evaluate(page, r'''() => {
              const p=profiles.find(x=>x.id==='r187-pl');p.contact='本轮临时修改';
              return !!saveState() && !!localStorage.getItem(STORAGE_KEY)?.includes('本轮临时修改');
            }''')
            check('divergent-live-data-before-restore',altered)
            # Real product modal, not appConfirm override. The confirmation is clicked on DOM.
            evaluate(page, r'''() => { window.__r187RestorePending=restoreUnifiedCompleteBackup(window.__r187Zip)
              .then(value=>({ok:value===true}),error=>({ok:false,error:String(error?.message||error)}));return true; }''')
            page.locator('#actionDialogBackdrop:not([hidden]) #actionDialogConfirm').wait_for(timeout=30000)
            check('visible-real-restore-confirmation', '恢复' in page.locator('#actionDialogTitle').inner_text())
            page.locator('#actionDialogConfirm').click()
            outcome = evaluate(page, 'async () => await window.__r187RestorePending')
            if not outcome.get('ok',False):
                # Only fictional test records enter the browser; retain a bounded
                # reason so CI failures can be located without requesting user data.
                report['restore_failure'] = str(outcome.get('error','Restore returned false'))[:300]
            check('real-restore-committed',outcome.get('ok',False))
            check('restore-source-evidence',evaluate(page,"() => completeBackupRuleEvidence({settings,profiles,pcs,modules,runPlans,runRecords})===sessionStorage.getItem('r187-source-evidence')"))
            check('no-transaction-marker',evaluate(page,'() => PLDataMigrationTransaction.getMarker(localStorage)===null'))
            # Reload uses the actual app bootstrap, new JS memory, same isolated origin.
            page.reload(wait_until='domcontentloaded',timeout=90000)
            page.wait_for_function("typeof buildUnifiedCompleteBackupBlob === 'function' && Array.isArray(profiles)",timeout=30000)
            check('reload-fresh-js',not page_errors)
            # Synthetic-only startup diagnostic. Round187 always uses an ephemeral
            # isolated origin seeded by this script, so this reports no user data.
            # Keep it structural/bounded: identify which startup layer rejected the
            # just-restored canonical archive without dumping archive field values.
            reload_diagnostic = evaluate(page, r'''() => {
              const out={
                migrationReadOnlyKind:String(migrationReadOnly?.kind||''),
                migrationReadOnlyReason:String(migrationReadOnly?.reason||'').slice(0,180),
                startupSource:String(startupDataReport?.source||''),
                startupError:String(startupDataReport?.error||'').slice(0,260),
                guard:'not-run',integrity:'not-run',hydrate:'not-run',ensure:'not-run',manualEvidenceMatch:false
              };
              const safeError=e=>String(e?.message||e||'unknown').slice(0,260);
              let raw=null;
              try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');out.parse='ok';}
              catch(e){out.parse='fail:'+safeError(e);return out;}
              try{PLDataMigrationGuard.requireReadable(raw);out.guard='ok';}
              catch(e){out.guard='fail:'+safeError(e);}
              try{assertCanonicalIntegrity(raw);out.integrity='ok';}
              catch(e){out.integrity='fail:'+safeError(e);}
              let hydrated=null;
              try{hydrated=hydrateCanonicalArchive(raw);out.hydrate='ok';}
              catch(e){out.hydrate='fail:'+safeError(e);}
              if(hydrated){
                try{const ensured=ensureSelfProfileAndLinks(hydrated);out.ensure='ok';
                  out.manualEvidenceMatch=completeBackupRuleEvidence(ensured)===sessionStorage.getItem('r187-source-evidence');}
                catch(e){out.ensure='fail:'+safeError(e);}
              }
              return out;
            }''')
            report['reload_diagnostic']=reload_diagnostic
            final = evaluate(page, r'''async () => {
              const original=sessionStorage.getItem('r187-source-evidence');
              const saved=localStorage.getItem(STORAGE_KEY),raw=JSON.parse(saved);
              const live={settings,profiles,pcs,modules,runPlans,runRecords};
              const hash=async blob=>backupSha256Bytes(new Uint8Array(await blob.arrayBuffer()));
              const attachmentEvidence=async(media,books)=>{
                const mediaRows=await Promise.all(media.map(async row=>({id:row.id,pcId:row.pcId,name:row.name,type:row.type,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:row.blob?await hash(row.blob):null,thumbType:row.thumbBlob?.type||'',thumbHash:row.thumbBlob?await hash(row.thumbBlob):null,
                  futureMedia:row.futureMedia??null,futureOrphan:row.futureOrphan??null})));
                const workbookRows=await Promise.all(books.map(async row=>({pcId:row.pcId,kind:row.kind,fileName:row.fileName,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:row.blob?await hash(row.blob):null,futureWorkbook:row.futureWorkbook??null,futureOrphanWorkbook:row.futureOrphanWorkbook??null})));
                mediaRows.sort((x,y)=>String(x.id).localeCompare(String(y.id)));workbookRows.sort((x,y)=>String(x.pcId).localeCompare(String(y.pcId)));
                return backupSha256Bytes(new TextEncoder().encode(JSON.stringify({mediaRows,workbookRows})));
              };
              const images=await pcMediaAllRows(),books=await pcWorkbookAllRows(),image=images.find(x=>x.id==='r187-image'),book=books.find(x=>x.pcId==='r187-pc'),orphan=images.find(x=>x.id==='r187-orphan-image'),oldBook=books.find(x=>x.pcId==='r187-retired');
              const second=await buildUnifiedCompleteBackupBlob({includeWorkbooks:true});
              const file=new File([second.blob],'round187-second.zip',{type:'application/zip'});
              const verdict=await verifyCompleteBackupZipFile(file,second), parsed=await parseUnifiedCompleteBackupFile(file);
              return {saved:!!saved,canonical:isCanonicalArchive(raw),
                sourceEvidence:completeBackupRuleEvidence(live)===original,
                secondEvidence:completeBackupRuleEvidence(parsed.incoming)===original,
                dndNative:['5e-2014','5e-2024'].every((e,i)=>{const x=pcs.find(v=>v.id==='r187-dnd-'+i);return x?.ruleMeta?.editionId===e&&pcRuleCurrentData(x).resources.some(r=>r.label==='生命值'&&r.value===(i?'018':'024'));}),
                dndSecondZip:['5e-2014','5e-2024'].every((e,i)=>{const x=parsed.incoming.pcs.find(v=>v.id==='r187-dnd-'+i);return x?.ruleMeta?.editionId===e&&pcRuleCurrentData(x).resources.some(r=>r.label==='生命值'&&r.value===(i?'018':'024'));}),
                fields:profiles.find(x=>x.id==='r187-pl')?.futurePLRecord?.values?.[2]==='' &&
                  settings?.futureSettings?.flags?.[0]===false && pcs.find(x=>x.id==='r187-pc')?.futurePC?.values?.[0]===0,
                restoredKnown:profiles.find(x=>x.id==='r187-pl')?.contact!=='本轮临时修改',
                nativeImage:!!image && (await hash(image.blob))===sessionStorage.getItem('r187-media-hash'),
                nativeThumb:!!image?.thumbBlob && (await hash(image.thumbBlob))===sessionStorage.getItem('r187-thumb-hash'),
                nativeWorkbook:!!book && (await hash(book.blob))===sessionStorage.getItem('r187-book-hash'),
                metadata:image?.futureMedia?.keep===0&&book?.futureWorkbook?.keep===false,
                orphanImage:!!orphan&&(await hash(orphan.blob))===sessionStorage.getItem('r187-orphan-media-hash'),
                orphanThumbnail:!!orphan?.thumbBlob&&(await hash(orphan.thumbBlob))===sessionStorage.getItem('r187-orphan-thumb-hash'),
                orphanWorkbook:!!oldBook&&(await hash(oldBook.blob))===sessionStorage.getItem('r187-orphan-book-hash'),
                orphanMetadata:orphan?.futureOrphan?.values?.[1]===false&&oldBook?.futureOrphanWorkbook?.values?.[0]===0,
                secondZip:second.blob.size>0&&verdict.mediaCount===1&&verdict.workbookCount===1,
                secondOrphans:second.manifest.unlinkedAttachments?.media?.length===1&&second.manifest.unlinkedAttachments?.workbooks?.length===1&&parsed.rows.some(x=>x.id==='r187-orphan-image')&&parsed.workbookRows.some(x=>x.pcId==='r187-retired'),
                marker:PLDataMigrationTransaction.getMarker(localStorage)===null,
                readOnly:!migrationReadOnly, count:images.length===2&&books.length===2,
                nativeEvidenceHash:await backupSha256Bytes(new TextEncoder().encode(completeBackupRuleEvidence(live))),
                secondEvidenceHash:await backupSha256Bytes(new TextEncoder().encode(completeBackupRuleEvidence(parsed.incoming))),
                nativeAttachmentEvidenceHash:await attachmentEvidence(images,books),
                secondAttachmentEvidenceHash:await attachmentEvidence(parsed.rows,parsed.workbookRows)};
            }''')
            native_evidence_hash=final.pop('nativeEvidenceHash',None)
            second_evidence_hash=final.pop('secondEvidenceHash',None)
            native_attachment_hash=final.pop('nativeAttachmentEvidenceHash',None)
            second_attachment_hash=final.pop('secondAttachmentEvidenceHash',None)
            if native_evidence_hash: report.setdefault('archive_evidence',{})['reloaded_native']=native_evidence_hash
            if second_evidence_hash: report.setdefault('archive_evidence',{})['second_zip']=second_evidence_hash
            if native_attachment_hash: report.setdefault('attachment_evidence',{})['reloaded_native']=native_attachment_hash
            if second_attachment_hash: report.setdefault('attachment_evidence',{})['second_zip']=second_attachment_hash
            for k,v in final.items(): check('reload-'+k,bool(v))
            # Corruption is rejected BEFORE a restore writes any existing data.
            corruption = evaluate(page,r'''async () => {
              const before=localStorage.getItem(STORAGE_KEY);
              // Archive equality alone is not enough: rejected imports must not
              // mutate linked OR unlinked native attachment rows or their metadata.
              const attachmentEvidence=async()=>{
                const hash=async blob=>blob?await backupSha256Bytes(new Uint8Array(await blob.arrayBuffer())):null;
                const media=await pcMediaAllRows(),books=await pcWorkbookAllRows();
                const imageRows=await Promise.all(media.map(async row=>({
                  id:row.id,pcId:row.pcId,name:row.name,type:row.type,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:await hash(row.blob),
                  thumbType:row.thumbBlob?.type||'',thumbHash:await hash(row.thumbBlob),
                  futureMedia:row.futureMedia??null,futureOrphan:row.futureOrphan??null
                })));
                const workbookRows=await Promise.all(books.map(async row=>({
                  pcId:row.pcId,kind:row.kind,fileName:row.fileName,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:await hash(row.blob),
                  futureWorkbook:row.futureWorkbook??null,futureOrphanWorkbook:row.futureOrphanWorkbook??null
                })));
                imageRows.sort((x,y)=>String(x.id).localeCompare(String(y.id)));
                workbookRows.sort((x,y)=>String(x.pcId).localeCompare(String(y.pcId)));
                return JSON.stringify({imageRows,workbookRows});
              };
              const beforeAttachments=await attachmentEvidence();
              const source=await buildUnifiedCompleteBackupBlob({includeWorkbooks:true});
              const entries=await pcExcelUnzip(await source.blob.arrayBuffer(),{kind:'backup'});
              const damaged=new Uint8Array(entries['archive.json']);damaged[0]=0x21;
              entries['archive.json']=damaged;
              const broken=await pcMakeZipEntries(Object.entries(entries).map(([name,data])=>({name,data})));
              let rejected=false;
              try{await restoreUnifiedCompleteBackup(new File([broken],'corrupt.zip',{type:'application/zip'}));}
              catch(_){rejected=true;}
              // A syntactically valid ZIP with an omitted listed attachment is a
              // distinct failure mode from corrupt archive.json. Exercise both
              // linked originals and a retired character's orphan thumbnail.
              const listed=JSON.parse(new TextDecoder().decode(entries['manifest.json']));
              const missingPaths=[listed.media?.[0]?.path,listed.workbooks?.[0]?.path,
                listed.unlinkedAttachments?.media?.[0]?.thumbPath];
              let missingAttachmentsRejected=missingPaths.length===3&&missingPaths.every(Boolean);
              for(const missingPath of missingPaths){
                if(!missingPath||!entries[missingPath]){missingAttachmentsRejected=false;break;}
                const omitted={...entries};delete omitted[missingPath];
                const incomplete=await pcMakeZipEntries(Object.entries(omitted).map(([name,data])=>({name,data})));
                let blocked=false;
                try{await restoreUnifiedCompleteBackup(new File([incomplete],'incomplete.zip',{type:'application/zip'}));}
                catch(_){blocked=true;}
                if(!blocked){missingAttachmentsRejected=false;break;}
              }
              return {rejected,missingAttachmentsRejected,
                archiveUnchanged:before===localStorage.getItem(STORAGE_KEY),
                attachmentsUnchanged:beforeAttachments===await attachmentEvidence(),
                noMarker:PLDataMigrationTransaction.getMarker(localStorage)===null};
            }''')
            for name,passed in corruption.items():
                check('corrupt-'+name,bool(passed))
            # Reopen after a rejected archive, not just before it: a late
            # asynchronous write must not silently change the recovered archive.
            page.reload(wait_until='domcontentloaded',timeout=90000)
            page.wait_for_function("typeof buildUnifiedCompleteBackupBlob === 'function' && Array.isArray(profiles)",timeout=30000)
            post_rejection = evaluate(page, r'''async () => {
              const media=await pcMediaAllRows(),books=await pcWorkbookAllRows();
              const hash=async blob=>blob?await backupSha256Bytes(new Uint8Array(await blob.arrayBuffer())):null;
              const attachmentEvidence=async(mediaRowsInput,bookRowsInput)=>{
                const mediaRows=await Promise.all(mediaRowsInput.map(async row=>({id:row.id,pcId:row.pcId,name:row.name,type:row.type,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:await hash(row.blob),thumbType:row.thumbBlob?.type||'',thumbHash:await hash(row.thumbBlob),futureMedia:row.futureMedia??null,futureOrphan:row.futureOrphan??null})));
                const workbookRows=await Promise.all(bookRowsInput.map(async row=>({pcId:row.pcId,kind:row.kind,fileName:row.fileName,createdAt:row.createdAt,
                  blobType:row.blob?.type||'',blobHash:await hash(row.blob),futureWorkbook:row.futureWorkbook??null,futureOrphanWorkbook:row.futureOrphanWorkbook??null})));
                mediaRows.sort((x,y)=>String(x.id).localeCompare(String(y.id)));workbookRows.sort((x,y)=>String(x.pcId).localeCompare(String(y.pcId)));
                return backupSha256Bytes(new TextEncoder().encode(JSON.stringify({mediaRows,workbookRows})));
              };
              const image=media.find(x=>x.id==='r187-image'),orphan=media.find(x=>x.id==='r187-orphan-image');
              const book=books.find(x=>x.pcId==='r187-pc'),oldBook=books.find(x=>x.pcId==='r187-retired');
              return {
                archive:completeBackupRuleEvidence({settings,profiles,pcs,modules,runPlans,runRecords})===sessionStorage.getItem('r187-source-evidence'),
                dndStillDistinct:['5e-2014','5e-2024'].every((e,i)=>{const x=pcs.find(v=>v.id==='r187-dnd-'+i);return x?.ruleMeta?.editionId===e&&pcRuleCurrentData(x).resources.some(r=>r.label==='种族／物种'&&r.value===(i?'合成乙族':'合成甲族'));}),
                media:media.length===2&&!!image&&(await hash(image.blob))===sessionStorage.getItem('r187-media-hash'),
                thumbnails:!!image?.thumbBlob&&(await hash(image.thumbBlob))===sessionStorage.getItem('r187-thumb-hash'),
                workbook:books.length===2&&!!book&&(await hash(book.blob))===sessionStorage.getItem('r187-book-hash'),
                unlinked:!!orphan&&!!oldBook&&(await hash(orphan.blob))===sessionStorage.getItem('r187-orphan-media-hash')&&
                  (await hash(orphan.thumbBlob))===sessionStorage.getItem('r187-orphan-thumb-hash')&&
                  (await hash(oldBook.blob))===sessionStorage.getItem('r187-orphan-book-hash'),
                noMarker:PLDataMigrationTransaction.getMarker(localStorage)===null,
                evidenceHash:await backupSha256Bytes(new TextEncoder().encode(completeBackupRuleEvidence({settings,profiles,pcs,modules,runPlans,runRecords}))),
                attachmentEvidenceHash:await attachmentEvidence(media,books)
              };
            }''')
            post_evidence_hash=post_rejection.pop('evidenceHash',None)
            post_attachment_hash=post_rejection.pop('attachmentEvidenceHash',None)
            if post_evidence_hash: report.setdefault('archive_evidence',{})['post_rejected_reload']=post_evidence_hash
            if post_attachment_hash: report.setdefault('attachment_evidence',{})['post_rejected_reload']=post_attachment_hash
            for name,passed in post_rejection.items():
                check('post-rejected-reload-'+name,bool(passed))
            check('no-external-network-attempts',report['external_requests_blocked']==0)
            report['status']='PASS'
            report['phase']='finished'
            context.close()
        finally:
            # Save a synthetic-only screenshot even if the application threw.
            # A blocked navigation may yield a browser error page; it is still
            # evidence, not a passing native recovery.
            if page is not None:
                try:
                    page.screenshot(path=str(REPORT/'round187-last-page.png'), full_page=True, timeout=5000)
                    report['screenshot']='round187-last-page.png'
                except Exception:
                    report['screenshot']='unavailable'
            browser.close()
except Exception as error:
    message=str(error)
    # Environment policy denial is not a test pass or an application defect.
    # It remains a non-zero exit and stays visible in the CI release gate.
    report['status']='BLOCKED' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in message else 'FAIL'
    # No ZIP, archive data, or binary contents in these diagnostics.
    report['failure']={'type':type(error).__name__,'message':message[:500]}
finally:
    report['checks']=checks
    report['passed']=len(checks)
    (REPORT/'round187-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    server.shutdown()
print(json.dumps(report,ensure_ascii=False))
if report['status']!='PASS':raise SystemExit(1)
