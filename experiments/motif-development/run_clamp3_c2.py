#!/usr/bin/env python3
"""Guarded, opt-in, provenance-recorded CLaMP 3 C2 inference for real MIDI.

Do not silently use upstream's SAAS auto-download fallback. Dry preflight by
default; --execute explicitly opts into potentially expensive model inference.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import runpy
from pathlib import Path
import subprocess
import sys

from score_clamp3 import score, verify_midi_manifest

def digest(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda:file.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

def inspect(upstream: Path, stimuli: Path, minimum_checkpoint_bytes: int=100_000_000,
            expected_checkpoint_sha256: str|None=None) -> dict:
    upstream=upstream.resolve()
    stimuli=stimuli.resolve()
    config=upstream/"code"/"config.py"
    extractor=upstream/"clamp3_embd.py"
    manifest=stimuli/"manifest.json"
    if not config.is_file() or not extractor.is_file() or not manifest.is_file():
        raise ValueError("Missing official CLaMP repository or exported benchmark files")
    text=config.read_text(encoding="utf-8")
    if '"weights_clamp3_c2"' not in text:
        raise ValueError("Expected code/config.py to use the C2 symbolic checkpoint, not SAAS")
    weights=sorted((upstream/"code").glob("weights_clamp3_c2*.pth"))
    if len(weights)!=1 or weights[0].stat().st_size < minimum_checkpoint_bytes:
        raise ValueError("Missing/ambiguous C2 checkpoint. Download it explicitly, verify the source, and place it under code/")
    # The upstream extractor otherwise silently switches to SAAS if this exact
    # configured filename is absent. Check the computed path, not just prefix.
    configured=runpy.run_path(str(config)).get("CLAMP3_WEIGHTS_PATH")
    if not isinstance(configured,str) or Path(configured).name != weights[0].name:
        raise ValueError("C2 checkpoint filename differs from the path computed by upstream config")
    sha=digest(weights[0])
    if expected_checkpoint_sha256 and sha.lower()!=expected_checkpoint_sha256.lower():
        raise ValueError("Checkpoint SHA256 does not match the supplied expected digest")
    meta=json.loads(manifest.read_text(encoding="utf-8"))
    verify_midi_manifest(meta,manifest)
    for prompt in ("ruins.txt","carnival.txt"):
        if not (stimuli/"text_queries"/prompt).is_file():
            raise ValueError("Missing negative/positive prompt control: "+prompt)
    try:
        revision=subprocess.run(["git","-C",str(upstream),"rev-parse","HEAD"],
              capture_output=True,text=True,check=True).stdout.strip()
    except (subprocess.CalledProcessError,OSError) as exc:
        raise ValueError("The upstream repository must be a Git checkout") from exc
    return {
        "pipeline":"CLaMP 3 C2 external benchmark; checkpoint presence and naming verified, authenticity unverified unless expected digest supplied",
        "upstreamGitRevision":revision,
        "configSha256":digest(config),
        "checkpointFilename":weights[0].name,
        "checkpointSizeBytes":weights[0].stat().st_size,
        "checkpointSha256":sha,
        "checkpointMatchesUserExpectedSha256":bool(expected_checkpoint_sha256),
        "manifestSha256":digest(manifest),
        "promptSha256":{name:digest(stimuli/"text_queries"/(name+".txt")) for name in ("ruins","carnival")},
        "sampleCount":len(meta["cases"]),
        "generatedScores":False,
    }

def execute(upstream: Path, stimuli: Path, output: Path, provenance: dict)->dict:
    # Upstream automatically skips feature extraction when its output dir exists.
    # Explicitly reject stale or mixed-version caches.
    upstream=upstream.resolve()
    stimuli=stimuli.resolve()
    output=output.resolve()
    midi_dir=output/"midi_features"
    text_dir=output/"text_features"
    if midi_dir.exists() or text_dir.exists():
        raise ValueError("Feature output already exists; use a fresh output directory")
    if output == stimuli or upstream == output:
        raise ValueError("Separate output directory required")
    for source, dest in ((stimuli/"midi",midi_dir),(stimuli/"text_queries",text_dir)):
        subprocess.run([sys.executable,"clamp3_embd.py",str(source),str(dest),"--get_global"],
                        cwd=upstream,check=True)
    result=score(stimuli/"manifest.json",midi_dir,text_dir)
    output.mkdir(parents=True,exist_ok=True)
    report={**provenance,"generatedScores":True,"scoreFilename":"score_matrix.json"}
    (output/"provenance.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    (output/"score_matrix.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    return report

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--clamp3-root",type=Path,required=True)
    parser.add_argument("--stimuli",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--expected-checkpoint-sha256")
    parser.add_argument("--execute",action="store_true",help="Opt in to heavy real inference")
    args=parser.parse_args()
    provenance=inspect(args.clamp3_root,args.stimuli,
                       expected_checkpoint_sha256=args.expected_checkpoint_sha256)
    if args.execute:
        result=execute(args.clamp3_root,args.stimuli,args.out,provenance)
    else:
        result={**provenance,"status":"preflight_passed; inference NOT executed"}
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
