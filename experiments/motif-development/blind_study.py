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
    # Counterbalanced presentation without changing the hidden clip mapping:
    # cyclic rotations place every clip in every serial position once.
    # Assign successive consenting participants different order files.
    for offset in range(len(rows)):
        ordered=rows[offset:] + rows[:offset]
        with (dest / f'rating_form_order_{offset+1:02d}.csv').open(
            'w', newline='', encoding='utf-8-sig') as file:
            writer=DictWriter(file,fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(ordered)
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
                if any(not n.isdigit() or int(n) not in (1,2,3,4,5) for n in values):
                    raise ValueError(f'Ratings must be 1..5: {person}/{clip}')
                if clip in participants[person]:
                    raise ValueError(f'Duplicate participant/clip: {person}/{clip}')
                participants[person][clip] = [int(n) for n in values]
    # Participant, rather than clip, is the independent sampling unit.
    # The repeated C clip is averaged *within* each participant.
    outcomes = defaultdict(list)
    clip_counts = defaultdict(int)
    paired = []
    repeat_differences = []
    completed = 0
    incomplete = 0
    for person, ratings in participants.items():
        grouped = defaultdict(list)
        for clip, vals in ratings.items():
            identity = mapping[clip]
            grouped[(identity['source'], identity['brief'])].append(vals)
        if len(ratings) == len(mapping):
            completed += 1
        else:
            incomplete += 1
        for (source, brief), observations in grouped.items():
            person_mean = [sum(a[i] for a in observations)/len(observations)
                           for i in range(len(METRICS))]
            outcomes[source + '/' + brief].append(person_mean)
            clip_counts[source + '/' + brief] += len(observations)
        c = grouped.get(('C_developed','ruins'), [])
        e = grouped.get(('E_style_mismatch','carnival'), [])
        # A paired brief effect requires the full repeated-C control and E.
        if len(c) == 2:
            repeat_differences.append([abs(c[0][i]-c[1][i]) for i in range(len(METRICS))])
        if len(c) == 2 and len(e) == 1:
            paired.append(round((c[0][3] + c[1][3])/2 - e[0][3],4))
    result = {}
    for group, values in sorted(outcomes.items()):
        result[group] = {
            'participantCount': len(values),
            'clipRatingCount': clip_counts[group],
            'meanByDimension': {metric:round(sum(v[i] for v in values)/len(values),4)
                               for i,metric in enumerate(METRICS)},
            'note':'Means are calculated per participant first; repeated trials do not add independent subjects.'
        }
    repeat_means = ({metric:round(sum(v[i] for v in repeat_differences)/len(repeat_differences),4)
                     for i,metric in enumerate(METRICS)} if repeat_differences else None)
    return {
        'status': 'submitted-responses-aggregated',
        'participants':len(participants),
        'completeParticipants':completed,
        'incompleteParticipants':incomplete,
        'sourceRatingFiles':len(response_files),
        'groups':result,
        'sameBriefRepeatedClip':{
            'participantsWithBothRepeats':len(repeat_differences),
            'meanAbsoluteDifferenceByDimension':repeat_means,
            'note':'A repeat-consistency diagnostic, not inter-rater reliability.'
        },
        'sameMusicDifferentBrief':{
            'pairedParticipants':len(paired),
            'individualTaskFitDifferences':paired,
            'meanDifference':round(sum(paired)/len(paired),4) if paired else None,
            'note':'Descriptive within-person task-fit difference; no significance or causal inference.'
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
