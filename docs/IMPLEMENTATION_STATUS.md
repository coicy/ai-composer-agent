# Implementation status

Basic piano-roll editing, multi-track selection, Web Audio preview, MIDI I/O, transactional note operations and in-memory undo/redo are implemented as a prototype. The optional loopback OpenAI adapter can generate/append/replace MIDI note candidates with explicit approval.

New mouse marquee selection: a selection rectangle chooses stable note IDs; the AI **仅重写框选音符** mode replaces only those IDs, retaining unrelated notes even if they overlap in time. Validation remains two-stage (server/client) plus revision-checked commit. A pure tested geometry package isolates hit-testing from UI and Music Core.

Not yet complete: production authentication, live model music quality tests, real DAW-grade editing, sophisticated automatic accompaniment, arbitrary meter/key and multi-track AI operations.
## Music-edit constraints
- Implemented hard `pitch_only` constraint for model-powered rewrite of explicitly selected note IDs. The validator requires the identical note count and rhythm multiset, and produces only stable-ID pitch update operations; velocity, timing and other notes remain intact.
- Deterministic, model-free ±12-semitone transposition now uses the same preview/approval/revision pipeline.
- Mock/provider and validation tests cover timing changes, count mismatch, no-op, locks, pitch overflow and unrelated notes.
- Live model usefulness and browser drag interactions remain unverified beyond automated type/unit checks. See [MUSIC_EDIT_CONSTRAINTS.md](MUSIC_EDIT_CONSTRAINTS.md).

## Piano Roll interaction increment
- MIDI 0–127 vertical scrolling with 128 keyboard/grid rows; horizontal zoom with 4 discrete scales.
- Selected note groups can be dragged as a single atomic change set; numeric velocity editing applies to the current or selected notes as one transaction.
- Geometry and gesture construction have unit tests, but no real-browser Playwright E2E or performance profiling has been executed.
- The GUI is still a DOM/CSS prototype; instrument samples, velocity lane, vertical zoom, timeline transport and full DAW interaction remain future work. See docs/PIANO_ROLL_VIEWPORT.md.

## Velocity lane / browser tests
- Added a draggable Velocity lane aligned to Piano Roll scroll and zoom. It dispatches intent to the existing `makeVelocityOperations` + Music Core transaction mechanism.
- Added Playwright Chromium E2E scenarios for note/zoom/velocity/undo and marquee/batch movement/undo, with a dedicated GitHub Actions job. The CI outcome must be checked before claiming browser test coverage passes.
- Full audio/visual DAW behavior, simultaneous overlapping velocity-bar disambiguation, and performance remain unverified.

## Atomic AI multitrack arrangement
- Added a second provider contract for producing three independent MIDI parts (harmony/bass/accompaniment) from one read-only source track; generated tracks are committed together as `add_track` operations.
- Enforced structural note/role/timing bounds and source-track immutability with deterministic validators and dry-run core operations. Source can remain locked.
- Browser now supports candidate overlays by arrangement role, temporary synthesized audio audition, offline seeded demonstration and explicit approval/undo.
- Real-model musical quality and high-density project performance remain unverified. New Playwright tests exercise offline approvals and rejected invalid remote output. See docs/MULTITRACK_ARRANGEMENT.md.

## Explainable arrangement diagnostics
- Added source melody pitch-class key hypotheses and bar-window triad suggestions, each explicitly marked as uncertain for sparse or ambiguous material.
- Arrangement candidates now include deterministic nonblocking diagnostics (simultaneous tension, bass register, voice crossing, large melodic leaps) rather than a misleading absolute musical-quality score.
- The provider receives advisory context; the web review shows evidence and warnings, and it still requires approval. See docs/ARRANGEMENT_DIAGNOSTICS.md.
- Needs grounded listening-based evaluation on a corpus; algorithmic checks do not validate musical creativity.

## Harmony planning (hard vs advisory)
- Introduced a user-authored `HarmonyPlan` with tonic/major-or-natural-minor, one diatonic triad degree per 4/4 bar, role-specific MIDI registers and independent hard/soft policies for scale, chord membership and register.
- Server and browser validate the plan before provider calls and deterministically check returned notes, including sustain across chord boundaries. Hard violations reject entire candidates; soft deviations only surface role-scoped counts.
- The model adapter receives the explicit plan in addition to separately marked uncertain source-key hypotheses. Offline arranger respects strict constraints for demonstration.
- Browser plan inputs, audit review, mocked remote rejection, and a source-preserving atomic three-track commit are covered by tests. See docs/HARMONY_PLANNING.md.

