"use strict";
/* Shared same-machine origin for full-app Playwright setContent checks.
 * New pages start at about:blank, which disallows IndexedDB. The app then
 * reports storage initialization errors unrelated to layout interactions.
 * The helper uses a loopback-only, ephemeral HTTP origin; browser exceptions
 * and normal storage behavior stay enabled.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..", "..");
const BOOTSTRAP = "/__pl_synthetic_origin_bootstrap__.html";
let addressPromise;

async function prepareSyntheticOrigin(page) {
  if (!addressPromise) {
    addressPromise = new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const pathname = (req.url || "/").split("?")[0];
        if (pathname === BOOTSTRAP) {
          const body = "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>";
          res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
          res.end(body);
          return;
        }
        const full = path.resolve(ROOT, "." + decodeURIComponent(pathname));
        if (!(full === ROOT || full.startsWith(ROOT + path.sep))) {
          res.writeHead(403); res.end(); return;
        }
        fs.readFile(full, (err, data) => {
          if (err) {res.writeHead(404);res.end();return;}
          const type = full.endsWith(".js") ? "text/javascript; charset=utf-8" :
            full.endsWith(".css") ? "text/css; charset=utf-8" :
            full.endsWith(".webmanifest") ? "application/manifest+json" : "application/octet-stream";
          res.writeHead(200, {"Content-Type":type,"Cache-Control":"no-store"});
          res.end(data);
        });
      });
      server.once("error", reject);
      server.listen(0,"127.0.0.1",() => {
        server.unref();
        resolve(`http://127.0.0.1:${server.address().port}`);
      });
    });
  }
  const origin = await addressPromise;
  await page.goto(origin + BOOTSTRAP, {waitUntil:"domcontentloaded",timeout:30000});
  const actualOrigin = await page.evaluate(() => location.origin);
  if (actualOrigin !== origin) throw new Error("Synthetic browser origin mismatch");
  return origin;
}
module.exports = {prepareSyntheticOrigin};
