#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, re, shutil, sys, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
MANIFEST_PATH=ROOT/'production-release-manifest.json'

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def load_manifest():
    data=json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    if data.get('format')!='pl-life-production-release-manifest':
        raise SystemExit('release manifest format mismatch')
    return data

def extract_versions():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    sw=(ROOT/'sw.js').read_text(encoding='utf-8')
    app=re.search(r'const APP_UI_VERSION\s*=\s*["\']([^"\']+)',html)
    cache=re.search(r'CACHE_NAME=`\$\{CACHE_PREFIX\}v([^`]+)`',sw)
    schema=re.search(r'const DATA_SCHEMA_VERSION\s*=\s*(\d+)',html)
    if not app or not cache or not schema:
        raise SystemExit('cannot resolve app/cache/schema version')
    return app.group(1),cache.group(1),int(schema.group(1))

def app_shell_files():
    sw=(ROOT/'sw.js').read_text(encoding='utf-8')
    m=re.search(r'const APP_SHELL=\[(.*?)\];',sw,re.S)
    if not m: raise SystemExit('APP_SHELL missing')
    return [x.lstrip('./') for x in re.findall(r'["\'](\.\/[^"\']+)["\']',m.group(1))]

def validate(manifest):
    app,cache,schema=extract_versions()
    errors=[]
    if app!=manifest['appVersion']: errors.append(f'manifest appVersion {manifest["appVersion"]} != {app}')
    if cache!=app: errors.append(f'service worker cache {cache} != app {app}')
    if schema!=manifest['schemaVersion']: errors.append(f'manifest schema {manifest["schemaVersion"]} != {schema}')
    roots=set(manifest['rootFiles'])
    for rel in roots:
        if not (ROOT/rel).is_file(): errors.append(f'missing release root file: {rel}')
    for rel in app_shell_files():
        if rel not in roots: errors.append(f'APP_SHELL file omitted from release manifest: {rel}')
        if not (ROOT/rel).is_file(): errors.append(f'APP_SHELL file missing: {rel}')
    for d in manifest['includeDirectories']:
        if not (ROOT/d).is_dir(): errors.append(f'missing release directory: {d}')
    required_ci=['.github/workflows/pl-browser-synthetic.yml','.github/workflows/pl-native-restore-gate.yml',
                 '.github/pl-ci/round187-native-fullapp-restore-browser.py','.github/pl-ci/round251-native-result-attestation.py']
    for rel in required_ci:
        if not (ROOT/rel).is_file(): errors.append(f'missing release CI asset: {rel}')
    return errors

def copy_release(manifest,dest:Path):
    if dest.exists(): shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for rel in manifest['rootFiles']:
        src=ROOT/rel; out=dest/rel; out.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,out)
    for rel in manifest['includeDirectories']:
        shutil.copytree(ROOT/rel,dest/rel,dirs_exist_ok=True)
    # generated caches never belong in release repo
    for p in list(dest.rglob('__pycache__')):
        shutil.rmtree(p)
    for p in list(dest.rglob('*.pyc')): p.unlink()
    forbidden={x.lower() for x in manifest['privateExtensionsForbidden']}
    bad=[p.relative_to(dest).as_posix() for p in dest.rglob('*') if p.is_file() and p.suffix.lower() in forbidden]
    if bad: raise SystemExit('forbidden private/binary source files in release: '+', '.join(bad[:10]))
    top_files=[p.name for p in dest.iterdir() if p.is_file()]
    for prefix in manifest['generatedOrInternalRootPrefixesForbidden']:
        if any(x.startswith(prefix) for x in top_files): raise SystemExit(f'internal root file leaked into production package: {prefix}')
    hashes={p.relative_to(dest).as_posix():sha256(p) for p in sorted(dest.rglob('*')) if p.is_file()}
    (dest/'PRODUCTION_RELEASE_SHA256.json').write_text(json.dumps({'appVersion':manifest['appVersion'],'files':hashes},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return hashes

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--check-only',action='store_true')
    ap.add_argument('--output',default=str(ROOT.parent/'production-release'))
    ap.add_argument('--zip')
    args=ap.parse_args()
    manifest=load_manifest(); errors=validate(manifest)
    if errors:
        print('\n'.join('ERROR: '+x for x in errors)); return 1
    print(f'preflight PASS: v{manifest["appVersion"]} / schema{manifest["schemaVersion"]}')
    if args.check_only:return 0
    dest=Path(args.output).resolve(); hashes=copy_release(manifest,dest)
    print(f'release files: {len(hashes)}')
    if args.zip:
        zp=Path(args.zip).resolve(); zp.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
            for p in sorted(dest.rglob('*')):
                if p.is_file(): z.write(p,p.relative_to(dest).as_posix())
        with zipfile.ZipFile(zp) as z:
            bad=z.testzip()
            if bad: raise SystemExit(f'zip CRC failure: {bad}')
        print(f'zip: {zp}')
    return 0
if __name__=='__main__': raise SystemExit(main())
