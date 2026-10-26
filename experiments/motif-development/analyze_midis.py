#!/usr/bin/env python3
"""Model-free MIDI inventory control: distinguish section order from content.

Note counts and section identity are observed data, NOT musical-quality scores.
"""
from __future__ import annotations
import argparse
from collections import Counter,defaultdict
import json
from pathlib import Path
import mido

SECTION_TICKS=7680

def sections(path:Path)->tuple[list[tuple],float]:
    midi=mido.MidiFile(str(path))
    if midi.ticks_per_beat!=480:
        raise ValueError("Expected 480 PPQ for controlled benchmark")
    sections=[[] for _ in range(6)]
    for track_index,track in enumerate(midi.tracks):
        tick=0
        active=defaultdict(list)
        for message in track:
            tick+=message.time
            channel=getattr(message,"channel",0)
            pitch=getattr(message,"note",0)
            key=(channel,pitch)
            if message.type=="note_on" and message.velocity>0:
                active[key].append((tick,message.velocity))
            elif message.type=="note_off" or (message.type=="note_on" and message.velocity==0):
                if not active[key]:
                    raise ValueError("Orphan note-off")
                start,velocity=active[key].pop(0)
                index=start//SECTION_TICKS
                if index>=6 or tick<=start or tick>6*SECTION_TICKS:
                    raise ValueError("Invalid note time")
                sections[index].append((track_index,pitch,start%SECTION_TICKS,tick-start,velocity))
        if any(active.values()):
            raise ValueError("Unclosed notes")
    return [tuple(sorted(window)) for window in sections],midi.length

def analyze(stimuli:Path)->dict:
    meta=json.loads((stimuli/"manifest.json").read_text(encoding="utf-8"))
    source={}
    for case in meta["cases"]:
        path=stimuli/case["file"]
        group,duration=sections(path)
        source[case["id"]]={
            "segmentSignatures":group,
            "durationSeconds":round(duration,4),
            "distinctSegmentCount":len(set(group)),
            "leadNoteCount":sum(sum(event[0]==1 for event in window) for window in group),
            "notesAllTracks":sum(len(window) for window in group),
        }
    required=["A_static_loop","B_surface_density","C_developed","D_scrambled","E_style_mismatch"]
    if any(k not in source for k in required):
        raise ValueError("Missing controlled case")
    c=source["C_developed"]["segmentSignatures"]
    d=source["D_scrambled"]["segmentSignatures"]
    e=source["E_style_mismatch"]["segmentSignatures"]
    if Counter(c)!=Counter(d):
        raise ValueError("C/D must have identical bags of complete sections")
    if c!=e:
        raise ValueError("C/E must be musically identical")
    mismatches=sum(x!=y for x,y in zip(c,d))
    result={
        "type":"independent MIDI structural sanity controls, not quality or semantic scoring",
        "durationSeconds":source["C_developed"]["durationSeconds"],
        "sectionCount":6,
        "C_D_bagOfSectionsEqual":True,
        "C_D_sectionOrderDifferent":mismatches>0,
        "C_D_positionMismatches":mismatches,
        "C_E_sameSections":True,
        "byCase":{key:{
            "distinctSectionPatterns":row["distinctSegmentCount"],
            "leadNotes":row["leadNoteCount"],
            "totalNotes":row["notesAllTracks"],
            "seconds":row["durationSeconds"],
        } for key,row in source.items()}
    }
    return result

def main()->None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--stimuli",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    result=analyze(args.stimuli)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False))

if __name__=="__main__":
    main()
