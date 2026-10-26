# Motif Development Effectiveness Benchmark (A–E)

Status: controlled synthetic benchmark implemented; CLaMP 3 inference and human listening NOT executed. This experiment does not alter the production composition model, approval gate or MusicProject state.

## Scope and hypotheses

This benchmark extends PR #35 motif identity representation and PR #37's composition branch. It tests plan-position-specific motif evidence, NOT aesthetic quality.

| Case | MIDI content | Expected finding |
|---|---|---|
| A static_loop | identical three-note motif repeated six times | intro and return but no development |
| B surface_density | A plus extra unrelated notes | greater density without intended transformation |
| C developed | theme, augmentation, fragment, changed bass, octave transfer, return | six plan-aligned observations |
| D scrambled | exactly C's six sections reordered | fewer correctly placed observations |
| E style_mismatch | byte-identical MIDI to C, carnival brief rather than ruins | identical structure; different text-to-MIDI matching |

All MIDI notes are synthetic and original. 24 bars of 4/4, 90 BPM, 480 PPQ, approximately 64 seconds.

## Run deterministic checks

    pnpm install --no-frozen-lockfile
    pnpm --filter @ai-composer/composition typecheck
    pnpm --filter @ai-composer/composition test
    python3 experiments/motif-development/export_midis.py --out experiments/motif-development/generated
    python3 -m unittest discover -s experiments/motif-development -p 'test_*.py' -v

The TypeScript evaluator at packages/composition/src/evaluation/temporal-development.ts uses the actual planned six windows and the existing motif identities. It reports per-operation evidence, counts and uncertainty (not musical-quality scores). The MIDI exporter generates five playable MIDI files, text prompts, and a checksummed manifest. The GitHub Action attaches a motif-development-midi-a-e artifact.

## Optional external CLaMP 3 C2 experiment

Upstream source: https://github.com/sanderwood/clamp3
Paper: https://aclanthology.org/2025.findings-acl.133/

1. Clone CLaMP 3 OUTSIDE this repo. Follow the upstream README to prepare its Python 3.10 environment and install requirements/weights. Select C2 symbolic weights by setting code/config.py to c2 (rather than saas), and verify that the matching checkpoint is under the upstream code directory.
2. Generate benchmark MIDI using export_midis.py.
3. From the CLaMP 3 repository root, with ABS paths to your local ai-composer-agent checkout, run:

    python clamp3_embd.py /ABS/ai-composer-agent/experiments/motif-development/generated/midi /ABS/ai-composer-agent/experiments/motif-development/clamp_cache/midi_features --get_global
    python clamp3_embd.py /ABS/ai-composer-agent/experiments/motif-development/generated/text_queries /ABS/ai-composer-agent/experiments/motif-development/clamp_cache/text_features --get_global

4. With numpy installed in that separate Python environment, from ai-composer-agent root run:

    python experiments/motif-development/score_clamp3.py --manifest experiments/motif-development/generated/manifest.json --midi-features experiments/motif-development/clamp_cache/midi_features --text-features experiments/motif-development/clamp_cache/text_features --out experiments/motif-development/clamp_cache/scores.json

The postprocessor compares C with A/B/D under the same ruins brief and C under ruins against byte-identical E under carnival. Global embedding cosine does NOT validate long-form development. C need not be preferred to D. This is an exploratory score, not a calibrated quality metric.

The score script cannot cryptographically authenticate external model weights from embedding arrays alone. Record the CLaMP upstream commit, C2 checkpoint hash and system versions separately. CLaMP and PyTorch are NOT product dependencies.

## Human listening

For A–D, randomize blinded clips with identical rendering, timbre, tempo and loudness. Rate recognizability of theme, purposeful development, emotional arc, task fit and overall preference individually. Use C and E as the SAME audio evaluated against DIFFERENT text briefs. Collect independent listeners, balanced orders and inter-rater consistency. No human listening data exists at this point.

## Decision criteria

- C should have more observed plan-aligned transformations than A, B and D in deterministic tests.
- If CLaMP assigns C and D similar scores, its global embedding cannot be the only long-range structure judge.
- If C/E produce similar text-to-MIDI similarity despite different briefs, it cannot be the only requirements judge.
- No result may approve or write candidate MIDI automatically; existing authorization, locking and revision checks remain in force.

## Real-audio blind listening protocol (added after initial benchmark)

