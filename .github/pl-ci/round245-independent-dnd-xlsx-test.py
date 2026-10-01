"""Negative tests using only a synthetic output workbook; no private PC files."""
import importlib.util,io,zipfile
from pathlib import Path
p=Path(__file__).with_name('round245-independent-dnd-xlsx.py')
spec=importlib.util.spec_from_file_location('audit',p);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
source=Path(__file__).parents[2]/'.github/pl-ci/round245-fiction-workbook.xlsx'
# CI creates the sample in its temporary directory; this test can independently create it from an explicitly provided sample.
import sys
if len(sys.argv)>1:source=Path(sys.argv[1])
assert mod.inspect(source)['status']=='PASS'
data=source.read_bytes()
def tamper(change):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  entries={n:z.read(n) for n in z.namelist()}
 change(entries)
 buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for name,payload in entries.items():z.writestr(name,payload)
 from tempfile import NamedTemporaryFile
 with NamedTemporaryFile(suffix='.xlsx') as f:
  f.write(buf.getvalue());f.flush()
  try:mod.inspect(f.name)
  except AssertionError:return True
  return False
assert tamper(lambda x:x.pop('xl/styles.xml'))
assert tamper(lambda x:x.__setitem__('xl/worksheets/sheet1.xml',x['xl/worksheets/sheet1.xml'].replace(b'</sheetData>',b'<f>1+1</f></sheetData>')))
assert tamper(lambda x:x.__setitem__('xl/_rels/workbook.xml.rels',x['xl/_rels/workbook.xml.rels'].replace(b'worksheets/sheet1.xml',b'https://outside.invalid/a')))
print('ROUND245 independent OOXML positive + three corrupt synthetic packages: 4/4')
