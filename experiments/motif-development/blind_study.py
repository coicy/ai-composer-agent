#!/usr/bin/env python3
"""Blind listening protocol: create review forms and aggregate real submitted ratings.

No simulated listeners, quality scores or externally retrieved embeddings.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
from csv import DictReader, DictWriter
import json
from pathlib import Path
import random
import shutil

METRICS = ('themeIdentityRating_1to5', 'developmentRating_1to5',
           'dramaticArcRating_1to5', 'taskFitRating_1to5', 'overallRating_1to5')
DESIGNS = (
    ('A_static_loop', 'ruins'),
    ('B_surface_density', 'ruins'),
    ('C_developed', 'ruins'),
    ('D_scrambled', 'ruins'),
    ('C_developed', 'ruins'),  # repeated anchor checks rater reliability
    ('E_style_mismatch', 'carnival'),  # identical audio to C but different task
)
BRIEFS = {
    'ruins': '神秘遗迹探索：有主题发展、克制紧张感与回归。',
    'carnival': '欢乐嘉年华庆典：明亮、活泼、愉快的舞蹈音乐。',
}

def prepare(audio: Path, dest: Path, key: Path, seed: int=20261026) -> dict:
    if dest.resolve() == key.parent.resolve():
        raise ValueError('Place the answer key outside the blind reviewer folder')
    if any(dest.glob('clip_*.mp3')):
        raise ValueError('Review folder already has clips; use a clean folder')
    entries = list(DESIGNS)
    random.Random(seed).shuffle(entries)
    dest.mkdir(parents=True, exist_ok=True)
    rows = []
    answer = []
    for i, (source, brief) in enumerate(entries, 1):
        input_file = audio / (source + '.mp3')
        if not input_file.is_file():
            raise FileNotFoundError(input_file)
        clip = f'clip_{i:02d}.mp3'
        shutil.copyfile(input_file, dest / clip)
        answer.append({'clip': clip, 'source': source, 'brief': brief})
        rows.append({'participantId': '', 'clip': clip, 'taskBrief': BRIEFS[brief],
                     **{m: '' for m in METRICS}, 'comments': ''})
    with (dest / 'rating_form.csv').open('w', newline='', encoding='utf-8-sig') as file:
        writer=DictWriter(file,fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    key.parent.mkdir(parents=True, exist_ok=True)
    key.write_text(json.dumps({'version': 1, 'seed': seed, 'mapping': answer},
                              ensure_ascii=False, indent=2), encoding='utf-8')
    return {'clips': len(rows), 'keyPath': str(key), 'reviewFolder': str(dest)}

def summarize(key: Path, response_files: list[Path]) -> dict:
    if not response_files:
        raise ValueError('No real participant ratings provided')
    mapping = {c['clip']: c for c in json.loads(key.read_text(encoding='utf-8'))['mapping']}
    participants = defaultdict(dict)
    for source in response_files:
        with source.open(newline='', encoding='utf-8-sig') as file:
            for row in DictReader(file):
                person = (row.get('participantId') or '').strip()
                clip = (row.get('clip') or '').strip()
                values = [row.get(m, '').strip() for m in METRICS]
                if not person or clip not in mapping:
                    raise ValueError(f'Invalid participant or clip in {source}')
                if (person, clip) in participants[person]:
                    raise ValueError('Duplicate participant/clip response')
                if any(not n.isdigit() or int(n) not in (1,2,3,4,5) for n in values):
                    raise ValueError(f'Ratings must be 1..5: {person}/{clip}')
                if clip in participants[person]:
                    raise ValueError(f'Duplicate participant/clip: {person}/{clip}')
                participants[person][clip] = [int(n) for n in values]
    outcomes = defaultdict(list)
    paired = []
    for person, ratings in participants.items():
        grouped=defaultdict(list)
        for clip, vals in ratings.items():
            identity=mapping[clip]
            grouped[(identity['source'],identity['brief'])].append(vals)
            outcomes[identity['source'] + '/' + identity['brief']].append(vals)
        # Same music C/E; only task descriptions differ. Require paired completions.
        c=grouped.get(('C_developed','ruins'),[])
        e=grouped.get(('E_style_mismatch','carnival'),[])
        if c and e:
            baseline=sum(x[3] for x in c)/len(c)
            carnival=sum(x[3] for x in e)/len(e)
            paired.append(round(baseline-carnival,4))
    result={}
    for group, values in sorted(outcomes.items()):
        result[group]={
            'count': len(values),
            'meanByDimension': {metric: round(sum(v[i] for v in values)/len(values),4)
                for i,metric in enumerate(METRICS)}
        }
    return {
        'status': 'real-responses-aggregated',
        'participants': len(participants),
        'sourceRatingFiles': len(response_files),
        'groups': result,
        'sameMusicDifferentBrief': {
            'pairedParticipants':len(paired),
            'individualTaskFitDifferences':paired,
            'meanDifference': round(sum(paired)/len(paired),4) if paired else None,
            'note': 'Descriptive within-participant difference, not a music-quality metric or significance test.',
        }
    }

def main() -> None:
    parser=argparse.ArgumentParser()
    commands=parser.add_subparsers(dest='command',required=True)
    p=commands.add_parser('prepare')
    p.add_argument('--audio',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--key',type=Path,required=True)
    p.add_argument('--seed',type=int,default=20261026)
    s=commands.add_parser('summarize')
    s.add_argument('--key',type=Path,required=True)
    s.add_argument('--responses',type=Path,nargs='+',required=True)
    s.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    if args.command=='prepare':
        result=prepare(args.audio,args.out,args.key,args.seed)
    else:
        result=summarize(args.key,args.responses)
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    main()
