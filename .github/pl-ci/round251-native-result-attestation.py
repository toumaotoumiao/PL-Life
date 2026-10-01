#!/usr/bin/env python3
"""Strict, privacy-safe attestation of a *real* Round187 native recovery result.

A synthetic contract pass, a hand-edited PASS flag, zero checks, a stale version,
or a result from system Chromium must never satisfy the release gate. This tool
reads only check labels and run metadata; it never reads or prints backup bytes.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = frozenset({
    'startup-native-origin', 'initial-page-errors', 'fresh-native-attachment-stores',
    'seed-parsedDnd', 'visible-real-restore-confirmation', 'real-restore-committed',
    'reload-dndNative', 'reload-dndSecondZip', 'reload-nativeImage',
    'reload-nativeWorkbook', 'reload-orphanImage', 'reload-orphanWorkbook',
    'corrupt-rejected', 'corrupt-missingAttachmentsRejected',
    'corrupt-archiveUnchanged', 'corrupt-attachmentsUnchanged',
    'post-rejected-reload-archive', 'post-rejected-reload-dndStillDistinct',
    'post-rejected-reload-unlinked', 'post-rejected-reload-noMarker',
    'no-external-network-attempts',
})


def attest(path: Path, *, commit: str, require_bundled: bool = False, root: Path = ROOT) -> dict:
    source = (root / 'index.html').read_text(encoding='utf-8')
    found = re.search(r'const APP_UI_VERSION\s*=\s*["\']([^"\']+)["\']', source)
    if not found:
        raise ValueError('current application version unavailable')
    version = found.group(1)
    try:
        record = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise ValueError('native result is missing or not valid JSON') from error
    if not isinstance(record, dict):
        raise ValueError('native result must be an object')
    checks = record.get('checks')
    if not isinstance(checks, list) or not all(isinstance(x, str) and x for x in checks):
        raise ValueError('native result has no valid check list')
    if len(checks) != len(set(checks)) or record.get('passed') != len(checks):
        raise ValueError('native result has duplicate or inconsistent checks')
    missing = REQUIRED.difference(checks)
    if missing:
        raise ValueError('native result lacks required phases: ' + ', '.join(sorted(missing)))
    if record.get('test') != 'round187' or record.get('status') != 'PASS' or record.get('phase') != 'finished':
        raise ValueError('native result did not finish with PASS')
    if record.get('commit') != commit or record.get('app_version') != version:
        raise ValueError('native result is not from this checkout and app version')
    if not re.fullmatch(r'[a-fA-F0-9]{40}', commit):
        raise ValueError('checkout identity is not a 40-character Git commit')
    if require_bundled and record.get('browser_source') != 'playwright-bundled':
        raise ValueError('hosted native gate must use the pinned bundled browser')
    if record.get('external_requests_blocked') != 0:
        raise ValueError('native gate attempted an external request')
    if record.get('failure'):
        raise ValueError('native result contains a failure record')
    evidence = record.get('archive_evidence')
    required_evidence = ('source','reloaded_native','second_zip','post_rejected_reload')
    if not isinstance(evidence, dict) or any(not isinstance(evidence.get(k), str) or not re.fullmatch(r'[a-fA-F0-9]{64}', evidence.get(k,'')) for k in required_evidence):
        raise ValueError('native result lacks complete anonymous archive evidence hashes')
    if len({evidence[k].lower() for k in required_evidence}) != 1:
        raise ValueError('native archive evidence changed across restore, second ZIP, or rejected-import reload')
    attachment_evidence = record.get('attachment_evidence')
    if not isinstance(attachment_evidence, dict) or any(not isinstance(attachment_evidence.get(k), str) or not re.fullmatch(r'[a-fA-F0-9]{64}', attachment_evidence.get(k,'')) for k in required_evidence):
        raise ValueError('native result lacks complete anonymous attachment evidence hashes')
    if len({attachment_evidence[k].lower() for k in required_evidence}) != 1:
        raise ValueError('native attachment evidence changed across restore, second ZIP, or rejected-import reload')
    return {'status': 'PASS', 'app_version': version, 'commit': commit, 'checks': len(checks), 'required_covered': len(REQUIRED), 'archive_evidence_hash': evidence['source'].lower(), 'attachment_evidence_hash': attachment_evidence['source'].lower()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('result', type=Path)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--require-bundled', action='store_true')
    args = parser.parse_args()
    try:
        result = attest(args.result, commit=args.commit, require_bundled=args.require_bundled)
    except ValueError as error:
        print('ROUND251 NATIVE ATTESTATION: FAIL - ' + str(error))
        return 1
    print('ROUND251 NATIVE ATTESTATION: PASS - version=%s checks=%d mandatory=%d' %
          (result['app_version'], result['checks'], result['required_covered']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
