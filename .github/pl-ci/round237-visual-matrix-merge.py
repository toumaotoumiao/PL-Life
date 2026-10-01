#!/usr/bin/env python3
"""Recombine authentic Round157 isolated viewport batches; no failure/width may be lost."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

EXPECTED={320:9,375:18,390:9,430:9,768:9,1024:9,1280:18,1440:9}

def merge(reports):
    covered={}
    versions=set()
    shots=[]
    sources=[]
    for path in map(Path,reports):
        data=json.loads(path.read_text('utf8'))
        versions.add(data['version'])
        widths=data['widths']
        if not widths or len(widths)!=len(set(widths)) or any(w not in EXPECTED or w in covered for w in widths):
            raise ValueError('duplicate, empty, or unknown viewport in visual evidence')
        if data.get('failures'):
            raise ValueError('visual evidence contains failures')
        required=sum(EXPECTED[w] for w in widths)
        if data.get('cases')!=required:
            raise ValueError('visual case count incomplete')
        for shot in data.get('screenshots',[]):
            if not (path.parent/shot).is_file():
                raise ValueError('referenced screenshot missing')
            shots.append(shot)
        for w in widths:
            covered[w]=str(path)
        sources.append({'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                        'file':path.name,'widths':widths,'cases':data['cases']})
    if set(covered)!=set(EXPECTED) or len(versions)!=1:
        raise ValueError('visual matrix incomplete or mixed application versions')
    return {'version':versions.pop(),'widths':sorted(covered),'cases':sum(EXPECTED.values()),
            'failures':[],'screenshots':len(shots),'batches':sources,
            'scope':'isolated synthetic browser matrix; not native IndexedDB or device acceptance'}

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--report',action='append',required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    summary=merge(args.report)
    args.output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n','utf8')
    print('ROUND157 verified merged viewport matrix:',summary['cases'],'/',sum(EXPECTED.values()),
          'version',summary['version'],'batches',len(summary['batches']))
