#!/usr/bin/env python3
"""Fetch sourced MIDI references for local analysis, fail closed on invalid input."""
import argparse,hashlib,json,pathlib,urllib.request
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--manifest',default='references/development/sources.json')
 ap.add_argument('--output',default='references/development/local-midi')
 a=ap.parse_args()
 doc=json.loads(pathlib.Path(a.manifest).read_text(encoding='utf-8'))
 out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
 report=[]
 for ref in doc['references']:
  url=ref['url']
  if not url.startswith('https://www.mutopiaproject.org/ftp/'):raise RuntimeError('untrusted_source_url')
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AIComposerReferenceAudit/1.0'}),timeout=25) as resp:
   data=resp.read(2_000_001)
  if not data.startswith(b'MThd') or len(data)>2_000_000:raise RuntimeError('invalid_midi_payload: '+ref['id'])
  dest=out/(ref['id']+'.mid');dest.write_bytes(data)
  report.append({'id':ref['id'],'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),
   'license':ref['license'],'sourcePage':ref['sourcePage'],'techniqueVerification':'pending_midi_analysis'})
 (out/'download-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
