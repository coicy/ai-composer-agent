# Real CLaMP 3 C2 inference — October 26, 2026

**Completed: real pretrained-model inference** on GitHub Actions [run 40272039616](https://github.com/coicy/ai-composer-agent/actions/runs/40272039616) (conclusion: **success**). This is not the simulated NumPy test from PR #38.

## Reproduction identity

- Public upstream: https://github.com/sanderwood/clamp3 ; revision `9016d2b0c8d12d1aa79c2e0ab201e6822bdc83a8`
- Model variant: **CLaMP 3 C2**, explicitly selected in `code/config.py` (NOT SAAS).
- Checkpoint: `weights_clamp3_c2_h_size_768_t_model_FacebookAI_xlm-roberta-base_t_length_128_a_size_768_a_layers_12_a_length_128_s_size_768_s_layers_12_p_size_64_p_length_512.pth`
- Full verified SHA-256: `e6fb0d139b24a1ec20836bb65bd652303d570ea9af2cddb20a1fc161421d64af` (matches Hugging Face published SHA-256).
- Checkpoint bytes: `2518324732`; loaded Epoch 15, reported loss `3.98206827044487`.
- Inference device: **CPU**. Model parameter count shown in actual upstream logs: `457896960`.
- 5 original synthetic MIDI files with a fixed 24-bar, 90 BPM design, from the benchmark's `export_midis.py`; 2 English task descriptions: "mysterious ruins exploration" and "joyful carnival celebration".
- Embeddings: official `clamp3_embd.py --get_global` for all 5 MIDI and both text descriptions; pooled 768-dimensional representations, compared by cosine.
- Manifest SHA-256: `f714b8135e0e11c4dd1ecd82d1def89447167297122275b65cc7f4df50a2f77a`.
- The GitHub Actions artifact **real-clamp3-c2-result-or-failure-context** contains `score_matrix.json` and `provenance.json` (no weights). [Artifact link](https://github.com/coicy/ai-composer-agent/actions/runs/40272039616/artifacts/12627983290).

## Actual numeric output (cosine similarities)

| Candidate | Ruins prompt | Carnival prompt | Ruins minus carnival |
|---|---:|---:|---:|
| A: identical motif loop | 0.174530 | -0.090662 | 0.265192 |
| B: adds unrelated surface notes | 0.119646 | -0.108098 | 0.227744 |
| C: planned thematic development | 0.262298 | -0.059129 | 0.321427 |
| D: same six complete sections as C, rearranged | **0.274374** | -0.060763 | **0.335137** |
| E: byte-identical music to C, paired with carnival task | 0.262298 | -0.059129 | 0.321427 |

Controls passed: **C and E have identical SHA256 and equal embeddings**, and each candidate was scored against BOTH positive/negative prompts.

Computed contrasts:
- C − A under ruins = **+0.087768**.
- C − B under ruins = **+0.142652**.
- C − D under ruins = **−0.012076**. The deliberately scrambled D slightly outranked C on this global semantic metric.
- C under ruins − same MIDI under carnival = **+0.321427**.

## Interpretation and limitations

**Supported:** These 5 test stimuli were processed by the real official C2 checkpoint, and the model was sensitive to the broad difference between ruins and carnival descriptions. On this one intervention, its global text-MIDI similarity did **not** prefer the preregistered correct section ordering to the scrambled ordering.

**Not supported:** Claim that CLaMP 3 is totally order-blind (it does produce different scores), claim that D sounds worse or C sounds better (no human listening performed), claim statistical significance (n=1 engineered C/D example), or claim automatic aesthetic/music-development scoring is validated. Similarity is **not** a calibrated quality grade and negative cosine is not an error.

The next proper step is to run multiple independent original composition prompts, several different section permutations per composition, evaluate the within-piece score distribution, and separately collect blinded human comparisons. Use the model's semantic matching as a complementary feature, not a self-sufficient evaluator for development.

## Execution code

`.github/workflows/clamp3-c2-real-smoke.yml` reproduces the external run on GitHub-hosted Ubuntu with no local weight packaging. It downloads the pretrained C2 weight from the official Hugging Face repository, verifies its published SHA256, runs `experiments/motif-development/run_clamp3_c2.py --execute`, uploads ONLY small score/provenance JSON artifacts, and does not modify music or approve any candidate.
