const CACHE_PREFIX="tomato-pl-";
const CACHE_NAME=`${CACHE_PREFIX}v8.1.4.15`;
const APP_SHELL=["./","./index.html","./module-tools.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
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
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
        return response;
      }
      const cached=await caches.match(event.request);
      return cached||response;
    }catch(err){
      const cached=await caches.match(event.request);
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
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});
