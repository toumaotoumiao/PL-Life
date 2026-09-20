const CACHE_PREFIX="pl-life-prod-";
const CACHE_NAME=`${CACHE_PREFIX}v8.1.12.97`;
const RUNTIME_DOWNLOAD_CACHE="pl-life-prod-runtime-downloads-v1";
const APP_SHELL=["./index.html","./module-tools.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./data-migration-transaction.js","./data-migration-guard.js","./backup-restore-preflight.js","./data-heritage.js","./data-heritage-review.js","./data-heritage-apply.js","./data-heritage-batch.js","./query-core.js","./relation-index.js","./field-adapters.js","./query-state.js","./query-engine.js","./pc-query-bridge.js","./profile-query-bridge.js","./module-query-bridge.js","./plan-query-bridge.js","./record-query-bridge.js","./stats-query-bridge.js","./record-group.js"];

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
      // 资源缺失时宁可明确报错，也不能临时抓取另一版本的脚本完成拼接。
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
