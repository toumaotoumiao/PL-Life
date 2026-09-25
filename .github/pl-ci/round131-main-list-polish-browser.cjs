'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const fixture=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>
<section id="profilesView" style="max-width:650px;margin:8px auto;display:block"><article class="card"><div class="card-top"><div class="person"><div class="name">这是一个中文与 Supercalifragilisticexpialidocious 混合的长名字示例</div><div class="contact">测试联系信息 incrediblylongcontactreference@example.invalid</div><div class="profile-meta"><div class="profile-meta-row">起始时间与公开信息</div></div><div class="profile-remark">备注内容测试，用来检查行高和换行。</div></div><div class="score-badge"><div class="score-label">综合评分</div><div class="score-value">5.5</div></div></div><div class="attrs"><div class="attr"><div class="attr-label">跑团偏好</div><div class="attr-text">文字测试</div></div></div><div class="runs"><details class="runs-details"><summary>跑团整理 · 12 桌</summary></details></div><div class="card-actions profile-primary-actions"><button class="btn small">PC</button><button class="btn small">跑团整理</button><details class="profile-secondary-actions"><summary class="btn small">•••</summary></details></div></article></section>
<section id="pcsView" style="max-width:650px;margin:8px auto;display:block"><div class="pc-grid" id="pcGrid"><article class="pc-card"><div class="pc-card-head"><div><div class="pc-card-title"><strong>这是一个中文与 Supercalifragilisticexpialidocious 混合的长 PC 名字</strong><span class="pc-status-badge active">进行中</span></div><div class="pc-card-owner">所属 PL：测试用户</div><div class="pc-meta-line"><span>1920 年 · 医生 · 调查员</span></div></div><div class="pc-avatar">测</div></div><div class="pc-core-stats"><div class="pc-core-stat"><span>STR</span><strong>50</strong></div><div class="pc-core-stat"><span>CON</span><strong>55</strong></div><div class="pc-core-stat"><span>DEX</span><strong>75</strong></div><div class="pc-core-stat"><span>APP</span><strong>65</strong></div><div class="pc-core-stat"><span>POW</span><strong>80</strong></div></div><div class="pc-relation-tail"><div class="pc-relation-tail-more">关联模组和经历</div></div></article></div></section>
<section id="modulesView" style="max-width:650px;margin:8px auto;display:block"><article class="native-module-card"><div class="native-module-card-head"><div><h3>这是一份带有 Supercalifragilisticexpialidocious 字符的模组长标题</h3><span>作者：测试作者</span></div><div class="native-module-score"><span>评分</span><strong>5.5</strong></div></div><div class="native-module-tags"><span>地点 日本</span><span>时代 现代</span><span>1人</span><span>有 HO</span><span>4–6小时</span><span>文字团</span><span>愿意再带</span></div><div class="native-module-runline"><span>5 桌经历</span><span>KP 5</span><span>PL 0</span></div><div class="native-module-card-actions"><button class="btn small">跑团记录</button><details class="native-module-more"><summary class="btn small">•••</summary></details></div></article></section>
</body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [1440,900,390,320]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.setContent(fixture);
   const data=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect();
    const font=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
    const visibility=s=>getComputedStyle(document.querySelector(s)).display;
    return {overflow:document.documentElement.scrollWidth-innerWidth,plFont:font('#profilesView .profile-meta'),pcFont:font('#pcsView .pc-core-stat span'),pcValueFont:font('#pcsView .pc-core-stat strong'),moduleTagFont:font('#modulesView .native-module-tags span'),tags:document.querySelectorAll('#modulesView .native-module-tags span').length,
      plName:rect('#profilesView .name').toJSON(),plScore:rect('#profilesView .score-badge').toJSON(),pcName:rect('#pcsView .pc-card-title strong').toJSON(),pcAvatar:rect('#pcsView .pc-avatar').toJSON(),moduleTitle:rect('#modulesView .native-module-card h3').toJSON(),moduleScore:rect('#modulesView .native-module-score').toJSON(),touch:rect('#modulesView .native-module-card-actions>.btn').height,moduleHeight:rect('#modulesView .native-module-card').height,statCount:document.querySelectorAll('#pcsView .pc-core-stat').length};
   });
   assert(data.overflow<=1,`${width}: horizontal overflow ${data.overflow}`);
   assert(data.plFont>=11.5,`${width}: PL metadata too small`);
   assert(data.pcFont>= (width<=360?9.5:10),`${width}: PC label too small`);
   assert(data.pcValueFont>=13,`${width}: PC value too small`);
   assert(data.moduleTagFont>=11,`${width}: module tags too small`);
   assert.equal(data.tags,7);assert.equal(data.statCount,5);
   // Title can wrap vertically, but must not occupy the rating/avatar's horizontal lane.
   const separated=(a,b)=>a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1;
   assert(separated(data.plName,data.plScore),`${width}: PL title collides with score`);
   assert(separated(data.pcName,data.pcAvatar),`${width}: PC title collides with avatar`);
   assert(separated(data.moduleTitle,data.moduleScore),`${width}: module title collides with score`);
   if(width>=900)assert(data.moduleHeight<245,`${width}: module card retains unnecessary minimum height`);
   if(width<=760)assert(data.touch>=42,`${width}: module action touch too short`);
   assert.equal(errors.length,0,`${width}: page errors ${errors.join(' | ')}`);
   console.log(`${width}px: overflow=${data.overflow}, PC label=${data.pcFont}px, value=${data.pcValueFont}px, module tags=${data.tags}, touch=${data.touch}px, errors=${errors.length}`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
