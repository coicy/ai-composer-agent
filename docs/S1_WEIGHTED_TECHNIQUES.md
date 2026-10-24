# S1 — Automatically weighted musical techniques and phrase variations

> Feature PR above S0. This is an opt-out and user-overridable **creative preference plan**, never a second music model and never permission to bypass Music Core approval. Named-genre weights are initial **tunable research defaults**, not universal musical laws or verified classification accuracy.

## Key behavior

1. A single clear genre in the user's `instruction` (House, Techno, Trance, Synthwave, DnB, Chiptune, Ambient) or a **user-explicit** `techniqueIntent.genre` selects one style profile. Multiple genre hints are treated as ambiguous and require explicit selection. If no recognizable genre appears, the old arranger works unchanged.
2. `planElectronicTechniques` emits a versioned `weighted-techniques-v1` plan, sorting candidate techniques by style-specific weight. Signature (>84) and preferred (75–84) techniques are assigned to an available distinct role **by default**. Lower weight support can fill unused harmony/bass/accompaniment roles.
3. The server explicitly instructs the general-purpose LLM to **actually write original MIDI notes reflecting assigned high-priority techniques** and one meaningful phrase-ending variation, not merely describe them in text. Different numeric seeds choose auditable variant instructions. Exact LLM note output is not guaranteed reproducible.
4. Drum and whole-song structure techniques are **deferred** because the current three-role arrangement schema cannot output genuine drum/section data. For example House's `four_on_floor` has weight 100 but is reported as unsupported; the model must not substitute fake drum notes in melodic harmony tracks. Actual drum/section support requires later S1/S2 slices.
5. Same-role primary conflicts are suppressed; user `disabled` technique exclusions override any weight; `auto:false` disables all automatic style planning. Music Project hard constraints, lock/revision/scope and the user's approved harmony always prevail.
6. Browser three-track composer can leave automatic detection on, explicitly select a style, or turn it off. Candidate preview includes technique weights, specific role instructions, phrase changes, and deferred/unavailable roles. Local SeededArranger is labeled an **offline dev demonstration**, not a real implementation of these musical techniques.

## Representative default expectations

| Style | Auto role assignments | Deferred or not-yet-supported |
|---|---|---|
| House | Offbeat Bass 94, Syncopated Comp 88, Pad 61 | Kick Four-to-Floor 100, motif/sections |
| Synthwave | Arpeggio 97, Root-Octave Bass 92, Pad 88 | Retro Drum Pattern 80, whole-song form |
| Trance | Arpeggio 97, Offbeat Bass 89, Pad 76 | Kick 98, sections |
| Techno | Ostinato 94, Pedal Bass 80, Pad 57 | Kick 97, transition |
| Drum & Bass | Sub Bass 98, Ostinato 80, Pad 56 | Breakbeat 100, transitions |
| Chiptune | Pulse 95, Arpeggio 92, Root-Octave Bass 81 | whole-song motif |
| Ambient | Pad 97, Pedal Bass 74, sparse Arpeggio 58 | whole-song motif |

These are **starting weights to be validated by listening**, not claims of compulsory techniques for all subgenres. One style cue does not prove that the final audio sounds like that genre.

## Test and release bounds

- Source `packages/composition/src/planning/weighted-techniques.ts` pure algorithm; unit tests cover default strong assignments, variant differences, missing drum honesty, ambiguous style, user opt-out, invalid fields, 6/8 scope and phrase-tick boundaries.
- `prepareArrangementContext` computes the trusted plan from current user request and MusicProject meter. Browser and server both independently validate it.
- `createOpenAIArranger` sends plan as read-only additional context; strict original model output schema remains three roles, up to 64 notes per role and 128 total. No audio synth or DAW production ability claimed here.
- Live musical correctness and quality cannot be established through a model prompt alone. Subsequent work must assess note onset/pitch orders per technique, generate real new drum-role MIDI, and conduct multiple independent anonymous listener comparisons.
- No existing D-005/006/007 product rule is weakened. For non-electronic/unrecognized styles, the system preserves the previous generative path. A static style profile is only a starting point for agent creativity, not a substitute for a general-purpose LLM.