The benchmark MIDI is now explicitly 24 complete 4/4 bars at 90 BPM (64 seconds). Synthetic score tests do NOT constitute human listening evidence.

Audio playback used the same software synthesizer, GM instruments and soundfont for all five examples, with a common gain across the set. The same MIDI in C/E yields byte-identical rendered MP3. No soundfont file is distributed.

After rendering one labeled MP3 per condition as A_static_loop.mp3 etc., create a reviewer folder with an answer key stored OUTSIDE that folder:

    python experiments/motif-development/blind_study.py prepare --audio /PATH/TO/MP3 --out /PATH/reviewer_pack --key /PRIVATE/key.json

The reviewer pack contains randomly numbered clip_XX.mp3 files and a blank rating_form.csv. Each participant fills participantId and all five 1–5 rating fields, and saves a separate completed CSV. The hidden key must NOT be shared with listeners until all ratings have been submitted.

To aggregate real participant responses:

    python experiments/motif-development/blind_study.py summarize --key /PRIVATE/key.json --responses /RESPONSES/rater01.csv /RESPONSES/rater02.csv --out /PRIVATE/listening_summary.json

The summary reports descriptive means by source/brief and the within-person C/ruins minus E/carnival task-fit difference. It cannot calculate a meaningful p-value or claim quality improvement without sufficient actual listeners and a preregistered sampling plan. The C condition appears twice with the same task brief as a repeat-listening consistency check. D is intentionally a six-section permutation, not a new composition.

Tests of this aggregation code use named MOCK_PERSON data. They are NOT actual listening study results.

## October 26 follow-up: external inference reproducibility and bias controls

**Do not claim CLaMP 3 C2 has been tested by running only a NumPy mock.** The current GitHub CI uses fabricated mathematical vectors only for code correctness. No real model weights or listener submissions are shipped.

### Critical upstream failure mode

At the inspected upstream revision, the CLaMP 3 feature-extraction script downloads a default SAAS checkpoint when the computed configured weight path does not exist. It can therefore produce plausible embeddings with the WRONG model variant. The new fail-closed runner verifies the exact C2 path computed by code/config.py before launching any extraction. If the checkpoint cannot be confirmed, nothing is scored.

Obtain the authentic C2 weight from the official CLaMP 3 release; record its published checksum separately. In a local checkout with adequate resources, after exporting benchmark MIDI and selecting C2 in upstream config:

    python experiments/motif-development/run_clamp3_c2.py --clamp3-root /ABS/clamp3 --stimuli experiments/motif-development/generated --out experiments/motif-development/clamp_cache/new_run --expected-checkpoint-sha256 YOUR_VERIFIED_SHA256

The command above performs a preflight only; **no inference happens without --execute**. Only on a suitable machine and after verifying weights, add --execute. Never reuse a feature output directory: upstream silently skips feature extraction if the destination exists.

The guarded run writes provenance.json (Git revision, config/checkpoint hashes, MIDI manifest and prompts) and score_matrix.json. Every MIDI is scored against **both ruins and carnival** prompts. Report positive-minus-negative prompt margins, not a made-up 0–100 artistic rating. If C/E were byte-identical in MIDI but diverge in feature embeddings, inference fails rather than producing misleading numbers.

### Independent structural controls

    python experiments/motif-development/analyze_midis.py --stimuli experiments/motif-development/generated --out experiments/motif-development/generated/structure_report.json

This produces exact note-inventory and section-order results by parsing MIDI, independently from the planned-motif evaluator. C and D must contain the same bag of complete sections but differ by time order; C and E must contain identical sections. None of these observations demonstrate a musical aesthetic preference.

40 additional synthetic motifs (varied starting notes, interval contours and rhythms) exercise the same rules under static-loop, correct, scrambled, near-miss and missing-bass conditions. This is a **controlled intervention/generalization sanity test**, NOT held-out human music; the current rule family remains hand-designed.

### Blind-review independence

The form pack now includes six cyclically counterbalanced presentation sheets: rating_form_order_01.csv ... rating_form_order_06.csv. Distribute one per participant in rotation, with the same six numbered clips. Keep the answer key inaccessible to raters.

The aggregate first averages repeated C ratings *within* each listener, so C has one independent participant response regardless of how many times it was heard. It separately records repeated-clip disagreement and requires the paired C/C/E observations to report a task-brief difference. Incomplete forms are counted transparently. No inferential statistics or expert-listener claim is made without actual collected ratings.
