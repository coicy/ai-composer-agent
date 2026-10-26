#!/usr/bin/env python3
"""Join real CLaMP 3 C2 paired deltas with submitted blinded human ratings.

No comparison is reported when there are zero actual completed response pairs.
Never treat individual clips as independent musical compositions.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import json
from pathlib import Path
from statistics import mean
import math

def ranks(v:list[float])->list[float]:
 order=sorted(range(len(v)),key=lambda i:v[i])
 out=[0.]*len(v)
 i=0
 while i<len(order):
  j=i+1
  while j<len(order) and v[order[j]]==v[order[i]]:j+=1
  value=(i+j-1)/2+1
  for index in order[i:j]:out[index]=value
  i=j
 return out

def pearson(a:list[float],b:list[float])->float|None:
 if len(a)!=len(b) or len(a)<4:return None
 ma,mb=mean(a),mean(b)
 da=[x-ma for x in a];db=[y-mb for y in b]
 denom=math.sqrt(sum(x*x for x in da)*sum(y*y for y in db))
 return round(sum(x*y for x,y in zip(da,db))/denom,5) if denom>0 else None

def compare(model:dict,human:dict)->dict:
 if not model.get("status","").startswith("real-embedding-analysis"):
  raise ValueError("Require actual paired C2 embedding scores")
 if human.get("status")!="aggregated submitted human responses":
  raise ValueError("Require submitted human paired-rating summary")
 raw_human=human.get("pairedObservations",[])
 if not raw_human:
  return {"status":"awaiting_human_submissions","modelCandidates":model.get("midiCandidates"),
          "pairedHumanRatings":0,"rankCorrelation":None,
          "interpretation":"Cannot compute correlation without listener responses."}
 by_model={(x["seed"],x["variant"]):x["orderedMinusScrambled"]
           for x in model["orderedVsScrambled"]["comparisons"]}
 rows=defaultdict(list)
 listeners=set()
 for item in raw_human:
  key=(item["seed"],item["scramble"])
  if key not in by_model:raise ValueError("Human/model pair key mismatch")
  user=item["participant_id"]
  if not isinstance(user,str) or not user:raise ValueError("Participant id missing")
  delta=item["development_1to5"]
  if not isinstance(delta,(float,int)) or not -4<=delta<=4:
   raise ValueError("Invalid human development contrast")
  rows[key].append(float(delta))
  listeners.add(user)
 per_pair=[{"seed":seed,"scramble":variant,"c2OrderedMinusScrambled":by_model[(seed,variant)],
   "humanMeanOrderedMinusScrambled":round(mean(people),4),"humanPairedRatings":len(people)}
   for (seed,variant),people in sorted(rows.items())]
 # Collapse all ratings and permutations to one summary per seed. Do not
 # accidentally treat separate comparisons of the same synthetic composition
 # as independent samples for rank correlation.
 per_seed=[]
 for seed in sorted(set(x["seed"] for x in per_pair)):
  data=[x for x in per_pair if x["seed"]==seed]
  per_seed.append({"seed":seed,"modelDelta":round(mean(x["c2OrderedMinusScrambled"] for x in data),6),
   "humanDevelopmentDelta":round(mean(x["humanMeanOrderedMinusScrambled"] for x in data),4),
   "pairsIncluded":len(data)})
 x=[r["modelDelta"] for r in per_seed];y=[r["humanDevelopmentDelta"] for r in per_seed]
 coefficient=pearson(ranks(x),ranks(y))
 return {"status":"paired_comparison_descriptive_only" if coefficient is not None
          else "insufficient_independent_seeds",
         "uniqueParticipants":len(listeners),"seedCount":len(per_seed),
         "humanPairedRatings":len(raw_human),"matchedSeedVariantPairs":len(per_pair),
         "spearmanSeedLevel":coefficient,
         "signAgreementSeeds":sum(a*b>0 for a,b in zip(x,y)),
         "discordantSeeds":sum(a*b<0 for a,b in zip(x,y)),
         "zeroOrAmbiguousSeeds":sum(a*b==0 for a,b in zip(x,y)),
         "bySeed":per_seed,"bySeedPermutation":per_pair,
         "limits":"Correlations are descriptive, with repeated template-generated stimuli. Listener responses are not authenticated by this file, and no significance or expert-quality claim is made."}

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--model",type=Path,required=True)
 p.add_argument("--human",type=Path,required=True)
 p.add_argument("--out",type=Path,required=True)
 a=p.parse_args()
 result=compare(json.loads(a.model.read_text()),json.loads(a.human.read_text()))
 a.out.parent.mkdir(parents=True,exist_ok=True)
 a.out.write_text(json.dumps(result,indent=2)+"\n")
 print(json.dumps({k:v for k,v in result.items() if k not in ("bySeed","bySeedPermutation")},indent=2))

if __name__=="__main__":main()
