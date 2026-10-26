#!/usr/bin/env python3
"""Analyze real CLaMP 3 C2 multiseed output; bootstrap unit is seed, not MIDI file.

All scores are cross-modal retrieval similarities, not calibrated music quality.
No human listening scores, expert labels, or significance claims.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import random
import statistics

PROMPTS=("ruins","carnival")
PERMUTATIONS=("swap","reverse","rotate")
CONDITIONS=("ordered",*PERMUTATIONS,"static","density")

def vector(path:Path):
 import numpy as np
 data=np.load(path,allow_pickle=False).squeeze()
 if data.ndim!=1 or data.size!=768 or not np.isfinite(data).all():
  raise ValueError(f"Expected finite 768-wide GLOBAL C2 vector: {path}")
 if float(np.linalg.norm(data))==0:raise ValueError("Zero embedding")
 return data.astype("float64")

def cosine(a,b)->float:
 import numpy as np
 return float(np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)))

def feature(root:Path,stem:str)->Path:
 files=list(root.rglob(stem+".npy"))
 if len(files)!=1:raise ValueError(f"Expected exactly one feature for {stem}: {len(files)}")
 return files[0]

def validate_stimuli(root:Path)->dict:
 from multiseed_export import KINDS,SAMPLES,SECTION,note_inventory
 meta=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
 cases=meta["cases"]
 if len(cases)!=SAMPLES*len(KINDS):raise ValueError("Unexpected number of samples")
 identifiers=set()
 originals={}
 for c in cases:
  key=(c["seed"],c["condition"])
  if c["id"] in identifiers:raise ValueError("Duplicate MIDI id")
  identifiers.add(c["id"])
  if c["condition"] not in KINDS or c["seed"] not in range(SAMPLES):
   raise ValueError("Unexpected seed or condition")
  if c["query"] not in PROMPTS:raise ValueError("Unexpected prompt")
  rel=Path(c["file"])
  if rel.is_absolute() or ".." in rel.parts:raise ValueError("Unsafe MIDI path")
  data=(root/rel).read_bytes()
  if hashlib.sha256(data).hexdigest()!=c["sha256"]:raise ValueError("Invalid MIDI checksum: "+c["id"])
  if c["condition"]=="ordered":originals[c["seed"]]=note_inventory(data)
 for c in cases:
  if c["condition"] in PERMUTATIONS:
   if note_inventory((root/c["file"]).read_bytes())!=originals[c["seed"]]:
    raise ValueError("Same-material permutation constraint violated")
 if {c["seed"] for c in cases}!=set(range(SAMPLES)):raise ValueError("Not all motifs present")
 for seed in range(SAMPLES):
  if {c["condition"] for c in cases if c["seed"]==seed}!=set(KINDS):
   raise ValueError("Missing condition")
 for p in PROMPTS:
  if not (root/"text_queries"/(p+".txt")).is_file():raise ValueError("Missing task prompt")
 return meta

def ci95_by_seed(differences:list[float],repetitions:int=5000)->list[float]:
 if not differences:return [None,None]
 if len(differences)==1:return [differences[0],differences[0]]
 rng=random.Random(190452)
 n=len(differences)
 samples=[statistics.mean(differences[rng.randrange(n)] for _ in range(n)) for _ in range(repetitions)]
 samples.sort()
 return [round(samples[int(.025*(repetitions-1))],6),round(samples[int(.975*(repetitions-1))],6)]

def summary(data:list[float])->dict:
 if not data:return {"n":0}
 return {"n":len(data),"mean":round(statistics.mean(data),6),
         "median":round(statistics.median(data),6),
         "positive":sum(x>1e-9 for x in data),
         "negative":sum(x< -1e-9 for x in data),
         "nearZero":sum(abs(x)<=1e-9 for x in data),
         "bootstrap95SeedCI":ci95_by_seed(data)}

def evaluate(stimuli:Path,midi_features:Path,text_features:Path)->dict:
 meta=validate_stimuli(stimuli)
 import numpy as np
 prompts={p:vector(feature(text_features,p)) for p in PROMPTS}
 by_seed=defaultdict(dict)
 by_id={}
 rows=[]
 for c in meta["cases"]:
  emb=vector(feature(midi_features,c["id"]))
  cos={p:round(cosine(emb,prompts[p]),7) for p in PROMPTS}
  record={"id":c["id"],"seed":c["seed"],"genre":c["genre"],
          "condition":c["condition"],"expectedPrompt":c["query"],
          "similarity":cos,"matchedMinusOther":round(cos[c["query"]]-cos[[p for p in PROMPTS if p!=c["query"]][0]],7)}
  rows.append(record)
  by_seed[c["seed"]][c["condition"]]=record
  by_id[c["id"]]=emb
 if any(len(row)!=len(CONDITIONS) for row in by_seed.values()):raise ValueError("Incomplete seed score matrix")
 overall,styles,permutation={},{},{}
 pairs=[]
 seed_diffs=[]
 style_diffs=[]
 rank=[]
 for seed in sorted(by_seed):
  trials=by_seed[seed]
  p=trials["ordered"]["expectedPrompt"]
  v=trials["ordered"]["similarity"][p]
  scrambled=[]
  for kind in PERMUTATIONS:
   alt=trials[kind]["similarity"][p]
   delta=round(v-alt,7)
   scrambled.append(delta)
   pairs.append({"seed":seed,"prompt":p,"variant":kind,"orderedScore":v,
                 "scrambledScore":alt,"orderedMinusScrambled":delta})
  seed_diffs.append(statistics.mean(scrambled))
  style_diffs.append(trials["ordered"]["matchedMinusOther"])
  rank.append({"seed":seed,"genre":p,"orderedRankAmongFour":
               1+sum(trials[k]["similarity"][p]>v for k in PERMUTATIONS)})
  for kind in PERMUTATIONS:
   permutation.setdefault(kind,[]).append(round(v-trials[kind]["similarity"][p],7))
 for genre in PROMPTS:
  indices=[i for i in sorted(by_seed) if by_seed[i]["ordered"]["genre"]==genre]
  styles[genre]={
   "orderedMinusMeanOfThreePermutations":summary([seed_diffs[i] for i in indices]),
   "correctStylePromptMinusOpposite":summary([style_diffs[i] for i in indices]),
   "orderedRank1Count":sum(rank[i]["orderedRankAmongFour"]==1 for i in indices),
   "orderedBottomRank4Count":sum(rank[i]["orderedRankAmongFour"]==4 for i in indices)}
 return {
  "status":"real-embedding-analysis, source provenance must be separately verified",
  "claimScope":"72 controlled synthetic MIDI samples across 12 seed compositions; NO humans, NO artistic quality claim",
  "seeds":len(by_seed),"midiCandidates":len(rows),
  "matchedPromptControl":{"orderedOnly":summary(style_diffs),
          "genreStyles":styles},
  "orderedVsScrambled":{
    "seedLevelMeanOfThreePermutations":summary(seed_diffs),
    "pairedMIDIComparisons":len(pairs),
    "eachPermutation":{k:summary(v) for k,v in permutation.items()},
    "orderedFirstAmongFour":sum(x["orderedRankAmongFour"]==1 for x in rank),
    "orderedLastAmongFour":sum(x["orderedRankAmongFour"]==4 for x in rank),
    "ranks":rank,
    "comparisons":pairs,
  },
  "allScores":rows,
  "limits":"Bootstrap samples 12 deterministic seed families, NOT 36 independent MIDI pairs. No independent artistic recordings or human preference judgments."
 }

def main()->None:
 parser=argparse.ArgumentParser()
 parser.add_argument("--stimuli",type=Path,required=True)
 parser.add_argument("--midi-features",type=Path,required=True)
 parser.add_argument("--text-features",type=Path,required=True)
 parser.add_argument("--out",type=Path,required=True)
 args=parser.parse_args()
 result=evaluate(args.stimuli,args.midi_features,args.text_features)
 args.out.parent.mkdir(parents=True,exist_ok=True)
 args.out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
 compact={k:v for k,v in result.items() if k in ("seeds","midiCandidates","matchedPromptControl")}
 compact["orderedVsScrambled"]={k:v for k,v in result["orderedVsScrambled"].items()
                                 if k not in ("comparisons","ranks")}
 print(json.dumps(compact,indent=2))

if __name__=="__main__":
 main()
