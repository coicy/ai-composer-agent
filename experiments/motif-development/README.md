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
