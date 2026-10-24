# S4: phrase-level automation planning (first vertical slice)

This branch builds on S3 PR #32, which builds on S2 #31, S1 #30 and S0 #29.

## Implemented
- Pure deterministic plan for gain and filter frequency with explicit roles, sample-independent numeric boundaries, seed and phrase return.
- Optional timbral motion for ambient, synthwave and trance harmony/accompaniment roles.
- Respect disabled lanes; no drum-role fabrication; no automatic writes to MusicProject.
- Explicit unit tests and exported API.

## Not implemented / release gate
- Web Audio scheduling of curves, smoothing, sample-accurate automation, real sidechain ducking, independent drum composition, project persistence and listening validation.
- Existing three-role LLM MIDI generation remains unchanged. High style weights in S1 only become credible after returned MIDI demonstrates the technique.
- Run `pnpm check` and browser E2E in CI, then conduct annotated MIDI listening comparisons. Do not merge before S0-S3 dependencies pass.

## Follow-on S4 slices
1. Renderer opt-in integration: interpolate points against the current AudioContext timebase, stop/cancel on preview disposal; clamp to safe ranges.
2. Kick-triggered gain ducking, only when an actual kick MIDI part exists and can be inspected; no sidechain claims from mere presets.
3. Candidate-level evidence gating for supported signatures, with retry or disclosure when high-weight patterns were not realized.
4. New authorized drum role so House/DnB foundational patterns can become actual MIDI notes.
