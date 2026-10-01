#!/usr/bin/env python3
"""Local-only, read-only D&D XLSX structural comparison. Never emits workbook values.

Use in a private directory: python round223-dnd5-private-diff.py --filled character.xlsx
or add --blank matching-template.xlsx. Result is anonymous metadata, NOT an import map.
No copies of either workbook or results are written by this script.
"""
from __future__ import annotations
import argparse
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAX_BYTES = 16 * 1024 * 1024
MAX_TOTAL = 192 * 1024 * 1024
MAX_FILES = 2500
MAX_MERGES_PER_SHEET = 2048
ABILITY = ['力量', '敏捷', '体质', '智力', '感知', '魅力']
LAYOUTS = {
    21: {'name': 'layout-21', 'ability': ['C12','C14','C16','C18','C20','C22'],
         'formulas': ['F12','F14','F16','F18','F20','F22'],
         'anchors': [(0,'B5','背景'),(0,'B8','种族／物种'),(0,'K8','阵营'),(1,'W3','等级'),(1,'P3','熟练加值'),(1,'B27','先攻'),(1,'AF27','生命值')]},
    8: {'name': 'layout-8', 'ability': ['C8','C10','C12','C14','C16','C18'],
        'formulas': ['G8','G10','G12','G14','G16','G18'],
        'anchors': [(0,'B10','背景'),(0,'B6','种族／物种'),(0,'J6','阵营'),(1,'W2','等级'),(1,'Z3','熟练加值'),(1,'N8','先攻'),(1,'V8','生命值')]}
}
ALIASES = {
    '背景': ['背景','人物背景'], '种族／物种': ['种族','物种','种族物种'],
    '阵营': ['阵营'], '等级': ['等级','角色等级'],
    '熟练加值': ['熟练','熟练加值','熟练奖励'],
    '先攻': ['先攻','先攻值','先攻加值'],
    '生命值': ['生命值','最大生命值','生命值上限','HP','HP上限']
}
ABILITY_EN = [('STR','STRENGTH'),('DEX','DEXTERITY'),('CON','CONSTITUTION'),('INT','INTELLIGENCE'),('WIS','WISDOM'),('CHA','CHARISMA')]
REF = re.compile(r'^([A-Z]{1,3})([1-9][0-9]{0,6})$')
MERGED = re.compile(r'^([A-Z]{1,3}[1-9][0-9]{0,6}):([A-Z]{1,3}[1-9][0-9]{0,6})$')

class SheetCells(dict):
    """Parsed cells plus sheet geometry; private ranges never appear in the CLI result."""
    def __init__(self, cells, merged_ranges):
        super().__init__(cells)
        self.merged_ranges = frozenset(merged_ranges)


def token(value):
    if not isinstance(value, str):
        return ''
    return re.sub(r'[\s：:／/()（）·._-]', '', value).upper()

def column(ref):
    match = REF.fullmatch(ref)
    if not match:
        raise ValueError('invalid cell reference')
    number = 0
    for char in match.group(1):
        number = number * 26 + ord(char) - 64
    return number, int(match.group(2))

def reference(col, row):
    letters = ''
    while col:
        col, remainder = divmod(col-1, 26)
        letters = chr(65+remainder)+letters
    return f'{letters}{row}'

def _normal_target(value):
    if not value or '://' in value or '..' in value.split('/'):
        raise ValueError('unsafe sheet relationship')
    name = posixpath.normpath(value.lstrip('/') if value.startswith('/') else posixpath.join('xl', value))
    if not name.startswith('xl/') or '..' in name.split('/'):
        raise ValueError('unsafe worksheet path')
    return name

