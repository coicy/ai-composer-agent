#!/usr/bin/env python3
"""Controlled multiseed symbolic-music interventions (not independent human compositions).

12 new motifs, two stylistic families, six 4-bar form windows, four event-exact
segment permutations/controls. No model scores or listener labels are fabricated.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import mido

BAR=1920
SECTION=4*BAR
SECTIONS=6
SAMPLES=12
KINDS=("ordered","swap","reverse","rotate","static","density")
ORDERS={
 "ordered":[0,1,2,3,4,5],
 "swap":[0,4,2,3,1,5],
 "reverse":[5,4,3,2,1,0],
 "rotate":[1,2,3,4,5,0],
 "static":[0,0,0,0,0,0],
 "density":[0,0,0,0,0,0],
}
GENRE_BRIEFS={
 "ruins":"Mysterious ancient ruins exploration music, dark, sparse, suspended harmony, evolving recognizable motif and atmospheric return.",
 "carnival":"Joyful bright carnival celebration music, buoyant melodic phrases, major harmonies, playful dance, recognizable motif and festive return.",
}
INTERVALS=(
 (2,-1), (3,-2), (-2,5), (1,2), (5,-3), (2,2),
 (4,-2), (2,3), (-2,4), (5,-1), (3,2), (2,-3),
)
RHYTHM=((0,480,1080),(0,720,1440),(0,360,960),(0,540,1200))
DURS=((240,360,360),(360,240,480),(240,480,360),(420,240,360))

def seed_spec(seed:int)->dict:
 if not 0<=seed<SAMPLES:raise ValueError("seed outside experiment")
 genre="ruins" if seed<6 else "carnival"
 root=(57+seed%6) if genre=="ruins" else (60+(seed-6)%6)
 a,b=INTERVALS[seed]
 pitches=[root,root+a,root+a+b]
 offsets=RHYTHM[seed%len(RHYTHM)]
 durations=DURS[(seed*3)%len(DURS)]
 bass=root-24
 if genre=="ruins":
  chord=[root-12,root-9,root-5]
  lead_program,pad_program=11,88
  bpm=90
 else:
  chord=[root-12,root-8,root-5]
  lead_program,pad_program=10,48
  bpm=120
 return dict(seed=seed,genre=genre,root=root,pitches=pitches,offsets=offsets,
             durations=durations,bass=bass,chord=chord,
             bpm=bpm,lead_program=lead_program,pad_program=pad_program)

def material(s:dict)->list[dict]:
 """Prepare each of six 4-bar chunks as three-track absolute-relative note events."""
 windows=[]
 for section in range(SECTIONS):
  tracks=[[],[],[]] # lead, bass, harmonic atmosphere
  pitches=list(s["pitches"])
  starts=list(s["offsets"])
  durs=list(s["durations"])
  bass=s["bass"]
  chord=list(s["chord"])
  if section==1: # elongate a recognizable motif at preserved intervals
   starts=[v*2 for v in starts]
   durs=[v*2 for v in durs]
  if section==2: # motif fragmentation
   pitches=pitches[:2]; starts=starts[:2];durs=durs[:2]
  if section==3: # harmonic context change, melodic motif preserved
   bass+=5;chord=[p+5 for p in chord]
  if section==4: # full motif in upper register
   pitches=[p+12 for p in pitches]
  for phrase in (0,2*BAR):
   for pitch,onset,duration in zip(pitches,starts,durs):
    tracks[0].append((phrase+onset,pitch,duration,88))
  for bar in range(4):
   at=bar*BAR
   tracks[1].append((at,bass,BAR-60,62))
   for pitch in chord:
    tracks[2].append((at,pitch,BAR-80,48))
  windows.append(dict(tracks=tracks,operation=(
    "introduce","augmentation","fragmentation","harmonic_recontextualization",
    "register_transfer","thematic_return")[section]))
 return windows

def midi_bytes(s:dict,order:list[int],density:bool=False)->bytes:
 midi=mido.MidiFile(type=1,ticks_per_beat=480)
 meta=mido.MidiTrack();midi.tracks.append(meta)
 meta.append(mido.MetaMessage("set_tempo",tempo=mido.bpm2tempo(s["bpm"]),time=0))
 meta.append(mido.MetaMessage("time_signature",numerator=4,denominator=4,time=0))
 meta.append(mido.MetaMessage("end_of_track",time=SECTION*SECTIONS))
 windows=material(s)
 programs=[s["lead_program"],32,s["pad_program"]]
 for idx in range(3):
  track=mido.MidiTrack();midi.tracks.append(track)
  track.append(mido.Message("program_change",channel=idx,program=programs[idx],time=0))
  events=[]
  for position,source in enumerate(order):
   for on,pitch,dur,vel in windows[source]["tracks"][idx]:
    at=position*SECTION+on
    events.extend([(at,1,pitch,vel),(at+dur,0,pitch,0)])
   if density and idx==0 and position in (1,2,3,4):
    # Add unrelated surface texture to the repeated introduction.
    for j in range(4):
     at=position*SECTION+BAR+j*360
     pitch=s["root"]+7+(j%2)*2
     events.extend([(at,1,pitch,70),(at+180,0,pitch,0)])
  last=0
  for at,on,pitch,vel in sorted(events,key=lambda x:(x[0],x[1],x[2])):
   track.append(mido.Message("note_on" if on else "note_off",channel=idx,
                            note=pitch,velocity=vel,time=at-last))
   last=at
  track.append(mido.MetaMessage("end_of_track",time=max(0,SECTION*SECTIONS-last)))
 return bytes(midi)

def note_inventory(blob:bytes,by_section=False):
 from io import BytesIO
 midi=mido.MidiFile(file=BytesIO(blob))
 result=[]
 for track_idx,track in enumerate(midi.tracks[1:],1):
  active={}
  at=0
  for msg in track:
   at+=msg.time
   if msg.type=="note_on" and msg.velocity>0:
    active[(msg.channel,msg.note)]=(at,msg.velocity)
   elif msg.type in ("note_off","note_on") and hasattr(msg,"note"):
    key=(msg.channel,msg.note)
    if key in active:
     start,velocity=active.pop(key)
     if by_section:
      result.append((start//SECTION,track_idx,start%SECTION,msg.note,at-start,velocity))
     else:
      result.append((track_idx,start%SECTION,msg.note,at-start,velocity))
  if active:raise ValueError("unclosed MIDI notes")
 return Counter(result)

def generate(dest:Path)->dict:
 (dest/"midi").mkdir(parents=True,exist_ok=True)
 (dest/"text_queries").mkdir(parents=True,exist_ok=True)
 for style,description in GENRE_BRIEFS.items():
  (dest/"text_queries"/(style+".txt")).write_text(description+"\n",encoding="utf-8")
 results=[]
 for seed in range(SAMPLES):
  s=seed_spec(seed)
  reference=None
  for kind in KINDS:
   data=midi_bytes(s,ORDERS[kind],density=kind=="density")
   name=f"motif_{seed:02d}_{kind}"
   (dest/"midi"/(name+".mid")).write_bytes(data)
   if kind=="ordered":reference=data
   elif kind in ("swap","reverse","rotate"):
    if note_inventory(data)!=note_inventory(reference):
     raise AssertionError("Permutation changed note material: "+name)
   row={k:s[k] for k in ("seed","genre","root","bpm","pitches","offsets","durations")}
   row.update({"id":name,"condition":kind,"order":ORDERS[kind],"file":"midi/"+name+".mid",
               "query":s["genre"],"sha256":hashlib.sha256(data).hexdigest()})
   results.append(row)
 manifest={"version":"multiseed-clamp3-v1","generation":"deterministic synthetic, no human music",
           "sections":SECTIONS,"sectionBars":4,"seeds":SAMPLES,
           "prompts":GENRE_BRIEFS,"conditions":KINDS,"cases":results}
 (dest/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
 return manifest

def main()->None:
 parser=argparse.ArgumentParser()
 parser.add_argument("--out",type=Path,required=True)
 args=parser.parse_args()
 result=generate(args.out)
 print(json.dumps({"generated":len(result["cases"]),"seedCount":SAMPLES,
                   "styleCounts":{s:sum(x["genre"]==s for x in result["cases"]) for s in GENRE_BRIEFS}}))

if __name__=="__main__":
 main()
