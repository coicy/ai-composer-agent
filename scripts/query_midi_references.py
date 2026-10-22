#!/usr/bin/env python3
"""Offline evidence-only queries against the attributed MIDI reference catalog."""
import argparse
import json
from pathlib import Path

def select_references(manifest,*,meter=None,source_style=None,usage=None,pitched=None,limit=3):
 if not 1<=limit<=100:raise ValueError('limit must be in [1,100]')
 results=[]
 for item in manifest['items']:
  f=item['facets'];label=f['labels']
  if meter is not None and meter not in f['meter']['values']:continue
  if source_style is not None and label['source_style_label']!=source_style:continue
  if usage is not None and label['game_usage']!=usage:continue
  if pitched is not None and bool(f['pitch_language']['pitched_notes'])!=pitched:continue
  results.append({
   'file':item['file'],'title':item['title'],'license':item['license'],
   'sha256':item['sha256'],'source_page':item['source_page'],
   'source_index_group':item['style'],
   'source_style_label':label['source_style_label'],
   'game_usage':label['game_usage'],'meter':f['meter'],
   'pitched_note_count':f['pitch_language']['pitched_notes'],
   'verified_mode':label['verified_mode'],
   'verified_groove':label['verified_groove']
  })
 return {'match_count':len(results),'returned_count':min(limit,len(results)),
         'matches':results[:limit],
         'note':'Evidence-backed MIDI/metadata matches, not proof of stylistic quality; mode and swing remain unverified.'}

def main():
 ap=argparse.ArgumentParser(description='Find MIDI references by independently grounded facets.')
 ap.add_argument('--manifest',type=Path,default=Path(__file__).resolve().parent/'reference-output'/'manifest.json')
 ap.add_argument('--meter',help='Exact MIDI/source-annotated meter, e.g. 3/4')
 ap.add_argument('--source-style',help='Exact source-provided style, e.g. dance/disco')
 ap.add_argument('--usage',choices=['town','battle','dungeon','narrative'])
 g=ap.add_mutually_exclusive_group()
 g.add_argument('--require-pitched',action='store_true')
 g.add_argument('--drum-only',action='store_true')
 ap.add_argument('--limit',type=int,default=3)
 args=ap.parse_args()
 manifest=json.loads(args.manifest.read_text(encoding='utf-8'))
 out=select_references(manifest,meter=args.meter,source_style=args.source_style,
                       usage=args.usage,
                       pitched=True if args.require_pitched else False if args.drum_only else None,
                       limit=args.limit)
 print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
