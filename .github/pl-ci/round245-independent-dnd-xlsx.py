#!/usr/bin/env python3
"""Independent OOXML package/relationship validator for fictional D&D export.
Uses only Python's standard-library ZIP/XML parser; no app XLSX reader or private source.
This does NOT prove Excel/WPS application compatibility.
"""
from __future__ import annotations
import argparse,json,re,sys,zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from posixpath import normpath,dirname

MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
EXPECTED={'[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'}

def inspect(path):
    path=Path(path)
    with zipfile.ZipFile(path,'r') as z:
        names=z.namelist()
        assert len(names)==len(set(names)) and set(names)==EXPECTED, 'unexpected, duplicate or missing package parts'
        assert z.testzip() is None, 'CRC failure'
        assert all(z.getinfo(n).file_size<4_000_000 for n in names), 'oversized part'
        def xml(n): return ET.fromstring(z.read(n))
        root=xml('_rels/.rels'); relations=root.findall(f'{{{REL}}}Relationship')
        assert len(relations)==1 and relations[0].get('Target')=='xl/workbook.xml', 'invalid root workbook link'
        assert relations[0].get('TargetMode') is None, 'external root link'
        book=xml('xl/workbook.xml'); sheets=book.findall(f'{{{MAIN}}}sheets/{{{MAIN}}}sheet')
        assert len(sheets)==1 and sheets[0].get('name')=='DND规则数据', 'not a standalone D&D sheet'
        rels=xml('xl/_rels/workbook.xml.rels').findall(f'{{{REL}}}Relationship')
        assert len(rels)==2 and all(r.get('TargetMode') is None for r in rels), 'external or unknown relationships'
        targets={r.get('Id'):normpath('xl/'+str(r.get('Target'))) for r in rels}
        assert targets.get(sheets[0].get(f'{{{DOCREL}}}id'))=='xl/worksheets/sheet1.xml', 'sheet relationship mismatch'
        assert set(targets.values())=={'xl/worksheets/sheet1.xml','xl/styles.xml'}, 'unexpected relationship target'
        types=xml('[Content_Types].xml')
        override={r.get('PartName') for r in types.findall(f'{{{CT}}}Override')}
        assert override=={'/xl/workbook.xml','/xl/worksheets/sheet1.xml','/xl/styles.xml'}, 'content type mismatch'
        styles=xml('xl/styles.xml')
        xf=styles.find(f'{{{MAIN}}}cellXfs');assert xf is not None and len(xf)==4, 'invalid style indexes'
        body=xml('xl/worksheets/sheet1.xml')
        assert not body.findall('.//'+f'{{{MAIN}}}f'), 'formula element found'
        assert not body.findall('.//'+f'{{{MAIN}}}hyperlink'), 'external hyperlink found'
        rows=body.findall(f'{{{MAIN}}}sheetData/{{{MAIN}}}row')
        assert len(rows)>=7 and len(rows)<=1_048_576, 'invalid worksheet row count'
        matrix=[]
        for n,row in enumerate(rows,1):
            assert row.get('r')==str(n), 'nonconsecutive row coordinate'
            cells=row.findall(f'{{{MAIN}}}c'); assert len(cells)==4,'invalid data column count'
            values=[]
            for j,cell in enumerate(cells):
                assert cell.get('r')==f'{chr(65+j)}{n}' and cell.get('t')=='inlineStr', 'wrong cell coordinate or type'
                assert int(cell.get('s','0'))<4, 'invalid style reference'
                inline=cell.find(f'{{{MAIN}}}is')
                assert inline is not None and cell.find(f'{{{MAIN}}}v') is None,'non-inline text cell'
                values.append(''.join(t.text or '' for t in inline.findall('.//'+f'{{{MAIN}}}t')))
            matrix.append(values)
        assert matrix[0][0]=='D&D 5e 已填规则数据', 'wrong workbook purpose'
        assert matrix[2][0]=='版次' and matrix[2][1] in {'2014','2024'},'edition missing'
        assert matrix[5]==['分类','字段','内容','说明'],'header mismatch'
        assert all(r[0] in ('属性','豁免与技能','身份、战斗与装备') and r[1].strip() and (r[2].strip() or r[3].strip()) for r in matrix[6:]),'empty or unnamed output'
        assert 'DO_NOT_EXPORT_SYNTHETIC' not in '\n'.join(map(str,matrix)),'synthetic private sentry leaked'
        assert any(r[2]=='=2+3' for r in matrix[6:]),'formula-shaped text was altered'
        return {'status':'PASS','format':'OOXML package and native ZIP/XML parse only','edition':matrix[2][1],
                'rows':len(rows),'filled_fields':len(rows)-6,'formula_nodes':0,'parts':len(names),
                'limitations':'Not Excel/WPS application opening, native IndexedDB, or real user workbook.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('xlsx');p.add_argument('--report',type=Path)
    args=p.parse_args()
    try: result=inspect(args.xlsx)
    except Exception as e:
        result={'status':'FAIL','reason':str(e)[:160]}
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
    print('ROUND245 INDEPENDENT OOXML',result)
    sys.exit(0 if result['status']=='PASS' else 1)
