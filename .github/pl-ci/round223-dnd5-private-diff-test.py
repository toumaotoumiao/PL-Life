#!/usr/bin/env python3
"""Synthetic, transient XLSX samples only. No private workbook is accessed or retained."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
import xml.sax.saxutils as sx
import zipfile
from pathlib import Path

TOOL=Path(__file__).with_name('round223-dnd5-private-diff.py')
spec=importlib.util.spec_from_file_location('private_dnd_audit',TOOL)
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'

def sample(path,count,change=False,poison=False,extra_formula=False,merge_shift=False,merge_bad=False):
    prof=audit.LAYOUTS[count]
    labels={}
    formulas={}
    for idx,ref,label in prof['anchors']:
        labels.setdefault(idx,{})[ref]=audit.ALIASES[label][0]
    for i,ref in enumerate(prof['ability']):
        labels.setdefault(1,{})[ref]=audit.ABILITY[i]
        formulas.setdefault(1,set()).add(prof['formulas'][i])
    labels.setdefault(0,{})['A1']='SYNTHETIC_PRIVATE_CHARACTER_DO_NOT_PRINT'
    if change: labels[0]['C5' if count==21 else 'C10']='SYNTHETIC_PRIVATE_VALUE_NEVER_PRINT'
    if poison: labels[1][prof['ability'][0]]='力量：SYNTHETIC_PRIVATE_CHARACTER_DO_NOT_PRINT'
    if extra_formula: formulas.setdefault(count-1,set()).add('D42')
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
        sheet_tags=''.join(f'<sheet name="PRIVATE_NAME_NEVER_PRINT" sheetId="{i+1}" r:id="rId{i+1}"/>' for i in range(count))
        z.writestr('xl/workbook.xml',f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>{sheet_tags}</sheets></workbook>')
        relation=''.join(f'<Relationship Id="rId{i+1}" Type="{REL}/worksheet" Target="worksheets/sheet{i+1}.xml"/>' for i in range(count))
        z.writestr('xl/_rels/workbook.xml.rels',f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{relation}</Relationships>')
        for i in range(count):
            cells=[]
            for ref,value in labels.get(i,{}).items():
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{sx.escape(value)}</t></is></c>')
            for ref in formulas.get(i,set()):cells.append(f'<c r="{ref}"><f>1+2</f><v>3</v></c>')
            merged = '<mergeCells count="1"><mergeCell ref="' + ('D35:E34' if merge_bad and i==0 else ('D35:E35' if merge_shift and i==0 else 'D34:E34')) + '"/></mergeCells>' if i==0 else ''
            z.writestr(f'xl/worksheets/sheet{i+1}.xml',f'<worksheet xmlns="{NS}"><sheetData><row r="1">{"".join(cells)}</row></sheetData>{merged}</worksheet>')

def modify_sheet(path, sheet_number, old, new):
    # Synthetic-only workbook rewrite; no original private workbook is used.
    with zipfile.ZipFile(path) as archive:
        items=[(i.filename,archive.read(i.filename)) for i in archive.infolist()]
    target=f'xl/worksheets/sheet{sheet_number}.xml'
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as output:
        for name,payload in items:
            if name==target:
                content=payload.decode('utf-8')
                assert old in content
                payload=content.replace(old,new,1).encode('utf-8')
            output.writestr(name,payload)

def modify_entry(path, target, old, new):
    # Synthetic-only ZIP mutation. Never load or copy private input workbooks.
    with zipfile.ZipFile(path) as archive:
        items=[(entry.filename, archive.read(entry.filename)) for entry in archive.infolist()]
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as output:
        for name,payload in items:
            if name==target:
                content=payload.decode('utf-8')
                assert old in content
                payload=content.replace(old,new,1).encode('utf-8')
            output.writestr(name,payload)

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.d=tempfile.TemporaryDirectory(prefix='pl-synthetic-dnd-')
    def tearDown(self):self.d.cleanup()
    def file(self,name,count,**kwargs):
        p=Path(self.d.name)/name;sample(p,count,**kwargs);return p
    def test_same_template_diff_is_unverified_and_anonymous(self):
        for count in (21,8):
            before=self.file(f'synthetic-blank-{count}.xlsx',count)
            after=self.file(f'synthetic-filled-{count}.xlsx',count,change=True)
            r=audit.safe_summary(audit.read_workbook(after),audit.read_workbook(before))
            self.assertEqual(r['layout'],f'layout-{count}')
            self.assertEqual(r['labels'],7);self.assertEqual(r['ability_signature'],6)
            self.assertEqual(r['comparison'],'comparable');self.assertFalse(r['import_ready'])
            self.assertTrue(r['candidate_cells'])
            self.assertTrue(all(x['status']=='unverified-difference' for x in r['candidate_cells']))
            self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(r))
    def test_mismatched_layout_fails_closed(self):
        a=self.file('fake-filled.xlsx',8,change=True)
        b=self.file('fake-blank.xlsx',21)
        r=audit.safe_summary(audit.read_workbook(a),audit.read_workbook(b))
        self.assertEqual(r['reason'],'different-sheet-count');self.assertEqual(r['candidate_cells'],[])
    def test_private_ability_prose_invalidates_pair(self):
        a=self.file('fake-filled.xlsx',8,change=True,poison=True)
        b=self.file('fake-blank.xlsx',8)
        r=audit.safe_summary(audit.read_workbook(a),audit.read_workbook(b))
        self.assertEqual(r['ability_signature'],5);self.assertEqual(r['candidate_cells'],[])
    def test_identical_sheet_count_and_labels_do_not_hide_formula_topology_drift(self):
        for count in (8,21):
            blank=self.file(f'blank-{count}.xlsx',count)
            changed=self.file(f'filled-{count}.xlsx',count,change=True,extra_formula=True)
            result=audit.safe_summary(audit.read_workbook(changed),audit.read_workbook(blank))
            self.assertEqual(result['reason'],'formula-topology-mismatch')
            self.assertEqual(result['comparison'],'incompatible')
            self.assertEqual(result['candidate_cells'],[])
            self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(result))
    def test_same_labels_and_formula_positions_reject_shifted_merged_cells(self):
        for count in (8,21):
            blank=self.file(f'blank-merge-{count}.xlsx',count)
            filled=self.file(f'filled-merge-{count}.xlsx',count,change=True,merge_shift=True)
            result=audit.safe_summary(audit.read_workbook(filled),audit.read_workbook(blank))
            self.assertEqual(result['comparison'],'incompatible')
            self.assertEqual(result['reason'],'merged-topology-mismatch')
            self.assertEqual(result['candidate_cells'],[])
            self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(result))
    def test_matching_merged_cells_allow_anonymous_unverified_candidates(self):
        blank=self.file('blank-merge-same.xlsx',8)
        filled=self.file('filled-merge-same.xlsx',8,change=True)
        result=audit.safe_summary(audit.read_workbook(filled),audit.read_workbook(blank))
        self.assertEqual(result['comparison'],'comparable')
        self.assertTrue(result['candidate_cells'])
        self.assertFalse(result['import_ready'])

    def test_invalid_merged_rectangle_fails_closed_without_private_text(self):
        broken=self.file('PRIVATE_INVALID_MERGE.xlsx',8,merge_bad=True)
        output=subprocess.run([sys.executable,str(TOOL),'--filled',str(broken)],capture_output=True,text=True)
        self.assertEqual(output.returncode,2)
        self.assertNotIn('PRIVATE_',output.stdout+output.stderr)
        self.assertEqual(json.loads(output.stdout)['reason'],'file-or-structure-error')

    def test_formula_cache_change_does_not_become_candidate_source(self):
        blank=self.file('blank.xlsx',8)
        filled=self.file('filled.xlsx',8,change=True)
        # The changed value at C10 is unverified metadata only, never an import mapping.
        result=audit.safe_summary(audit.read_workbook(filled),audit.read_workbook(blank))
        self.assertEqual(result['comparison'],'comparable')
        self.assertFalse(result['import_ready'])
        self.assertTrue(result['candidate_cells'])
        self.assertEqual({x['status'] for x in result['candidate_cells']},{'unverified-difference'})
        self.assertTrue(all('value' not in x and 'sheet_name' not in x for x in result['candidate_cells']))

    def test_duplicate_cell_coordinate_fails_closed_without_private_text(self):
        p=self.file('PRIVATE_DUPLICATE_CELL.xlsx',8,change=True)
        modify_sheet(p,1,'</row>', '<c r="C10" t="inlineStr"><is><t>PRIVATE_SHADOW</t></is></c></row>')
        output=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
        self.assertEqual(output.returncode,2)
        self.assertEqual(json.loads(output.stdout)['reason'],'file-or-structure-error')
        self.assertNotIn('PRIVATE',output.stdout+output.stderr)

    def test_overlapping_and_duplicate_merge_ranges_are_rejected(self):
        for extra in ('E34:F34','D34:E34'):
            p=self.file('PRIVATE_OVERLAP.xlsx',8)
            modify_sheet(p,1,'</mergeCells>',f'<mergeCell ref="{extra}"/></mergeCells>')
            output=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
            self.assertEqual(output.returncode,2)
            self.assertEqual(json.loads(output.stdout)['reason'],'file-or-structure-error')
            self.assertNotIn('PRIVATE',output.stdout+output.stderr)

    def test_merged_subordinate_cell_never_becomes_candidate_even_if_changed(self):
        before=self.file('blank-merged.xlsx',8)
        after=self.file('filled-merged.xlsx',8,change=True)
        for item in (before,after):
            modify_sheet(item,1,'D34:E34','B10:D10')
        result=audit.safe_summary(audit.read_workbook(after),audit.read_workbook(before))
        self.assertEqual(result['comparison'],'comparable')
        self.assertEqual(result['candidate_cells'],[])
        self.assertFalse(result['import_ready'])

    def test_formula_cached_changes_are_excluded_from_unverified_source_candidates(self):
        for count in (8,21):
            before=self.file(f'blank-formula-{count}.xlsx',count)
            after=self.file(f'filled-formula-{count}.xlsx',count)
            formula_ref=audit.LAYOUTS[count]['formulas'][0]
            sheet_name='xl/worksheets/sheet2.xml'
            modify_entry(after,sheet_name,'<c r="'+formula_ref+'"><f>1+2</f><v>3</v></c>',
                         '<c r="'+formula_ref+'"><f>1+2</f><v>777</v></c>')
            # Nothing from a formula cache belongs in the source-candidate report.
            report=audit.safe_summary(audit.read_workbook(after),audit.read_workbook(before))
            self.assertEqual(report['comparison'],'comparable')
            self.assertFalse(report['import_ready'])
            self.assertFalse(any(x['source'].endswith(':'+formula_ref) for x in report['candidate_cells']))
            self.assertNotIn('777',json.dumps(report))

    def test_duplicate_relationship_ids_rejected_before_sheet_mapping(self):
        p=self.file('PRIVATE_DUPLICATE_REL.xlsx',8,change=True)
        target='xl/_rels/workbook.xml.rels'
        modify_entry(p,target,'</Relationships>',
          '<Relationship Id="rId1" Type="'+REL+'/worksheet" Target="worksheets/sheet2.xml"/></Relationships>')
        result=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(json.loads(result.stdout)['reason'],'file-or-structure-error')
        self.assertNotIn('PRIVATE',result.stdout+result.stderr)

    def test_same_worksheet_target_cannot_masquerade_as_two_sheets(self):
        p=self.file('PRIVATE_ALIAS_SHEET.xlsx',8)
        modify_entry(p,'xl/_rels/workbook.xml.rels','Target="worksheets/sheet2.xml"',
          'Target="worksheets/sheet1.xml"')
        result=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(json.loads(result.stdout)['reason'],'file-or-structure-error')
        self.assertNotIn('PRIVATE',result.stdout+result.stderr)

    def test_external_worksheet_relationship_rejected_without_request(self):
        p=self.file('PRIVATE_EXTERNAL_SHEET.xlsx',8)
        modify_entry(p,'xl/_rels/workbook.xml.rels','Target="worksheets/sheet1.xml"',
          'Target="https://private.invalid/sheet1.xml" TargetMode="External"')
        result=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(json.loads(result.stdout)['reason'],'file-or-structure-error')
        self.assertNotIn('PRIVATE',result.stdout+result.stderr)

    def test_out_of_bounds_cell_reference_fails_closed(self):
        for bad in ('XFE1','A1048577'):
            p=self.file('PRIVATE_OOB_'+bad+'.xlsx',8)
            modify_sheet(p,1,'r="A1"','r="'+bad+'"')
            result=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            self.assertEqual(json.loads(result.stdout)['reason'],'file-or-structure-error')
            self.assertNotIn('PRIVATE',result.stdout+result.stderr)

    def test_cli_never_emits_source_text_or_paths_even_on_bad_file(self):
        a=self.file('PRIVATE_CHARACTER_NAME.xlsx',8,change=True)
        output=subprocess.run([sys.executable,str(TOOL),'--filled',str(a)],capture_output=True,text=True)
        self.assertEqual(output.returncode,2)
        self.assertNotIn('PRIVATE_CHARACTER',output.stdout+output.stderr)
        self.assertEqual(json.loads(output.stdout)['reason'],'same-layout-blank-required')
        p=Path(self.d.name)/'PRIVATE_FILE_ERROR.xlsx';p.write_bytes(b'NOT_A_ZIP_PRIVATE')
        out=subprocess.run([sys.executable,str(TOOL),'--filled',str(p)],capture_output=True,text=True)
        self.assertEqual(out.returncode,2)
        self.assertNotIn('PRIVATE_',out.stdout+out.stderr)
        self.assertEqual(json.loads(out.stdout)['reason'],'file-or-structure-error')

if __name__=='__main__':
    unittest.main(verbosity=2)