## Editable beat-level chord timeline
- A HarmonyPlan may now carry a contiguous quarter-beat chord timeline, up to 4 bars; segment split/merge and degree, diatonic seventh, inversion are edited in the browser. Earlier one-triad-per-bar plans remain compatible.
- Per-segment chord-tone membership is validated against every overlapping note duration; hard bass-inversion checks apply to the first bass note onset of each chord event, with missing entries rejected.
- Optional stepwise passing-tone exceptions allow carefully bounded nonchord motion between two chord tones, while independent scale hard constraints still apply. This is structural pattern recognition, not comprehensive counterpoint understanding.
- SeededArranger, OpenAI prompts and API errors were adapted for timelines. Chromium tests cover split, seventh/inversion plan preview/approval, and rejecting bad bass inversion response. See docs/HARMONY_TIMELINE.md.

## Seeded variant comparison (multi-track arrangement)
- Added a validated unsigned 32-bit `seed` property to arrangement requests and provider contexts. The offline arranger uses a local deterministic PRNG to vary voicings, note lengths and velocities without violating the chosen hard music plan.
- A batch workflow derives 2–4 reproducible seeds from the base seed; candidates are independently checked and compared by note count, structural advice and planning warnings.
- UI supports previewing any candidate and choosing harmony, bass and accompaniment from different candidates, then rebuilding a fresh three-track proposal with full validation rather than merging raw ChangeSets. The original source track is not changed before explicit confirmation.
- An OpenAI provider receives the numeric variation seed only as a hint: external model outputs are **not guaranteed repeatable**. No live-model quality/reproducibility study has been performed.
- See docs/ARRANGEMENT_VARIANTS.md.

## Scoped regeneration: browser UI
- Existing-track targeted re-arrangement is now available in the Piano Roll UI with independent source/target/role selection, bar range, seed, instruction, preview and audition.
- Only target-region note operations can be committed; MIDI source and other tracks are unaffected. Existing locks and crossing notes are rejected in composition core.
- Current UI does not automatically carry over a prior HarmonyPlan; no original arrangement plan is persisted as MusicProject data. See docs/SCOPED_ARRANGEMENT_REGENERATION.md.

## Iterative local variants and saved project provenance
- Scoped regeneration can generate 2–4 independently validated Seed variants for the same existing target track and window. Candidates can be switched, previewed, auditioned and approved as a single note ChangeSet.
- Approved multi-track and scoped generations append a bounded `generationHistory` provenance record atomically with note edits in Music Core (undo/redo covers metadata and MIDI data).
- A dedicated `composition.aic.json` project format preserves the complete project, including generation history and serialized approved HarmonyPlan. Import validates the project; Standard MIDI export/import remains available, but MIDI does not preserve JSON-only planning metadata.
- Region editing can explicitly reuse a validated saved chord plan covering the selected source/target/scope, including window slicing of a full-song timeline. The checkbox can disable reuse; the system never asserts a plan exists if none is saved.
- Multi-role candidate mixing stores per-role Seed provenance. Music core bounds history length and validates provenance before atomic commit. See docs/PROJECT_PROVENANCE.md.

## Read-only cross-part context for scoped regeneration
- Scoped regeneration now derives bounded target-before/target-original/target-after note context and protected parts from the validated MusicProject.
- API sends only validated target track/role intent; the server independently derives protected context, checks locks and crossing notes before the model invocation, and serializes note music fields without stable note IDs.
- Model is advised about phrase continuity and preserving other parts; only the chosen target role may be applied as a single revision-checked ChangeSet. Music quality remains untested against real arrangements.
- See docs/SCOPED_ARRANGEMENT_REGENERATION.md.

## Scoped single-role output (current)
- Explicit local editing intent now selects a one-role schema `{role,notes}` rather than generating discarded parts in all three roles; full initial AI arrangement retains `{tracks:[...]}`.
- Shared composition preflight verifies source melody and locked/cross-boundary target before model invocation. Client/server independently validate the selected role, MIDI fields/timing/quantity and that role's hard HarmonyPlan constraints.
- Seeded offline demonstration uses the role-specific deterministic stream; E2E and API tests ensure a malicious or legacy three-track payload cannot be committed as a scoped edit.
- No real-model token-cost measurements or listening assessment yet. See docs/SCOPED_ARRANGEMENT_REGENERATION.md.
