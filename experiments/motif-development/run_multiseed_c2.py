#!/usr/bin/env python3
"""Run real public CLaMP 3 C2 embeddings over the 12-seed MIDI corpus.

Fails closed on an unverified checkpoint, changed manifest, mixed extraction
caches, or incomplete feature outputs. CPU is supported.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import sys

from multiseed_score import evaluate,validate_stimuli

# Published verified C2 checkpoint digest.
EXPECTED_C2_SHA256="e6fb0d139b24a1ec20836bb65bd652303d570ea9af2cddb20a1fc161421d64af"

def sha256(path:Path)->str:
 h=hashlib.sha256()
 with path.open("rb") as f:
  for buf in iter(lambda:f.read(4*1024*1024),b""):h.update(buf)
 return h.hexdigest()

def preflight(upstream:Path,stimuli:Path)->dict:
 upstream=upstream.resolve()
 config=upstream/"code/config.py"
 extractor=upstream/"clamp3_embd.py"
 if not config.is_file() or not extractor.is_file():raise ValueError("CLaMP 3 source is missing")
 name=runpy.run_path(str(config)).get("CLAMP3_WEIGHTS_PATH")
 if not isinstance(name,str) or not Path(name).name.startswith("weights_clamp3_c2"):
  raise ValueError("This task requires the configured C2 checkpoint, not SAAS")
 ckpt=upstream/"code"/Path(name).name
 if not ckpt.exists() or not ckpt.stat().st_size>100_000_000:
  raise ValueError("Configured C2 checkpoint missing")
 if sha256(ckpt)!=EXPECTED_C2_SHA256:raise ValueError("C2 checkpoint SHA256 mismatch")
 raw=subprocess.run(["git","-C",str(upstream),"rev-parse","HEAD"],
                    capture_output=True,text=True,check=True).stdout.strip()
 if raw!="9016d2b0c8d12d1aa79c2e0ab201e6822bdc83a8":
  raise ValueError("Official CLaMP 3 upstream revision changed")
 m=validate_stimuli(stimuli)
 return {"model":"CLaMP 3 C2","checkpointSha256":EXPECTED_C2_SHA256,
         "checkpointBytes":ckpt.stat().st_size,"upstreamRevision":raw,
         "configSha256":sha256(config),
         "manifestSha256":sha256(stimuli/"manifest.json"),
         "sampleCount":len(m["cases"]),"sourceTexts":{
           key:sha256(stimuli/"text_queries"/(key+".txt")) for key in ("ruins","carnival")},
         "deviceExpectation":"CPU","realModelInference":False}

def run(upstream:Path,stimuli:Path,out:Path,provenance:dict)->dict:
 upstream=upstream.resolve();stimuli=stimuli.resolve();out=out.resolve()
 midi_out=out/"midi_features";text_out=out/"text_features"
 if midi_out.exists() or text_out.exists():raise ValueError("Refusing stale output caches")
 for src,dst in [(stimuli/"midi",midi_out),(stimuli/"text_queries",text_out)]:
  subprocess.run([sys.executable,"clamp3_embd.py",str(src),str(dst),"--get_global"],
                 cwd=upstream,check=True)
 result=evaluate(stimuli,midi_out,text_out)
 out.mkdir(parents=True,exist_ok=True)
 (out/"score_multiseed.json").write_text(json.dumps(result,indent=2)+"\n")
 verified={**provenance,"realModelInference":True,"hasValidScoreMatrix":True,
           "scoreMatrixFilename":"score_multiseed.json"}
 (out/"provenance.json").write_text(json.dumps(verified,indent=2)+"\n")
 return verified

def main()->None:
 p=argparse.ArgumentParser()
 p.add_argument("--clamp3-root",type=Path,required=True)
 p.add_argument("--stimuli",type=Path,required=True)
 p.add_argument("--out",type=Path,required=True)
 p.add_argument("--execute",action="store_true")
 args=p.parse_args()
 report=preflight(args.clamp3_root,args.stimuli)
 if args.execute:
  report=run(args.clamp3_root,args.stimuli,args.out,report)
 else:
  report={**report,"status":"preflight only; real embeddings NOT calculated"}
 print(json.dumps(report,indent=2))

if __name__=="__main__":
 main()
