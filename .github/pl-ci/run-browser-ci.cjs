'use strict';
// Localhost-only, synthetic fixture integration. No access to GitHub Pages or user backups.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const repo = path.resolve(__dirname, '../..');
const site = fs.existsSync(path.join(repo, 'index.html')) ? repo : path.join(repo, 'site');
const out = path.resolve(process.env.RUNNER_TEMP || path.join(repo, '.github/pl-ci'), 'pl-synthetic-report');
fs.mkdirSync(out, {recursive: true});
const required = ['index.html', 'sw.js', 'data-migration-transaction.js'];
for (const f of required) if (!fs.existsSync(path.join(site, f))) throw Error('Website root missing required file: ' + f);
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const match = html.match(/const APP_UI_VERSION\s*=\s*["'](\d+\.\d+\.\d+\.\d+)["']/);
if (!match) throw Error('Cannot identify website release. Refusing unverified browser test.');
const version = match[1];
const sha256 = Object.fromEntries(required.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(site, f))).digest('hex')]));
const identity = Buffer.from(JSON.stringify({format:'pl-stage2-synthetic-site-identity', version:1, siteVersion:version, sha256}));
const fixtures = new Map([
  ['stage3-local-synthetic-test.html', path.join(__dirname, 'stage3-local-synthetic-test.html')],
  ['stage2-real-site-bridge.js', path.join(__dirname, 'stage2-real-site-bridge.js')]
]);
const shell = fs.readFileSync(path.join(site,'sw.js'),'utf8').match(/const APP_SHELL\s*=\s*\[([^\]]+)\]/);
if (!shell) throw Error('Missing service-worker asset allowlist');
const allowed = new Set([...shell[1].matchAll(/['\"]\.\/([^'\"]+)['\"]/g)].map(m=>m[1]));
allowed.add('sw.js');
if(!allowed.has('index.html')) throw Error('Website shell missing index.html');
const mime = f=>f.endsWith('.js')?'text/javascript; charset=utf-8': f.endsWith('.json')?'application/json; charset=utf-8':f.endsWith('.png')?'image/png':f.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8';
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://127.0.0.1').pathname;
  const name = pathname.replace(/^\//,'');
  if (!['GET','HEAD'].includes(req.method)||!name||name.includes('/')||name.includes('\\')||name==='.'||name==='..') {res.writeHead(404);res.end();return;}
  let bytes;
  if(name==='stage2-site-identity.json') bytes=identity;
  else if(fixtures.has(name)) bytes=fs.readFileSync(fixtures.get(name));
  else if(allowed.has(name)) bytes=fs.readFileSync(path.join(site,name));
  else {res.writeHead(404);res.end();return;}
  res.writeHead(200, {'Content-Type':mime(name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:bytes);
});
(async()=>{
  let browser;
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const port = server.address().port;
    browser = await chromium.launch({headless:true});
    const context=await browser.newContext({acceptDownloads:false});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',err=>pageErrors.push(String(err.message).slice(0,160)));
    await page.goto('http://127.0.0.1:'+port+'/stage3-local-synthetic-test.html',{waitUntil:'load',timeout:60000});
    await page.getByRole('button',{name:'运行正式代码隔离测试'}).click();
    await page.waitForFunction(() => document.getElementById('export')?.disabled === false,null,{timeout:240000});
    const report=await page.evaluate(()=>JSON.parse(JSON.stringify(report)));
    const safe={lab:report.lab,version:report.version,siteVersion:report.siteVersion,siteIdentityVerified:report.siteIdentityVerified,tests:(report.tests||[]).map(t=>({name:t.name,passed:t.passed,errorCode:t.errorCode,diagnostic:t.diagnostic})),environment:report.environment,scope:report.scope};
    const dest=path.join(out,'synthetic-results.json');
    fs.writeFileSync(dest, JSON.stringify(safe,null,2)+'\n');
    const success=report.siteVersion===version&&report.siteIdentityVerified===true&&report.tests.length===11&&report.tests.every(t=>t.passed===true)&&report.environment.secure&&report.environment.indexedDB&&report.environment.webLocks&&report.scope==='synthetic-origin-only';
    console.log('VERSION',version,'SYNTHETIC_CHROMIUM',report.tests.filter(t=>t.passed).length+'/'+report.tests.length,success?'PASS':'FAIL');
    if(!success){console.log('Failed checks:',report.tests.filter(t=>!t.passed).map(t=>({name:t.name,errorCode:t.errorCode,diagnostic:t.diagnostic})));process.exitCode=1;}
    if(pageErrors.length) console.log('Browser errors (truncated):',pageErrors.slice(0,3));
    await context.close();
  }catch(err){console.error('BROWSER_RUN_FAILED',String(err.message||err).slice(0,300));process.exitCode=1;}
  finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
})();