def read_workbook(file_path):
    p = Path(file_path)
    if not p.is_file() or p.stat().st_size > MAX_BYTES:
        raise ValueError('file missing or too large')
    with zipfile.ZipFile(p) as archive:
        entries = archive.infolist()
        if len(entries)>MAX_FILES or sum(i.file_size for i in entries)>MAX_TOTAL:
            raise ValueError('xlsx exceeds structural limits')
        if any(i.flag_bits & 1 or i.filename.startswith('/') or '\\' in i.filename or '..' in i.filename.split('/') for i in entries):
            raise ValueError('unsafe xlsx entries')
        names = [i.filename for i in entries]
        if len(names)!=len(set(names)):
            raise ValueError('duplicate xlsx entries')
        def xml(name):
            if name not in names:
                raise ValueError('xlsx structure missing')
            return ET.fromstring(archive.read(name))
        ns = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
              'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
              'p':'http://schemas.openxmlformats.org/package/2006/relationships'}
        w = xml('xl/workbook.xml')
        # Relationship identifiers and worksheet targets are structural identities,
        # not merely lookup hints. Reject duplicates/external aliases before mapping.
        relationships = {}
        for rel in xml('xl/_rels/workbook.xml.rels'):
            rel_id = rel.attrib.get('Id')
            if not rel_id or rel_id in relationships:
                raise ValueError('ambiguous worksheet relationship')
            relationships[rel_id] = rel
        shared = []
        if 'xl/sharedStrings.xml' in names:
            strings = xml('xl/sharedStrings.xml')
            shared = [''.join(n.text or '' for n in si.findall('.//s:t',ns)) for si in strings.findall('s:si',ns)]
        sheets = []
        used_relations, used_targets = set(), set()
        for item in w.findall('.//s:sheets/s:sheet',ns):
            rel_id = item.attrib.get('{'+ns['r']+'}id')
            rel = relationships.get(rel_id)
            if rel is None or rel_id in used_relations or rel.attrib.get('TargetMode', 'Internal') != 'Internal' or not rel.attrib.get('Type', '').endswith('/worksheet'):
                raise ValueError('ambiguous worksheet relationship')
            path = _normal_target(rel.attrib.get('Target'))
            if path in used_targets:
                raise ValueError('duplicate worksheet target')
            used_relations.add(rel_id)
            used_targets.add(path)
            sh = xml(path)
            cells = {}
            for c in sh.findall('.//s:sheetData/s:row/s:c',ns):
                address = c.attrib.get('r','').upper()
                if not REF.fullmatch(address):
                    raise ValueError('invalid worksheet cell coordinate')
                col, row = column(address)
                if col > 16384 or row > 1048576:
                    raise ValueError('worksheet cell outside spreadsheet limits')
                if address in cells:
                    raise ValueError('duplicate worksheet cell coordinate')
                formula = c.find('s:f',ns) is not None
                kind = c.attrib.get('t','')
                if kind=='inlineStr':
                    text = ''.join(n.text or '' for n in c.findall('.//s:is/s:t',ns))
                else:
                    v = c.find('s:v',ns)
                    text = v.text if v is not None and v.text is not None else ''
                    if kind=='s':
                        if not text.isdecimal() or int(text)>=len(shared):
                            raise ValueError('invalid shared string index')
                        text = shared[int(text)]
                cells[address] = (text, formula, kind)
            merged_ranges = set()
            occupied = set()
            for merged in sh.findall('.//s:mergeCells/s:mergeCell', ns):
                if len(merged_ranges)>=MAX_MERGES_PER_SHEET:
                    raise ValueError('too many merged ranges')
                area = merged.attrib.get('ref', '').upper()
                pair = MERGED.fullmatch(area)
                if not pair:
                    raise ValueError('invalid merged-cell geometry')
                first_col, first_row = column(pair.group(1))
                last_col, last_row = column(pair.group(2))
                if last_col > 16384 or last_row > 1048576 or first_col > last_col or first_row > last_row:
                    raise ValueError('invalid merged-cell geometry')
                if area in merged_ranges:
                    raise ValueError('duplicate merged range')
                # Excel merged rectangles must never overlap. Check geometry with
                # rectangles rather than expanding potentially huge cell ranges.
                for c0,r0,c1,r1 in occupied:
                    if first_col <= c1 and c0 <= last_col and first_row <= r1 and r0 <= last_row:
                        raise ValueError('overlapping merged ranges')
                occupied.add((first_col,first_row,last_col,last_row))
                merged_ranges.add(area)
            sheets.append(SheetCells(cells, merged_ranges))
        return sheets

