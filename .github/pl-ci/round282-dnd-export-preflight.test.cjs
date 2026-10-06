const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('D&D real export routes through a final preflight before any download',()=>{
  assert.match(html,/return pcDndExportCheckOpen\(file,draft,\{bindTemplate:false,identityCombatMap:row\.identityCombatMap\|\|null\}\)/);
  assert.match(html,/pcFooterDndTemplateInput'\)\?\.addEventListener\('change'.*pcDndExportCheckOpen\(file,draft,\{bindTemplate:true\}\)/s);
  assert.match(html,/async function pcDndExportCheckConfirm\(\)[\s\S]*pcExportDndTemplateWorkbook\(payload\.file,payload\.pc,\{bindTemplate:payload\.bindTemplate,identityCombatMap:payload\.identityCombatMap,acceptanceAudit:payload\.audit\}\)/);
});

test('preflight audit aggregates coverage and blockers without rendering character values',()=>{
  const audit=(html.match(/function pcDndExportAuditFromSheets\([\s\S]*?\n}\nlet pcDndExportCheckSession=/)||[])[0]||'';
  assert.ok(audit.includes("abilities={ready:0,filled:0,total:6,skipped:0}"));
  assert.ok(audit.includes("fixed={mapped:0,exportable:0,total:7}"));
  assert.ok(audit.includes("skills={mapped:0,exportable:0,total:"));
  assert.ok(audit.includes("blockers.length===0&&totalWrite>0"));
  const render=(html.match(/function pcDndExportCheckHTML\([\s\S]*?\n}\nfunction pcDndExportCheckRender/)||[])[0]||'';
  assert.ok(render.includes("'阻断项'"));
  assert.ok(render.includes('audit.totalWrite'));
  assert.ok(!render.includes('pcDndExtendedExportValue('));
  assert.ok(!render.includes('pcDndIdentityCombatExportValue('));
});

test('dangerous fixed mappings cannot overwrite six-ability or label protected cells',()=>{
  const validate=(html.match(/function pcDndIdentityCombatMapValidate\([\s\S]*?return \{map,verified,extraVerified\};\n}/)||[])[0]||'';
  assert.ok(validate.includes('protectedTargets.has(key)'));
  assert.match(validate,/目标格 \$\{ref\} 属于已保护的标签／六属性区域/);
  const audit=(html.match(/function pcDndExportAuditFromSheets\([\s\S]*?\n}\nlet pcDndExportCheckSession=/)||[])[0]||'';
  assert.ok(audit.includes('protectedTargets.has(key)'));
});

test('preflight is a managed modal and only the explicit confirm path commits export',()=>{
  for(const token of ['pcDndExportCheckBackdrop','data-pc-dnd-export-check-confirm','data-pc-dnd-export-check-close','data-pc-dnd-export-check-map'])assert.ok(html.includes(token),`missing ${token}`);
  const modalIds=(html.match(/const MODAL_SURFACE_IDS = \[[\s\S]*?\];/)||[])[0]||'';
  assert.ok(modalIds.includes('"pcDndExportCheckBackdrop"'));
  const close=(html.match(/function closeHistorySurfaceById\([\s\S]*?return false;\n}/)||[])[0]||'';
  assert.ok(close.includes('pcDndExportCheckClose()'));
  const a=html.indexOf('async function pcDndExportCheckOpen('),b=html.indexOf('async function pcDndExportCheckConfirm(',a),open=a>=0&&b>a?html.slice(a,b):'';
  assert.ok(open&& !open.includes('downloadBlobFile('));
});
