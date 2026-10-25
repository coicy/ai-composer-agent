#!/usr/bin/env python3
"""Generate original, deterministic, playable MIDI counterfactuals A–E. Stdlib only."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from struct import pack

PPQ, BAR, SECTION, BPM = 480, 1920, 7680, 90
PATTERNS = [
    dict(p=[60, 62, 61], t=[0, 480, 960], d=[240, 240, 240], bass=36),
    dict(p=[60, 62, 61], t=[0, 960, 1920], d=[600, 600, 600], bass=36),
    dict(p=[60, 62], t=[0, 480], d=[240, 240], bass=36),
    dict(p=[60, 62, 61], t=[0, 480, 960], d=[240, 240, 240], bass=41),
    dict(p=[72, 74, 73], t=[0, 480, 960], d=[240, 240, 240], bass=36),
    dict(p=[60, 62, 61], t=[0, 480, 960], d=[240, 240, 240], bass=36),
]
CASES = {
    "A_static_loop": ("static_loop", [0, 0, 0, 0, 0, 0]),
    "B_surface_density": ("surface_density", [0, 0, 0, 0, 0, 0]),
    "C_developed": ("developed", [0, 1, 2, 3, 4, 5]),
    "D_scrambled": ("scrambled", [0, 4, 2, 5, 1, 3]),
    "E_style_mismatch": ("style_mismatch", [0, 1, 2, 3, 4, 5]),
}

def varlen(n: int) -> bytes:
    if not 0 <= n < 2**28:
        raise ValueError("invalid delta")
    data = [n & 127]
    n >>= 7
    while n:
        data.insert(0, (n & 127) | 128)
        n >>= 7
    return bytes(data)

def chunk(events: list[tuple[int, int, bytes]]) -> bytes:
    data = bytearray()
    last = 0
    for tick, priority, message in sorted(events, key=lambda e: (e[0], e[1], e[2])):
        data.extend(varlen(tick - last))
        data.extend(message)
        last = tick
    data.extend(b"\x00\xff\x2f\x00")
    return b"MTrk" + pack(">I", len(data)) + data

def make_track(notes: list[tuple[int, int, int]], channel: int, name: str) -> bytes:
    events = [(0, 0, b"\xff\x03" + varlen(len(name)) + name.encode("ascii"))]
    for tick, pitch, duration in notes:
        if not 0 <= pitch <= 127 or duration <= 0:
            raise ValueError("invalid MIDI note")
        events.append((tick, 2, bytes([0x90 | channel, pitch, 80])))
        events.append((tick + duration, 1, bytes([0x80 | channel, pitch, 0])))
    return chunk(events)

def make_case(kind: str, order: list[int]) -> tuple[bytes, int]:
    melody, bass = [], []
    for i, idx in enumerate(order):
        p = PATTERNS[idx]
        for pitch, tick, dur in zip(p["p"], p["t"], p["d"]):
            melody.append((i * SECTION + tick, pitch, dur))
        if kind == "surface_density" and 0 < i < 5:
            for j, pitch in enumerate([67, 69, 67]):
                melody.append((i * SECTION + 1500 + j * 700, pitch, 240))
        bass.append((i * SECTION, p["bass"], 960))
    tempo = round(60_000_000 / BPM)
    meta = chunk([
        (0, 0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
        (0, 1, b"\xff\x58\x04\x04\x02\x18\x08"),
    ])
    header = b"MThd" + pack(">IHHH", 6, 1, 3, PPQ)
    return header + meta + make_track(melody, 0, "Lead") + make_track(bass, 1, "Bass"), len(melody)

def export(output: Path) -> dict:
    (output / "midi").mkdir(parents=True, exist_ok=True)
    (output / "text_queries").mkdir(parents=True, exist_ok=True)
    (output / "text_queries" / "ruins.txt").write_text(
        "Mysterious ancient ruins exploration. Sparse motif, gradual transformation, dark atmosphere, thematic return.\n",
        encoding="utf-8")
    (output / "text_queries" / "carnival.txt").write_text(
        "Joyful upbeat carnival celebration, cheerful bright playful dance music.\n",
        encoding="utf-8")
    manifest = {"version": "motif-benchmark-1", "ppq": PPQ, "tempoBpm": BPM,
                "bars": 24, "containsHumanListeningScores": False, "cases": []}
    for key, (kind, order) in CASES.items():
        midi, count = make_case(kind, order)
        path = output / "midi" / (key + ".mid")
        path.write_bytes(midi)
        manifest["cases"].append({
            "id": key, "type": kind, "file": str(Path("midi") / path.name),
            "sha256": hashlib.sha256(midi).hexdigest(), "notes": count,
            "query": "carnival" if kind == "style_mismatch" else "ruins",
            "provenance": "original synthetic MIDI, no third-party reference notes",
        })
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("experiments/motif-development/generated"))
    args = ap.parse_args()
    manifest = export(args.out)
    cases = {c["type"]: c for c in manifest["cases"]}
    assert cases["developed"]["sha256"] == cases["style_mismatch"]["sha256"], "E must use same notes as C"
    assert cases["developed"]["sha256"] != cases["scrambled"]["sha256"], "order corruption must alter MIDI"
    print(json.dumps({"generated": len(manifest["cases"]), "folder": str(args.out),
                      "C_equals_E": True, "C_differs_D": True}))

if __name__ == "__main__":
    main()
