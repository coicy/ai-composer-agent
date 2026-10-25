#!/usr/bin/env python3
"""Postprocess independent CLaMP 3 C2 --get_global .npy features; no model dependency in main app."""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

def unique_feature(root: Path, stem: str) -> Path:
    hits = [p for p in root.rglob("*.npy") if p.stem == stem]
    if len(hits) != 1:
        raise ValueError(f"Expected exactly one feature for {stem} under {root}; found {len(hits)}")
    return hits[0]

def cosine(a, b) -> float:
    import numpy as np
    x, y = np.asarray(a).squeeze(), np.asarray(b).squeeze()
    if x.ndim != 1 or y.ndim != 1 or x.size != y.size or x.size < 16:
        raise ValueError("Require matching global embedding vectors; run --get_global")
    if not (np.isfinite(x).all() and np.isfinite(y).all()):
        raise ValueError("Non-finite feature")
    d = float(np.linalg.norm(x) * np.linalg.norm(y))
    if not d:
        raise ValueError("Zero norm")
    value = float(np.dot(x, y) / d)
    if not math.isfinite(value):
        raise ValueError("Non-finite cosine")
    return value

def score(manifest: Path, midi_features: Path, text_features: Path) -> dict:
    import numpy as np
    meta = json.loads(manifest.read_text(encoding="utf-8"))
    rows = []
    for case in meta["cases"]:
        midi = unique_feature(midi_features, Path(case["file"]).stem)
        text = unique_feature(text_features, case["query"])
        rows.append({
            "id": case["id"],
            "query": case["query"],
            "cosine": round(cosine(np.load(midi), np.load(text)), 6),
            "midi_feature": str(midi),
            "text_feature": str(text),
        })
    by_id = {row["id"].split("_", 1)[0]: row["cosine"] for row in rows}
    return {
        "model": "CLaMP 3 C2 (external user-supplied feature extraction)",
        "model_verified_by_script": False,
        "metric": "cosine of global cross-modal embeddings; NOT musical quality",
        "scores": rows,
        "comparisons": {
            "C_minus_A_ruins": round(by_id["C"] - by_id["A"], 6),
            "C_minus_B_ruins": round(by_id["C"] - by_id["B"], 6),
            "C_minus_D_ruins": round(by_id["C"] - by_id["D"], 6),
            "C_ruins_minus_E_carnival_same_MIDI": round(by_id["C"] - by_id["E"], 6),
        },
        "interpretation": "Exploratory only. C/D test ordering sensitivity. C/E test the brief while the MIDI is byte-identical. Human listening labels are not present.",
    }

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--midi-features", type=Path, required=True)
    parser.add_argument("--text-features", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    results = score(args.manifest, args.midi_features, args.text_features)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results["comparisons"], ensure_ascii=False))

if __name__ == "__main__":
    main()
