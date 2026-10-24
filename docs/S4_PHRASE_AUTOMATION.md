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

## S4.1: actual browser audio scheduling (added)
- `playProject(project, bpm, production, automation)` now optionally accepts a strictly checked `PlaybackAutomation`.
- Explicit `trackId` binds each gain/filter curve to an actual track; no automatic fuzzy name matching or invented drum lanes.
- Per-track Web Audio gain and lowpass nodes interpolate envelope points at real project tick times; existing project playback with omitted automation remains unchanged.
- Reject duplicate lanes, unknown tracks, out-of-range gains/cutoffs, bad time orders, and nonfinite values; unit tests assert scheduled calls.
- This is live preview only: no persistence, no offline audio rendering, no sidechain or mix/master claims.
- Conversion from composition `role` to concrete track ID is intentionally **not automatic**. The caller must explicitly bind roles to existing tracks and obtain user consent to audition; storing automation requires a later schema proposal.
- CI has not been verified. Local Git checkout failed because the execution environment cannot resolve github.com; this is not a test pass.

## S4.2: MIDI evidence-driven kick ducking
- `proposeKickDucking` only builds gain envelopes from genuine GM kick note 35/36 events in an explicitly selected percussion track.
- Requires concrete existing target tracks and clamps depth/release to bounded values.
- Missing kicks, unsupported source tracks and unsafe settings fail closed; cannot claim a sidechain from an empty arrangement.
- The preview adapter is opt-in via the existing `playProject(..., automation)` argument.
- The result is MIDI-triggered gain ducking, **not** a real audio signal sidechain compressor. There is still no standalone LLM percussion arrangement role and no quality claim.
- Next slices: drum role generation with candidate validation and high-weight technique evidence acceptance/retry.

## S4.3: independent LLM drum MIDI proposal contract
- `proposeDrumCandidate(provider, request)` now accepts a dedicated asynchronous LLM adapter; returns a separate GM channel-10 drum track and atomic, uncommitted ChangeSet.
- The provider outputs only notes; the server-controlled candidate layer fixes channel/track identity, permits a bounded GM drum pitch set, checks scope and dry-runs against authoritative Music Core.
- In 4/4 House/Techno/Trance, the context explicitly carries quarter-note kick expectations and candidate evidence enumerates missing beats. Ambient is never forced into four-floor patterns.
- Unit tests cover generated notes, immutable project, absent signatures, invalid pitches and out-of-range notes.
- Integration into an actual remote LLM provider/API route/UI remains future work. This commit adds no automatic LLM retries and no unconditional accept/commit.
- CI/Playwright and real audio listening must be separately verified before merge.
