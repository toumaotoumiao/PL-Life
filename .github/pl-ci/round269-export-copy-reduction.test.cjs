'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'production-release-manifest.json'),'utf8'));
const active=html.replace(/<details class="version-history-details"[\s\S]*?<\/details>/g,'').split('\n').filter(line=>!line.includes('"legacy.exact.')&&!line.includes('"legacy.pattern.')).join('\n');

test('image-export editors remove redundant helper prose while retaining control labels',()=>{
  const obsolete=[
    '常用组合</span>','勾选、排序、设置宽度','拖动调整顺序及栏位。','控制留白与页数','控制公开内容',
    '选择输出形式','选择导出列数','控制分组展开状态','默认均衡；拖动分组可跨列，列数不强制均分。',
    '设置列、跨度与固定状态。','拖动只调整导出布局，不改写记录。','整理这一桌的日期、人物、Log 与感想。',
    '确认公开内容和排版后再导出。','选择页面与公开细节，右侧实时预览。','与最终图片一致。',
    '按当前筛选、年份或全部记录生成连续回顾。','复用跑团记录当前筛选','连续滚动查看全部页面。',
    '图片导出可选择简版／标准／完整档案；HTML 与独立档案压缩包不再作为主导出格式。'
  ];
  for(const phrase of obsolete)assert.ok(!active.includes(phrase),`redundant export copy returned: ${phrase}`);
  for(const label of ['快捷组合','内容与版面','信息密度','公开内容','展示方式','导出列数','内容状态','列布局','分组','实时预览'])assert.ok(active.includes(label),`missing concise control label: ${label}`);
});

test('privacy and Log-address risks remain explicit but concise',()=>{
  assert.match(active,/隐私导出：开启/);
  assert.match(active,/隐私导出：关闭/);
  assert.match(active,/Log 地址会原样写入图片/);
});

test('runtime, service-worker, manifest and canonical status use one current version',()=>{
  const app=html.match(/const APP_UI_VERSION\s*=\s*["']([^"']+)/)?.[1];
  const cache=sw.match(/CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`/)?.[1];
  assert.ok(app);
  assert.equal(status.current.appVersion,app);
  assert.equal(manifest.appVersion,app);
  assert.equal(cache,app);
});

test('recent version history remains continuous after Stage95 cleanup',()=>{
  const pos=['v8.1.12.274','v8.1.12.273','v8.1.12.272','v8.1.12.271'].map(v=>html.indexOf(`>${v}</strong>`));
  for(const p of pos)assert.ok(p>=0,'missing recent release history item');
  assert.ok(pos.every((p,i)=>i===0||pos[i-1]<p),'recent release history order is broken');
});
