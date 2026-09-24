const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=require(path.join(root,'showcase-core.js'));

test('free-lane pack keeps column heights independent and supports spanning groups',()=>{
  assert.equal(typeof core.packFreeLanes,'function');
  const packed=core.packFreeLanes([
    {id:'A',lane:0,span:1,height:300},
    {id:'B',lane:1,span:1,height:80},
    {id:'C',lane:1,span:1,height:80},
    {id:'D',lane:1,span:2,height:60},
  ],{laneCount:3,startY:100,gap:10});
  const by=Object.fromEntries(packed.placements.map(x=>[x.id,x]));
  assert.equal(by.A.y,100);
  assert.equal(by.B.y,100);
  assert.equal(by.C.y,190,'same lane should stack directly after B, not wait for tall A');
  assert.equal(by.D.y,280,'span-2 item should wait for both lane 2 and 3 at their current heights');
  assert.ok(by.C.y < by.A.y + by.A.height,'lane 2 continues before tall lane 1 is finished');
});

test('dragging into another lane inserts instead of swapping',()=>{
  assert.equal(typeof core.insertIntoFreeLane,'function');
  const state=core.insertIntoFreeLane(['ho1','ho2','none','ho4'],{
    ho1:{lane:0,span:1},ho2:{lane:0,span:1},none:{lane:2,span:1},ho4:{lane:1,span:1}
  },{sourceId:'ho1',targetId:'none',targetLane:2,after:false,laneCount:3});
  assert.deepEqual(state.order,['ho2','ho1','none','ho4']);
  assert.equal(state.layout.ho1.lane,2);
  assert.equal(state.layout.none.lane,2);
  // Insertion keeps the target item; it does not swap target back to source lane.
  assert.equal(state.layout.none.lane,2);
});

test('organizer export exposes free columns, spans, locks and style-specific persistence',()=>{
  for(const token of [
    'tomato_pl_organizer_export_free_layout_v2',
    'hoOrganizerFreeLaneCount',
    "style==='wide'?3:2",
    'data-ho-layout-lane',
    'data-ho-layout-span',
    'data-ho-layout-lock',
    'data-ho-layout-auto="balance"',
    'data-ho-layout-auto="compact"',
    '独立列瀑布',
    '拖到某列空白处会移入该列',
    'packFreeLanes',
    'insertIntoFreeLane'
  ]) assert.ok(html.includes(token),`missing ${token}`);
  assert.match(html,/pl:\{wide:null,long:null\},kp:\{wide:null,long:null\}/);
  assert.match(html,/if\(style==='long'\)return\{lane:0,span:lanes,locked:false\}/);
});

test('automatic layout preserves explicit locks and manual layout controls remain fallbacks',()=>{
  assert.match(html,/if\(spec\.locked\)\{spec\.lane=/);
  assert.match(html,/if\(!spec\.locked&&kind==='balance'\)spec\.span=1/);
  assert.ok(html.includes('固定此列，自动整理不移动'));
  assert.ok(html.includes('data-ho-lane-move="-1"'));
  assert.ok(html.includes('data-ho-lane-move="1"'));
});
