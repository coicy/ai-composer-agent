#!/usr/bin/env python3
"""Analyze externally extracted CLaMP 3 C2 global features, never invent model scores.

A negative-prompt control is necessary: a large cosine alone does not establish
whether the MIDI is more appropriate for ruins than for a carnival.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path

PROMPTS = ("ruins", "carnival")
IDENTICAL_PAIR = ("C_developed", "E_style_mismatch")

def unique_feature(root: Path, stem: str) -> Path:
    hits = sorted(p for p in root.rglob("*.npy") if p.stem == stem)
    if len(hits) != 1:
        raise ValueError(f"Expected exactly one feature for {stem} under {root}; found {len(hits)}")
    return hits[0]

def vector(data):
    import numpy as np
    a = np.asarray(data).squeeze()
    if a.ndim != 1 or a.size < 16 or not np.isfinite(a).all():
        raise ValueError("Expected a finite global embedding vector; use --get_global")
    if not float(np.linalg.norm(a)):
        raise ValueError("Zero-norm global embedding")
    return a.astype("float64")

def cosine(a, b) -> float:
    import numpy as np
    x, y = vector(a), vector(b)
    if x.size != y.size:
        raise ValueError("Mismatched vector dimensions")
    result = float(np.dot(x, y) / (np.linalg.norm(x) * np.linalg.norm(y)))
    if not math.isfinite(result):
        raise ValueError("Non-finite cosine")
    return result

def verify_midi_manifest(meta: dict, manifest: Path) -> None:
    cases = meta.get("cases")
    if not isinstance(cases,list) or len(cases) < 5:
        raise ValueError("Invalid benchmark manifest")
    seen = set()
    for case in cases:
        identifier = case["id"]
        if identifier in seen or not identifier or "/" in identifier or "\\" in identifier:
            raise ValueError("Unsafe/duplicate sample identifier")
        seen.add(identifier)
        filename = Path(case["file"])
        if filename.is_absolute() or ".." in filename.parts:
            raise ValueError("Unsafe MIDI path")
        midi = manifest.parent / filename
        if not midi.is_file():
            raise ValueError(f"MIDI stimulus missing: {identifier}")
        sha = hashlib.sha256(midi.read_bytes()).hexdigest()
        if sha != case["sha256"]:
            raise ValueError(f"Manifest SHA256 mismatch for {identifier}")
    by_id = {c["id"]: c for c in cases}
    if not all(k in by_id for k in (*IDENTICAL_PAIR,"A_static_loop","B_surface_density","D_scrambled")):
        raise ValueError("Required A-E case missing")
    if by_id[IDENTICAL_PAIR[0]]["sha256"] != by_id[IDENTICAL_PAIR[1]]["sha256"]:
        raise ValueError("C and E must contain byte-identical MIDI")

def score(manifest: Path, midi_features: Path, text_features: Path) -> dict:
    import numpy as np
    meta=json.loads(manifest.read_text(encoding="utf-8"))
    verify_midi_manifest(meta,manifest)
    text_vectors={p:vector(np.load(unique_feature(text_features,p),allow_pickle=False)) for p in PROMPTS}
    feature_vectors={}
    for case in meta["cases"]:
        ident=case["id"]
        feature_vectors[ident]=vector(np.load(unique_feature(midi_features,Path(case["file"]).stem),allow_pickle=False))
    if not np.allclose(feature_vectors[IDENTICAL_PAIR[0]],feature_vectors[IDENTICAL_PAIR[1]],rtol=1e-5,atol=1e-6):
        raise ValueError("Byte-identical C/E MIDI produced different embeddings; verify deterministic model settings")
    matrix={}
    rows=[]
    for case in meta["cases"]:
        ident=case["id"]
        sims={p:round(cosine(feature_vectors[ident],text_vectors[p]),6) for p in PROMPTS}
        matrix[ident]=sims
        rows.append({"id":ident,"query":case["query"],"cosine":sims[case["query"]],
            "similarityByPrompt":sims,
            "ruinsMinusCarnival":round(sims["ruins"]-sims["carnival"],6)})
    def r(k,p="ruins"):return matrix[k][p]
    comparisons={
        "C_minus_A_ruins":round(r("C_developed")-r("A_static_loop"),6),
        "C_minus_B_ruins":round(r("C_developed")-r("B_surface_density"),6),
        "C_minus_D_ruins":round(r("C_developed")-r("D_scrambled"),6),
        "C_ruins_minus_E_carnival_same_MIDI":round(r("C_developed")-r("E_style_mismatch","carnival"),6),
        "C_ruins_minus_carnival_prompt":round(r("C_developed")-r("C_developed","carnival"),6),
        "D_ruins_minus_carnival_prompt":round(r("D_scrambled")-r("D_scrambled","carnival"),6),
    }
    return {
        "model":"CLaMP 3 C2 (UNVERIFIED external embeddings)",
        "model_verified_by_script":False,
        "stimulus_sha256_verified":True,
        "metric":"global text-to-MIDI cosine and paired negative-prompt differences, NOT musical quality",
        "prompts":list(PROMPTS),
        "scores":rows,
        "scoreMatrix":matrix,
        "comparisons":comparisons,
        "identicalMidiControl":{
            "C_and_E_have_same_sha256":True,
            "C_and_E_features_equal_within_tolerance":True,
        },
        "interpretation":"C/D probes temporal ordering, C/E probes SAME AUDIO against opposite prompts. Conclusions require real weight provenance, independent samples and human ratings.",
    }

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--manifest",type=Path,required=True)
    parser.add_argument("--midi-features",type=Path,required=True)
    parser.add_argument("--text-features",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    result=score(args.manifest,args.midi_features,args.text_features)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["comparisons"],ensure_ascii=False))

if __name__=="__main__":
    main()
