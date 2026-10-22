#!/usr/bin/env python3
"""Publish SHA-verified, unmodified MIDI snapshots with per-file third-party rights."""
from __future__ import annotations
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent.parent
DEFAULT_CATALOG=ROOT/'scripts'/'reference-output'
DEFAULT_DEST=ROOT/'references'
LEGALCODES={
 'CC BY 4.0':('CC-BY-4.0.txt','https://creativecommons.org/licenses/by/4.0/legalcode.txt','Attribution 4.0 International'),
 'CC0-1.0':('CC0-1.0.txt','https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt','CC0 1.0 Universal')
}
COPY_NAMES=('manifest.json','coverage.json','targets.json','README.md','COVERAGE.md','TARGETS.md')

def retrieve_license(url,marker):
 req=urllib.request.Request(url,headers={'User-Agent':'ai-composer-midi-reference-publisher/1.0'})
 with urllib.request.urlopen(req,timeout=60) as response:raw=response.read(250000)
 if not 5000<len(raw)<250000:raise ValueError('License text unexpected size: '+url)
 text=raw.decode('utf-8-sig')
 if marker not in text:raise ValueError('Wrong Creative Commons legalcode: '+url)
 return text

def publish(catalog=DEFAULT_CATALOG,dest=DEFAULT_DEST):
 manifest=json.loads((catalog/'manifest.json').read_text(encoding='utf-8'))
 items=manifest['items']
 if manifest['total_files']!=44 or len(items)!=44:raise ValueError('Unexpected corpus size')
 for directory in ('midi','catalog','licenses'):(dest/directory).mkdir(parents=True,exist_ok=True)
 seen=set();licenses=Counter()
 ledger=[
 '# Third-party MIDI copyright and attribution',
 '',
 'Applies only to MIDI works beneath references/midi, not to any ai-composer-agent software source code.',
 'All redistributed MIDI bytes are unchanged from their source; only their filenames and catalog metadata are new.',
 '',
 '## Collection attribution',
 '',
 '* Groove MIDI Dataset, Google LLC; CC BY 4.0. Source: https://magenta.withgoogle.com/datasets/groove',
 '  License: https://creativecommons.org/licenses/by/4.0/ .',
 '  Citation: Gillick, Roberts, Engel, Eck, Bamman (2019), Learning to Groove with Inverse Sequence Transformations, ICML.',
 '  Copyright owner Google LLC; **retain attribution and license link** in subsequent redistributions.',
 '* 15 Melodic RPG Chiptunes, Aureolus_Omicron; CC0 1.0. Source: https://opengameart.org/content/15-melodic-rpg-chiptunes',
 '  Legalcode: https://creativecommons.org/publicdomain/zero/1.0/ . Credit provided voluntarily.',
 '* Mutopia Project: the eight individually selected editions each state Copyright: Public Domain on their exact work pages.',
 '  Public-domain statements are per-piece, not a blanket claim about other Mutopia works or jurisdictions.',
 '',
 'Full CC BY 4.0 and CC0 1.0 legalcode texts appear in the adjacent licenses directory.',
 '',
 '## Individual file attribution ledger',
 '',
 '| Published original MIDI | Work / source | Rights | Copyright owner or maintainer | Evidence | SHA-256 |',
 '|---|---|---|---|---|---|'
 ]
 for item in items:
  rel=Path(item['file'])
  if rel.is_absolute() or '..' in rel.parts or len(rel.parts)<3 or rel.parts[0]!='midi' or rel.suffix.lower()!='.mid':
   raise ValueError('Unsafe source path: '+str(rel))
  blob=(catalog/rel).read_bytes()
  if blob[:4]!=b'MThd':raise ValueError('Invalid MIDI: '+str(rel))
  hashval=sha256(blob).hexdigest()
  if hashval!=item['sha256']:raise ValueError('Source integrity mismatch: '+str(rel))
  if str(rel) in seen:raise ValueError('Duplicate file path')
  seen.add(rel.as_posix())
  rights=item.get('rights')
  if not isinstance(rights,dict) or rights.get('license_id')!=item['license'] or not rights.get('credit') or not rights.get('license_evidence_url'):
   raise ValueError('Missing validated rights record: '+str(rel))
  license_id=rights['license_id']
  if license_id not in (*LEGALCODES,'Public Domain'):raise ValueError('Unknown license: '+license_id)
  evidence=rights['license_evidence_url']
  if license_id=='Public Domain' and 'mutopiaproject.org/cgibin/piece-info.cgi?id=' not in evidence:
   raise ValueError('Missing per-work Public Domain evidence')
  if license_id=='CC BY 4.0' and 'magenta' not in evidence:raise ValueError('Unexpected Groove evidence')
  if license_id=='CC0-1.0' and 'opengameart.org' not in evidence:raise ValueError('Unexpected CC0 evidence')
  target=dest/rel
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_bytes(blob)
  licenses[license_id]+=1
  title=item['title'].replace('|','/')
  credit=rights['credit'].replace('|','/')
  ledger.append('| '+rel.as_posix()+' | '+title+' | '+license_id+' | '+credit+' | '+evidence+' | '+hashval+' |')
 expected={'CC BY 4.0':28,'CC0-1.0':8,'Public Domain':8}
 if dict(licenses)!=expected:raise ValueError('Unexpected per-license file counts: '+str(dict(licenses)))
 for target in (dest/'midi').rglob('*.mid'):
  if target.relative_to(dest).as_posix() not in seen:
   raise ValueError('Stale file in version-controlled reference library: '+str(target))
 for name in COPY_NAMES:(dest/'catalog'/name).write_bytes((catalog/name).read_bytes())
 for id,(filename,url,marker) in LEGALCODES.items():
  text=retrieve_license(url,marker)
  (dest/'licenses'/filename).write_text(text,encoding='utf-8')
  print('LICENSE',id,len(text),'chars',flush=True)
 ledger+=['','## Change statement and reuse',
  'All original MIDI bytes were copied as-is. No notes were modified, quantized, resynthesized, or re-encoded.',
  'Refer to the manifest for exact source archive members / Mutopia download URLs and per-file original SHA-256.',
  'The codebase license, if any, does not override these third-party conditions.',
  'When distributing CC BY recordings or adapted arrangements, retain the required attribution and identify modifications.','']
 (dest/'THIRD_PARTY_NOTICES.md').write_text('\n'.join(ledger),encoding='utf-8')
 readme=[
 '# MIDI references — third-party music works',
 '',
 '44 original MIDI binary files, stored in Git and versioned with per-file evidence and legalcode.',
 '**This directory is not an open-source license for the application.**',
 '',
 '## Where to look',
 '- midi/: untouched source MIDI files (28 Groove drums, 8 OpenGameArt games, 8 Mutopia scores).',
 '- catalog/manifest.json: original download path, individual rights record, SHA-256, and musical fact facets.',
 '- catalog/coverage.json and catalog/targets.json: missing sample types and independent-source counts.',
 '- THIRD_PARTY_NOTICES.md: mandatory attribution, original-author credits, individual rights evidence.',
 '- licenses/CC-BY-4.0.txt and licenses/CC0-1.0.txt: complete official license legalcodes.',
 '',
 '## Redistribution rules',
 '| Source | Count | Conditions |',
 '|---|---:|---|',
 '| Google LLC Groove MIDI Dataset | 28 | CC BY 4.0: attribution and legalcode link required |',
 '| Aureolus_Omicron 15 Melodic RPG Chiptunes | 8 | CC0 1.0; author voluntarily credited |',
 '| Mutopia Project: eight specific sheet-music editions | 8 | Public Domain statement checked individually |',
 '',
 '## Rebuild and verify',
 'Run Python 3.11+ with mido==1.3.3 installed:',
 '',
 '    python scripts/build_midi_reference_catalog.py',
 '    python scripts/stage_reference_snapshot.py',
 '    python scripts/verify_reference_snapshot.py',
 '',
 'Build downloads the authorized originals; publisher additionally downloads the Creative Commons legalcode.',
 'The MIDI bytes in this directory have NOT been modified.',
 '',
 '## Important limits',
 '28 of 44 references contain percussion only; these do not validate any musical mode.',
 'The 6/8 trio are from the same drummer and are not independent stylistic representatives.',
 '5/4 and 5/8 are single clips; 7/8 and 12/8 are still missing.',
 'No independent verification yet exists for mode, swing subtype, compositional form, or musical quality.',''
 ]
 (dest/'README.md').write_text('\n'.join(readme),encoding='utf-8')
 print('STAGED',len(items),'MIDI; rights:',dict(licenses),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser()
 parser.add_argument('--catalog',type=Path,default=DEFAULT_CATALOG)
 parser.add_argument('--dest',type=Path,default=DEFAULT_DEST)
 args=parser.parse_args()
 publish(args.catalog,args.dest)
