#!/usr/bin/env python3
"""Verify permanently versioned MIDI assets, per-file attribution and legalcode."""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
REFS=ROOT/'references'
MINIMUM_FILE_COUNT=44
LEGALCODES={
 'CC BY 4.0':('CC-BY-4.0.txt','Attribution 4.0 International'),
 'CC0-1.0':('CC0-1.0.txt','CC0 1.0 Universal')
}
EXPECTED_COUNTS={'CC BY 4.0':28,'CC0-1.0':8,'Public Domain':8}

def verify(references=REFS):
 catalog=references/'catalog'
 manifest=json.loads((catalog/'manifest.json').read_text(encoding='utf-8'))
 if len(manifest.get('items',[]))!=MINIMUM_FILE_COUNT or manifest.get('total_files')!=MINIMUM_FILE_COUNT:
  raise AssertionError('Reference count mismatch')
 if manifest.get('facets_schema')!='ai-composer-reference-facets-v1':
  raise AssertionError('Missing facet provenance schema')
 targets=json.loads((catalog/'targets.json').read_text(encoding='utf-8'))
 coverage=json.loads((catalog/'coverage.json').read_text(encoding='utf-8'))
 if coverage.get('total_midi')!=MINIMUM_FILE_COUNT or len(targets.get('targets',[]))!=24:
  raise AssertionError('Coverage summary mismatch')
 rights=Counter();paths=set()
 for item in manifest['items']:
  rel=Path(item['file'])
  if rel.is_absolute() or '..' in rel.parts or rel.parts[0]!='midi':
   raise AssertionError('Unsafe MIDI path')
  f=references/rel
  if f.suffix!='.mid':raise AssertionError('Wrong MIDI extension')
  data=f.read_bytes()
  if not data.startswith(b'MThd'):raise AssertionError('Not a real MIDI: '+str(rel))
  if sha256(data).hexdigest()!=item['sha256']:
   raise AssertionError('MIDI bytes changed: '+str(rel))
  if rel.as_posix() in paths:raise AssertionError('Duplicate MIDI name')
  paths.add(rel.as_posix())
  meta=item.get('rights')
  if not isinstance(meta,dict) or meta.get('license_id')!=item['license']:
   raise AssertionError('Missing rights record: '+str(rel))
  if not meta.get('credit') or not meta.get('license_evidence_url'):
   raise AssertionError('Missing copyright/attribution evidence: '+str(rel))
  if meta.get('original_bytes_unchanged') is not True:
   raise AssertionError('Missing source copy statement: '+str(rel))
  lic=meta['license_id']
  if lic=='Public Domain':
   if 'mutopiaproject.org/cgibin/piece-info.cgi?id=' not in meta['license_evidence_url']:
    raise AssertionError('Not per-edition Mutopia rights declaration')
   if not item.get('metadata',{}).get('maintainer'):
    raise AssertionError('Mutopia maintainer attribution missing')
  elif lic=='CC BY 4.0':
   if meta.get('license_url')!='https://creativecommons.org/licenses/by/4.0/':
    raise AssertionError('CC BY 4.0 URL missing')
  elif lic=='CC0-1.0':
   if meta.get('license_url')!='https://creativecommons.org/publicdomain/zero/1.0/':
    raise AssertionError('CC0 URL missing')
  else:raise AssertionError('Unsupported license '+str(lic))
  rights[lic]+=1
 if dict(rights)!=EXPECTED_COUNTS:raise AssertionError('Wrong rights distribution: '+str(rights))
 actual={p.relative_to(references).as_posix() for p in (references/'midi').rglob('*.mid')}
 if actual!=paths:raise AssertionError('Some published MIDI is unlisted or missing')
 notice=(references/'THIRD_PARTY_NOTICES.md').read_text(encoding='utf-8')
 for item in manifest['items']:
  if item['sha256'] not in notice or item['file'] not in notice:
   raise AssertionError('Uncredited MIDI: '+item['file'])
 for license_id,(file_name,marker) in LEGALCODES.items():
  code=(references/'licenses'/file_name).read_text(encoding='utf-8')
  if len(code)<5000 or marker not in code:
   raise AssertionError('Missing complete license legalcode: '+license_id)
 for doc in ('README.md','COVERAGE.md','TARGETS.md'):
  if not (catalog/doc).is_file():raise AssertionError('Missing generated report: '+doc)
 print('PUBLISHED_MIDI_FILES',len(paths))
 print('LICENSE_COUNTS',dict(rights))
 print('COMPLETE_LEGALCODES',','.join(LEGALCODES))
 print('INTEGRITY_VERIFIED True')
 return True

if __name__=='__main__':verify()
