# Seeded multi-candidate arrangement and selective part mixing

## Behavior and reproducibility contract

The multi-track arrangement editor now accepts a user-entered **unsigned 32-bit seed (0–4294967295)** and a **2–4 variant** count. With the same immutable MusicProject snapshot (including its revision), source track and note content, window, harmony plan, requested instruction, algorithm version, and derived seed, the **offline SeededArranger** yields the same MIDI pitch, onset, duration and velocity arrays.

Variants use a stable derivation `derivedSeed = (baseSeed + Math.imul(index, 0x9e3779b9)) >>> 0`. Each role has an independent LCG state derived from that variant seed. No `Math.random`, global mutable RNG or time of day participates. The deterministic offline arranger varies voicing and articulation inside applicable hard chord/scale/register/inversion rules. The seed is a **generative parameter, not a security token**; these outputs are illustrative, not professionally evaluated arrangements.

**Important**: a model-backed generation uses the seed only as a **variation guide** in model input. Current OpenAI Responses API invocation does **not** offer, or claim, exact generation reproducibility. The same seed and prompt may give different notes. To preserve model output exactly you must save the selected MIDI candidate; storing only a model seed is not enough.

## Workflow

1. Select a read-only reference melody, arrangement scope and optional hard/soft HarmonyPlan.
2. Enter a base seed and number of candidates; press **按种子生成多方案（离线）** or **AI 多方案比较**.
3. Each derived seed generates an independently validated complete three-track candidate; all share the same original project revision, source, plan and arrangement window.
4. Review candidate diagnostics: MIDI note count, advisory structural findings and harmony-plan warnings. Select a candidate to overlay its notes in the piano roll and audition melody + candidate audio.
5. Optionally choose *different* variants for harmony, bass, and accompaniment. Click **组合所选声部并重新验证**. The resulting hybrid is **rebuilt as new note data**, not by splicing old ChangeSets. It undergoes the complete Music Core candidate dry-run, source immutability, hard-plan checks and advisory re-evaluation.
6. Confirm the three selected new tracks as **one atomic transaction**, or cancel, and use a single undo to restore the previous project. No candidate alters the original source track before approval.

## Failure and bounds

- All seeds are validated in UI, request, API service and composition core. Invalid or fractional or out-of-range seeds are rejected.
- A batch is bounded to 2–4 candidates, each max 4 bars and 128 generated notes across its three tracks.
- Cancellation halts the sequence; any invalid candidate rejects the entire batch, with no partial publication or write.
- Role mixing verifies the candidates share the same revision/source/window/plan and the expected derived seed per bank index. Mixing against a changed project is rejected; no stale ChangeSets are merged.
- Preview/approval remains explicitly controlled by the user and Music Core. Strict musical hard constraints cannot be relaxed merely by generating alternative seeds.

## Limitations and next step

This is **variant comparison with part-level choice**, not yet independent local bar-by-bar revision of selected fragments within the same track. The current diagnostics are heuristic; fewer warnings does not automatically imply more musical beauty or correctness.

Next: build bar- or phrase-level regeneration around protected note IDs and track-local target scopes, preserving approved parts of an arrangement over multiple Agent iterations. Make RNG/plan/provider metadata exportable alongside MIDI for project provenance, because a MIDI file alone does not retain every generation parameter.
