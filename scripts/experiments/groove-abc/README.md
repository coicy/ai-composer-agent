# 16-bar D Dorian / Shuffle arrangement A/B/C

**Experiment status:** real MIDI and MP3 synthesis; not a causal claim of reference-driven composition improvement.

Run with Python 3.11+, mido, numpy, libfluidsynth3, ffmpeg and a legally obtained TimGM6mb SoundFont:

```sh
export AI_COMPOSER_REFERENCE_SOURCE=/absolute/path/to/pr19-checkout/references
python scripts/experiments/groove-abc/build_experiment.py
python scripts/experiments/groove-abc/verify_experiment.py
```

With `AI_COMPOSER_REFERENCE_SOURCE`, the composer reads exact source MIDI from the **per-file licensed** PR #19 Git corpus and verifies each referenced source SHA-256 before extracting features. It can alternatively read the signed ZIP from the earlier dataset experiment; it never downloads unreviewed MIDI automatically.

The shared task fixes 16 bars, 112 BPM, D Dorian, the exact 77-note lead pitch sequence, 16 chord labels and the same four GM instruments. A: no references; B: source style label `blues/shuffle`; C: measured midbeat onset and dynamics from two Groove MIDI recordings labeled `blues/shuffle`, recorded by the **same drummer**, with CC BY 4.0 attribution and without copying original note events.

The resulting files are `variant_A/B/C.mid`, equal-loudness `variant_A/B/C.mp3`, `experiment_results.json` and `source_reference_features.json`. Open `blind_listen.html` in a browser next to the MP3 to rate X/Y/Z anonymously and export a CSV.

**Scope warnings:** The three variants were authored by one GPT-6 assistant in a **single** conversation, without independent runs or context isolation; Python handles score realization and audio rendering, not general-LLM generation. More drum notes/dynamic range do not automatically mean better music. This experiment does not prove a modal center, subjective Shuffle quality, commercial audio rights or complete MCP application/editor functionality. TimGM6mb is a GPL-2 soundfont, not bundled with the test artifacts; commercial distribution of synthesized audio requires separate review.

See [full report](../../../docs/ARRANGEMENT_EXPERIMENT_ABC_V1.md) and [source reference attribution](https://github.com/coicy/ai-composer-agent/blob/feat/curated-midi-style-reference-pack/references/THIRD_PARTY_NOTICES.md).

CI runs the real offline process from an **immutable source commit** and uploads the three MIDI and three MP3 files as a downloadable Action artifact.