def safe_summary(filled, blank=None):
    profile = LAYOUTS.get(len(filled))
    if not profile:
        return {'layout':'unsupported','sheet_count':len(filled),'import_ready':False,
                'comparison':'unavailable','reason':'layout-not-recognized'}
    def valid_label(sheet, ref, aliases):
        cell = sheet.get(ref, ('',False,''))
        return not cell[1] and token(cell[0]) in {token(v) for v in aliases}
    anchor_checks = [valid_label(filled[index],ref,ALIASES[label]) for index,ref,label in profile['anchors']]
    second = filled[1]
    ability_checks = []
    for i, (ref,formula_ref) in enumerate(zip(profile['ability'],profile['formulas'])):
        label = ABILITY[i]
        variants = [label,*(label+eng for eng in ABILITY_EN[i]),*(eng+label for eng in ABILITY_EN[i])]
        ability_checks.append(valid_label(second,ref,variants) and second.get(formula_ref,('',False,''))[1])
    result = {'layout':profile['name'],'sheet_count':len(filled),
              'labels':sum(anchor_checks),'ability_signature':sum(ability_checks),
              'import_ready':False,'comparison':'unavailable','candidate_cells':[],
              'reason':'source-cells-not-verified'}
    if blank is None:
        result['reason']='same-layout-blank-required'
        return result
    if len(blank)!=len(filled):
        result['comparison']='incompatible';result['reason']='different-sheet-count'
        return result
    if not all(anchor_checks) or not all(ability_checks):
        result['comparison']='incompatible';result['reason']='filled-layout-signature-mismatch'
        return result
    if not all(valid_label(blank[index],ref,ALIASES[label]) for index,ref,label in profile['anchors']):
        result['comparison']='incompatible';result['reason']='blank-label-signature-mismatch'
        return result
    if not all(valid_label(blank[1],ref,[ABILITY[i],*(ABILITY[i]+e for e in ABILITY_EN[i]),*(e+ABILITY[i] for e in ABILITY_EN[i])])
               and blank[1].get(formula_ref,('',False,''))[1]
               for i,(ref,formula_ref) in enumerate(zip(profile['ability'],profile['formulas']))):
        result['comparison']='incompatible';result['reason']='blank-ability-signature-mismatch'
        return result
    # Sheet count and visible labels alone do not establish a matching edition.
    # Compare only formula CELL LOCATIONS, never formulas, caches or user values.
    # The private report contains a fixed reason code, not any workbook content.
    for filled_sheet, blank_sheet in zip(filled, blank):
        filled_formula_refs={ref for ref, cell in filled_sheet.items() if cell[1]}
        blank_formula_refs={ref for ref, cell in blank_sheet.items() if cell[1]}
        if filled_formula_refs != blank_formula_refs:
            result['comparison']='incompatible';result['reason']='formula-topology-mismatch'
            return result
    # A filled sheet with shifted merged cells is not a verified copy of the blank.
    # Compare range geometry only; never publish raw sheet XML or user content.
    for filled_sheet, blank_sheet in zip(filled, blank):
        if getattr(filled_sheet, 'merged_ranges', frozenset()) != getattr(blank_sheet, 'merged_ranges', frozenset()):
            result['comparison']='incompatible';result['reason']='merged-topology-mismatch'
            return result
    result['comparison']='comparable'
    # Only a tightly bounded vicinity of the seven known static label anchors.
    # Every coordinate here is an UNVERIFIED difference, not a field mapping.
    seen=set()
    def subordinate_merged_cell(sheet, ref):
        c,r=column(ref)
        for area in getattr(sheet, 'merged_ranges', ()):
            start,end=area.split(':')
            c0,r0=column(start);c1,r1=column(end)
            if c0<=c<=c1 and r0<=r<=r1 and ref!=start:
                return True
        return False
    for index,anchor,label in profile['anchors']:
        col,row = column(anchor)
        for dy in range(0,3):
            for dx in range(1,7):
                ref=reference(col+dx,row+dy)
                if subordinate_merged_cell(blank[index],ref):
                    continue
                before=blank[index].get(ref,('',False,''))
                after=filled[index].get(ref,('',False,''))
                # Formula cells (including changed cached results) are never
                # source candidates; a label's vicinity is not an import map.
                if before==after or before[1] or after[1] or (index,ref) in seen:
                    continue
                seen.add((index,ref))
                result['candidate_cells'].append({'source':f'{index+1}:{ref}',
                                                  'formula':bool(before[1] or after[1]),
                                                  'blank_has_content':bool(before[0] or before[1]),
                                                  'filled_has_content':bool(after[0] or after[1]),
                                                  'status':'unverified-difference'})
    return result

def main(argv=None):
    parser=argparse.ArgumentParser(description='Private D&D XLSX source audit: only anonymous metadata is printed; no PC import.')
    parser.add_argument('--filled',required=True)
    parser.add_argument('--blank')
    args=parser.parse_args(argv)
    try:
        result=safe_summary(read_workbook(args.filled),read_workbook(args.blank) if args.blank else None)
    except Exception as exc:
        # No source filenames, worksheet names, or raw parser errors in stdout/stderr.
        result={'layout':'unknown','import_ready':False,'comparison':'unavailable','candidate_cells':[],
                'reason':'file-or-structure-error','error_type':type(exc).__name__}
    print(json.dumps(result,ensure_ascii=False,sort_keys=True))
    return 0 if result['comparison'] not in ('unavailable','incompatible') else 2

if __name__=='__main__':
    sys.exit(main())
