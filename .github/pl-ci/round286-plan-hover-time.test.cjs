const fs=require('fs'),path=require('path'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
function block(name,next){const start=html.indexOf(`function ${name}`);assert.notEqual(start,-1,`${name} missing`);const end=next?html.indexOf(`function ${next}`,start+1):html.indexOf('\nfunction ',start+1);return html.slice(start,end<0?start+18000:end);}

test('calendar occurrence quick-time editor is present without a schema bump',()=>{
  for(const token of ['planner-quick-time-popover','data-quick-time-start','data-quick-time-end','data-quick-time-save','data-quick-time-default','data-quick-time-clear'])assert.ok(html.includes(token),token);
  assert.ok(html.includes('const DATA_SCHEMA_VERSION = 26;'));
  assert.ok(html.includes('const APP_UI_VERSION = "8.1.12.293";'));
});

test('desktop hover and direct time click both open the quick editor',()=>{
  assert.ok(html.includes('matchMedia("(hover:hover) and (pointer:fine)")'));
  assert.ok(html.includes('els.planWeek.addEventListener("pointerover"'));
  assert.ok(html.includes('openPlannerQuickTimePopover(event)'));
  assert.ok(html.includes('const quickTime = e.target.closest(".calendar-event-time")'));
  assert.ok(html.includes('openPlannerQuickTimePopover(event, { focus: true })'));
});

test('quick editor changes only the addressed occurrence time',()=>{
  const start=html.indexOf('function savePlannerQuickTimeOccurrence');
  const end=html.indexOf('\nif (els?.planWeek)',start);
  assert.notEqual(start,-1);assert.ok(end>start);
  const save=html.slice(start,end);
  assert.ok(save.includes('(plan.timeSlots || []).find'));
  assert.ok(save.includes('slot.startTime = verdict.startTime'));
  assert.ok(save.includes('slot.endTime = verdict.endTime'));
  assert.ok(!save.includes('plan.schedulePreset='));
  assert.ok(!save.includes('slot.date ='));
  assert.ok(!save.includes('slot.daypart ='));
});

test('quick editor validates paired exact time and supports clearing/defaulting explicitly',()=>{
  const validate=block('plannerQuickTimeValidation','ensurePlannerQuickTimePopover');
  assert.ok(validate.includes('请同时填写开始和结束时间。'));
  assert.ok(validate.includes('开始和结束时间不能相同。'));
  assert.ok(validate.includes('清除后日历显示早 / 中 / 晚。'));
  const ensure=block('ensurePlannerQuickTimePopover','positionPlannerQuickTimePopover');
  assert.ok(ensure.includes('planSchedulePresetReady(row.plan)'));
  assert.ok(ensure.includes('savePlannerQuickTimeOccurrence(state.planId, state.slotId, "", ""'));
});

test('popover is viewport-contained and cannot interfere with dragging/share mode',()=>{
  const position=block('positionPlannerQuickTimePopover','openPlannerQuickTimePopover');
  assert.ok(position.includes('window.innerWidth'));
  assert.ok(position.includes('window.innerHeight'));
  const open=block('openPlannerQuickTimePopover','closePlannerQuickTimePopover');
  assert.ok(open.includes('plannerDraggedSchedule || plannerDraggedPlanId || shareModeEnabled'));
  assert.ok(html.includes('els.planWeek.addEventListener("dragstart", e => {\n    closePlannerQuickTimePopover();'));
});
