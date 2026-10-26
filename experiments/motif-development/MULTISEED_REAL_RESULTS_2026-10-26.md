# Real CLaMP 3 C2 — Twelve-motif paired-permutation benchmark

**Execution: SUCCESS**. Public pretrained CLaMP 3 C2, official checkpoint SHA-256 verified, real CPU inference; GitHub Actions run [40273712198](https://github.com/coicy/ai-composer-agent/actions/runs/40273712198).

**Stimuli:** twelve deliberately designed synthetic three-track motifs (six ruins-oriented minor/sparse arrangements and six carnival-oriented major/bright arrangements). Each motif has 24 bars in six four-bar sections with an original statement, rhythmic augmentation, fragmentation, reharmonization, register transfer and return. Six conditions per seed: ordered, swap, reverse, rotate, repeated static loop, and surface-note density increase. Total **72 MIDI**.

Each permutation preserves the exact complete four-bar section contents and changes only their sequence. Every MIDI receives two independently computed CLaMP text-to-music similarities (ruins / carnival). This test uses *new motifs*, but the **same compositional template**; do not treat its twelve cases as independent professional human compositions.

## Provenance
- Official code: `sanderwood/clamp3`, commit `9016d2b0c8d12d1aa79c2e0ab201e6822bdc83a8`.
- Official **C2** checkpoint SHA-256 `e6fb0d139b24a1ec20836bb65bd652303d570ea9af2cddb20a1fc161421d64af`; file size 2,518,324,732 bytes. Weight is not committed or included in artifacts.
- CPU inference using `clamp3_embd.py --get_global`; global 768-dimensional embeddings.
- Exact manifest digest: `a754eb2890897decd982962e33e2a8cec84bfe6c97dd98e42a7414604174b2be`.
- Reproducible experiment output: [Actions artifact clamp3-c2-multiseed-real-72](https://github.com/coicy/ai-composer-agent/actions/runs/40273712198/artifacts/12628689438), containing `score_multiseed.json`, `provenance.json`, `manifest.json`, and `run_status.json`.

## Within-motif temporal development check

Per motif, the **ordered** condition was compared with three permutations. Positive difference favors the intended order.

| Comparison | Mean cosine delta (ordered - scrambled) | Motifs favoring ordered |
|---|---:|---:|
| Swap two development sections | +0.003915 | 5 / 12 |
| Reverse all six sections | -0.001663 | 5 / 12 |
| Rotate six sections | -0.010601 | 4 / 12 |
| Average all 3 permutation contrasts **within each seed** | **-0.002783** | **4 / 12** |

For the seed-level average difference: median **-0.006795**, bootstrap 95% interval **[-0.007427, +0.002404]**. This interval is descriptive and **does not establish a population hypothesis test**: deterministic synthetic motifs share one generation grammar, and 36 paired differences are NOT 36 independent compositions.

Of the 12 seed groups, ordered ranked FIRST against three permutations only **3 times**, and ranked LAST **5 times**. No consistently preferred intended narrative order was observed.

## Prompt-matching failure mode

| Designed seed family (ordered condition only) | Mean cosine to ruins | Mean cosine to carnival | Matched prompt preferred |
|---|---:|---:|---:|
| Ruins-oriented (six seeds) | **+0.140148** | -0.067445 | 6 / 6 |
| Carnival-oriented (six seeds) | **+0.182845** | +0.020726 | **0 / 6** |

Across **all 72** MIDI candidates, the *ruins* text prompt received a higher cosine score than *carnival*, regardless of intended style. This does **not** prove the model cannot identify genre: prompts are only one English wording per style, and the synthetic carnival arrangements may not convincingly sound like carnival music. It **does** invalidate the stronger claim that the one-prompt pair in this experiment is already a calibrated style-fit evaluator. Evaluate with alternative prompt phrasings and human-verified recordings before making that claim.

## Human review — prepared, not conducted

GitHub Actions [run 40273783494](https://github.com/coicy/ai-composer-agent/actions/runs/40273783494) successfully rendered a **24-clip MP3** listening pack using the same GM SoundFont for matched audio. It contains six four-clip blocks, two playback order variants per block, and 1–5 rating forms for thematic development, task fit and overall impressions. Blind-rating form kit: [reviewer artifact](https://github.com/coicy/ai-composer-agent/actions/runs/40273783494/artifacts/12629765425). The answer key is a separate [researcher artifact](https://github.com/coicy/ai-composer-agent/actions/runs/40273783494/artifacts/12628759365) — do NOT distribute it to participants.

The aggregator is `experiments/motif-development/multiseed_blind.py summarize`. It handles participant-level pairing and cannot generate or claim real listener ratings. **0 real human reviews have been received**. Consequently, there is **no measured human-versus-CLaMP correlation**.

### Honest methodological interpretation

This real inference supports using CLaMP 3 C2, at most, as an *exploratory embedding feature* alongside independent motif and structural diagnostics. Neither global cosine nor the present scripted plan-matching rules establish artistic quality. Without blinded human data, refrain from automatic acceptance or production candidate ranking based on these numbers.

### Next validation gate

1. Collect completed genuine listening forms across both genre families, with participant consent and no identifying personal information.
2. Add multiple paraphrases of each creative brief and human-validated licensed or original real compositions; retain per-seed matched comparisons.
3. Compare planned order preference against listener paired development ratings, compute uncertainty by unique motif and unique participant (not by raw clip), report disconfirming examples, and keep review-only (no automatic commitment).
