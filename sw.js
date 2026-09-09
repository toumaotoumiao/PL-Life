const CACHE_PREFIX="tomato-pl-";
const CACHE_NAME=`${CACHE_PREFIX}v8.1.10.29`;
const APP_SHELL=["./","./index.html","./module-tools.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const url of APP_SHELL){
      try{
        const response=await fetch(url,{cache:"no-store",credentials:"same-origin"});
        if(response&&response.ok)await cache.put(url,response.clone());
      }catch(err){
        const existing=await caches.match(url);
        if(existing)await cache.put(url,existing.clone());
        else throw err;
      }
    }
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isFreshProgramRequest=event.request.mode==="navigate" || /\/(?:index|module-tools)\.html$/.test(url.pathname) || url.pathname.endsWith("/");
  event.respondWith((async()=>{
    try{
      const response=isFreshProgramRequest
        ? await fetch(event.request.url,{cache:"no-store",credentials:"same-origin"})
        : await fetch(event.request);
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});
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
