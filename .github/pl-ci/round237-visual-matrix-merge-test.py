#!/usr/bin/env python3
"""Temporary fabricated evidence tests; never reads user's data or old browser profiles."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
p=Path(__file__).with_name('round237-visual-matrix-merge.py')
spec=importlib.util.spec_from_file_location('round237_visual',p)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class Tests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.dir=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def item(self,widths,version='8.1.12.254',count=None,fail=None,missing=False):
        p=self.dir/f'{len(list(self.dir.glob("*.json")))}.json';screenshots=['synthetic.png']
        if not missing:(self.dir/'synthetic.png').write_bytes(b'fake screenshot')
        p.write_text(json.dumps({'version':version,'widths':widths,'cases':count if count is not None else sum(mod.EXPECTED[w] for w in widths),'failures':fail or [],'screenshots':screenshots}))
        return p
    def full(self):return [self.item([320,375,390]),self.item([430,768,1024]),self.item([1280,1440])]
    def test_complete_nonoverlapping_batches(self):
        result=mod.merge(self.full());self.assertEqual(result['cases'],90);self.assertEqual(result['failures'],[])
    def test_duplicate_or_absent_width_refused(self):
        a=self.full();self.assertRaises(ValueError,mod.merge,a[:2]+[a[1]])
        self.assertRaises(ValueError,mod.merge,a[:2])
    def test_falsely_complete_or_failed_batch_refused(self):
        a=self.full();raw=json.loads(a[0].read_text());raw['cases']-=1;a[0].write_text(json.dumps(raw))
        self.assertRaises(ValueError,mod.merge,a)
        raw['cases']+=1;raw['failures']=['synthetic failure'];a[0].write_text(json.dumps(raw))
        self.assertRaises(ValueError,mod.merge,a)
    def test_mismatched_version_refused(self):
        a=self.full();raw=json.loads(a[0].read_text());raw['version']='old';a[0].write_text(json.dumps(raw))
        self.assertRaises(ValueError,mod.merge,a)
    def test_missing_screenshot_refused(self):
        a=self.full();(self.dir/'synthetic.png').unlink();self.assertRaises(ValueError,mod.merge,a)
if __name__=='__main__':unittest.main(verbosity=2)
