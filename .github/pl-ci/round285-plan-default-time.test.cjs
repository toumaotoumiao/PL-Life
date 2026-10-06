const fs=require('fs'),path=require('path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8')),currentVersion=status.current.appVersion;
function block(name,next){const start=html.indexOf(`function ${name}`);assert.notEqual(start,-1,`${name} missing`);const end=next?html.indexOf(`function ${next}`,start+1):html.indexOf('\nfunction ',start+1);return html.slice(start,end<0?start+16000:end);}

test('plan default exact-time preset is normalized and stored without schema bump',()=>{
  assert.ok(html.includes('function normalizePlanSchedulePreset(raw)'));
  const normalize=block('normalizeRunPlan','makeBlankRunPlan');
  assert.ok(normalize.includes('schedulePreset: normalizePlanSchedulePreset'));
  const blank=block('makeBlankRunPlan','isMeaningfulRunPlan');
  assert.ok(blank.includes('schedulePreset: normalizePlanSchedulePreset(null)'));
  assert.ok(html.includes(`const APP_UI_VERSION = "${currentVersion}";`));
  assert.ok(html.includes('const DATA_SCHEMA_VERSION = 26;'));
});

test('manual placement copies preset into a new occurrence while moving preserves its override',()=>{
  const schedule=block('schedulePlanOnDaypart','movePlanSlotToDaypart');
  assert.ok(schedule.includes('const preset = planSchedulePreset(target)'));
  assert.ok(schedule.includes('slot.startTime = preset.startTime'));
  assert.ok(schedule.includes('slot.endTime = preset.endTime'));
  const move=block('movePlanSlotToDaypart','reorderPlanSlotRelative');
  assert.ok(move.includes('slot.date = dateStr'));
  assert.ok(move.includes('slot.daypart = part.key'));
  assert.ok(!move.includes('slot.startTime ='), 'moving an occurrence must not reset its custom start time');
  assert.ok(!move.includes('slot.endTime ='), 'moving an occurrence must not reset its custom end time');
});

test('plan editor provides default times, per-occurrence overrides and explicit sync actions',()=>{
  for(const token of [
    'data-plan-schedule-preset-start','data-plan-schedule-preset-end','data-editor-clear-schedule-preset',
    'data-editor-apply-schedule-preset','data-editor-slot-start','data-editor-slot-end','data-editor-use-schedule-preset'
  ]) assert.ok(html.includes(token),token);
  assert.ok(html.includes('修改这里不会偷偷改动已经安排好的场次。'));
  assert.ok(html.includes('每次安排仍可单独修改。'));
  assert.ok(html.includes('应用到已有安排'));
  assert.ok(html.includes('套用默认'));
});

test('editor input mutations keep preset and each scheduled occurrence independent',()=>{
  assert.ok(html.includes('queuePlanInputMutation(planId, plan => { const preset=normalizePlanSchedulePreset(plan.schedulePreset); preset[field]=value; plan.schedulePreset=preset; }'));
  assert.ok(html.includes('const slot=(plan.timeSlots||[]).find(s=>String(s.id)===String(slotId)); if(slot) slot[field]=value;'));
  assert.ok(html.includes('if(slot.date){slot.startTime=p.startTime;slot.endTime=p.endTime;}'));
  assert.ok(html.includes('if(slot){slot.startTime=p.startTime;slot.endTime=p.endTime;}'));
});

test('one-click periodic scheduling prefers the plan preset and calendar displays exact occurrence time',()=>{
  const draft=block('makePeriodicDraft','periodicDraftFromBatch');
  assert.ok(draft.includes('(planSchedulePresetReady(source) ? preset.startTime : "")'));
  assert.ok(draft.includes('(planSchedulePresetReady(source) ? preset.endTime : "")'));
  const sync=block('syncPeriodicDraftFromSource','openPeriodicSchedule');
  assert.ok(sync.includes('if(planSchedulePresetReady(plan))'));
  assert.ok(sync.includes('periodicScheduleDraft.startTime=preset.startTime'));
  assert.ok(sync.includes('periodicScheduleDraft.endTime=preset.endTime'));
  assert.ok(html.includes('slot.startTime&&slot.endTime?escapeHTML(slot.startTime)+\'–\'+escapeHTML(slot.endTime):part.label'));
});

test('release history keeps Stage113 plan-time note distinct from the current release',()=>{
  const currentToken=currentVersion.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const current=(html.match(new RegExp(`<strong class=\"version-log-version\">v${currentToken}<\\/strong>`,'g'))||[]).length;
  const stage113=(html.match(/<strong class="version-log-version">v8\.1\.12\.291<\/strong>/g)||[]).length;
  const prior=(html.match(/<strong class="version-log-version">v8\.1\.12\.290<\/strong>/g)||[]).length;
  assert.equal(current,1,'current release note should occur once');
  assert.equal(stage113,1,'Stage113 plan-time release note must remain once');
  assert.ok(prior>=1,'prior 290 release note must remain in history');
});
