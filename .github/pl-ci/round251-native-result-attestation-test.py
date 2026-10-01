#!/usr/bin/env python3
"""Fictional attestation fixtures only; never fabricates a production PASS artifact."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory

root = Path(__file__).resolve().parents[2]
p = Path(__file__).with_name('round251-native-result-attestation.py')
spec = importlib.util.spec_from_file_location('round251', p)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
commit = 'a' * 40
version = __import__('re').search(r'const APP_UI_VERSION\s*=\s*"([^"]+)"', (root/'index.html').read_text('utf8')).group(1)
base = {'test':'round187','status':'PASS','phase':'finished','commit':commit,'app_version':version,
        'browser_source':'playwright-bundled','external_requests_blocked':0,
        'checks':sorted(m.REQUIRED),'passed':len(m.REQUIRED),
        'archive_evidence':{k:'1'*64 for k in ('source','reloaded_native','second_zip','post_rejected_reload')},
        'attachment_evidence':{k:'2'*64 for k in ('source','reloaded_native','second_zip','post_rejected_reload')}}
count = 0
with TemporaryDirectory() as d:
    path = Path(d) / 'fixture.json'
    def run(value, good, label):
        global count
        path.write_text(json.dumps(value), encoding='utf8')
        try:
            verdict = m.attest(path, commit=commit, require_bundled=True)
            ok = verdict['status'] == 'PASS'
        except ValueError:
            ok = False
        assert ok is good, label
        count += 1
    run(base, True, 'valid synthetic complete result')
    for field, replacement in [('status','BLOCKED'),('phase','navigate-native-local-origin'),('commit','b'*40),
                               ('app_version','stale'),('browser_source','system'),('external_requests_blocked',1),
                               ('failure',{'type':'PolicyError'})]:
        run({**base, field: replacement}, False, field)
    run({**base,'checks':[], 'passed':0}, False, 'zero checks')
    run({**base,'checks':base['checks'][:-1], 'passed':len(base['checks'])-1}, False, 'incomplete checks')
    run({**base,'checks':base['checks']+[base['checks'][0]],'passed':len(base['checks'])+1},False,'duplicate checks')
    run({**base,'passed':len(base['checks'])+1},False,'mismatched count')
    run({**base,'checks':'oops','passed':999},False,'invalid check list')
    run({**base,'archive_evidence':{}},False,'missing archive evidence')
    run({**base,'archive_evidence':{**base['archive_evidence'],'second_zip':'2'*64}},False,'archive evidence drift')
    run({**base,'archive_evidence':{**base['archive_evidence'],'source':'not-a-hash'}},False,'invalid archive evidence hash')
    run({**base,'attachment_evidence':{}},False,'missing attachment evidence')
    run({**base,'attachment_evidence':{**base['attachment_evidence'],'second_zip':'3'*64}},False,'attachment evidence drift')
    run({**base,'attachment_evidence':{**base['attachment_evidence'],'source':'not-a-hash'}},False,'invalid attachment evidence hash')
    try: m.attest(path,commit='not-a-git-sha',require_bundled=True)
    except ValueError: count += 1
    else: raise AssertionError('invalid expected Git commit')
    path.unlink()
    try: m.attest(path,commit=commit,require_bundled=True)
    except ValueError: count += 1
    else: raise AssertionError('missing result')
print('ROUND251: %d/%d fictional validator fixtures PASS' % (count,count))
