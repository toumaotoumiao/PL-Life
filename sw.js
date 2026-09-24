const IS_TEST_SCOPE=/\/PL-Life-Test(?:\/|$)/i.test(new URL(self.registration.scope).pathname);
const CACHE_PREFIX=IS_TEST_SCOPE?"pl-life-test-":"pl-life-prod-";
const CACHE_NAME=`${CACHE_PREFIX}v8.1.12.161`;
const RUNTIME_DOWNLOAD_CACHE=IS_TEST_SCOPE?"pl-life-test-runtime-downloads-v1":"pl-life-prod-runtime-downloads-v1";
const APP_SHELL=["./index.html","./runtime-environment.js","./module-tools.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data-migration-transaction.js","./data-migration-guard.js","./backup-restore-preflight.js","./data-heritage.js","./data-heritage-review.js","./data-heritage-apply.js","./data-heritage-batch.js","./query-core.js","./relation-index.js","./field-adapters.js","./query-state.js","./query-engine.js","./pc-query-bridge.js","./profile-query-bridge.js","./module-query-bridge.js","./plan-query-bridge.js","./record-query-bridge.js","./run-event.js","./showcase-core.js","./stats-query-bridge.js","./record-group.js"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const url of APP_SHELL){
      try{
        const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
        if(!response||!response.ok)throw new Error('离线资源获取失败：'+url+'（HTTP '+(response?.status??'无响应')+'）');
        await cache.put(url,response.clone());
      }catch(err){
        // 新版本必须完成整套资源的安装；禁止从旧缓存拼接新旧脚本。
        // 安装失败时浏览器继续保留此前已激活的 worker。
        throw err;
      }
    }
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME&&key!==RUNTIME_DOWNLOAD_CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

// 安装时已原子缓存的程序资源以同一代缓存为准。
// 旧页面若在新版资源上传过程中被刷新，不能拿到新版 HTML 却搭配旧版脚本。
const PROGRAM_PATHS=new Map(APP_SHELL.map(path=>[new URL(path,self.registration.scope).pathname,path]));
const PROGRAM_ROOT=new URL('./',self.registration.scope).pathname;

function programRepairHtml(){
  const prefix=JSON.stringify(CACHE_PREFIX);
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>程序文件需要修复</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f6f9;color:#24332d;font:15px/1.7 system-ui,sans-serif}.card{width:min(620px,calc(100vw - 36px));box-sizing:border-box;padding:28px;border:1px solid #d8d9e3;border-radius:18px;background:white;box-shadow:0 18px 50px #1b253018}.card h1{font-size:22px;margin:0 0 12px}.card p{margin:8px 0;color:#59645f}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button{min-height:44px;padding:10px 16px;border-radius:11px;border:1px solid #aaa8d7;background:#6f63bd;color:white;font-weight:750}details{margin-top:18px;color:#66716c}code{word-break:break-all}</style><div class="card"><h1>程序文件需要修复</h1><p>当前版本的部分离线程序文件缺失，网页已停止继续加载，避免混用不同版本程序文件。</p><p><strong>本操作不会清除 PL、PC、模组、跑团记录或图片数据库。</strong></p><div class="actions"><button id="repair">修复程序文件并重新打开</button></div><details><summary>技术详情</summary><code>Installed app files unavailable · cache ${CACHE_NAME}</code></details></div><script>document.getElementById('repair').onclick=async()=>{const b=document.getElementById('repair');b.disabled=true;b.textContent='正在修复…';try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(r=>r.scope.startsWith(location.origin+location.pathname.replace(/[^/]*$/,''))).map(r=>r.unregister()));if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(${prefix})).map(k=>caches.delete(k)));}const u=new URL(location.href);u.searchParams.set('_program_repair',Date.now());location.replace(u);}catch(e){b.disabled=false;b.textContent='重试修复';alert('程序文件修复未完成：'+(e&&e.message?e.message:e));}};<\/script>`;
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // 更新探测必须看到服务器最新 sw.js；查询参数不应堆积进运行期缓存。
  if(url.pathname===new URL('./sw.js',self.registration.scope).pathname)return;

  if(url.pathname.includes("/__pl_download__/")){
    event.respondWith((async()=>{
      const cache=await caches.open(RUNTIME_DOWNLOAD_CACHE);
      const response=await cache.match(event.request.url);
      if(response){
        return response;
      }
      return new Response("Download expired",{status:404,statusText:"Download expired",headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
    })());
    return;
  }

  // 在当前激活版本的缓存中固定 HTML + JS/CSS/图标；只对列明的程序路径生效。
  // 导航根路径与 index.html 共用精确的 index.html 缓存键，忽略刷新查询参数。
  const programAsset=PROGRAM_PATHS.get(url.pathname)||(url.pathname===PROGRAM_ROOT?'./index.html':null);
  if(programAsset){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const installed=await cache.match(programAsset);
      if(installed)return installed;
      // 资源缺失时宁可明确停机，也不能临时抓取另一版本的脚本完成拼接。
      // 导航请求给出只清当前环境程序缓存的自助修复页；不触碰 localStorage / IndexedDB。
      if(event.request.mode==='navigate'||programAsset==='./index.html')return new Response(programRepairHtml(),{status:503,statusText:'Program files need repair',headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      return new Response('Installed app files unavailable',{status:503,statusText:'Installed app files unavailable',headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    })());
    return;
  }

  const isFreshProgramRequest=event.request.mode==="navigate" || /\/(?:index|module-tools)\.html$/.test(url.pathname) || url.pathname.endsWith("/");
  const programCacheKey=isFreshProgramRequest
    ? (url.pathname.endsWith("/") ? new URL("index.html",url.href).href : `${url.origin}${url.pathname}`)
    : event.request;
  event.respondWith((async()=>{
    try{
      const response=isFreshProgramRequest
        ? await fetch(event.request.url,{cache:"no-store",credentials:"same-origin"})
        : await fetch(event.request);
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(programCacheKey,copy)).catch(()=>{});
        return response;
      }
      const cached=await caches.match(event.request,{ignoreSearch:isFreshProgramRequest});
      return cached||response;
    }catch(err){
      const cached=await caches.match(event.request,{ignoreSearch:isFreshProgramRequest});
      if(cached)return cached;
      if(event.request.mode==="navigate"){
        const shell=await caches.match("./index.html");
        if(shell)return shell;
      }
      return new Response("Offline",{status:503,statusText:"Offline",headers:{"Content-Type":"text/plain; charset=utf-8"}});
    }
  })());
});

self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="SKIP_WAITING")self.skipWaiting();
});
