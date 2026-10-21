# Music editing constraints — implementation v0.1

## Design principle

AI text prompts are **proposals**, not enforcement. The composition layer validates the proposed notes and produces precise music-core `MusicOperation` changes. Web UI never directly writes model output to project state.

## `editConstraint: "pitch_only"`

Supported for `mode: "replace"` with an explicit non-empty `targetNoteIds` array, such as notes selected by a Piano Roll marquee. The validator:

1. Rejects locked or missing note IDs, invalid scope, cross-boundary selected notes and invalid input **before** calling the model.
2. Requires exactly the same number of model notes as selected notes.
3. Requires the same multiset of **`(startTick, durationTicks)`**, including simultaneous onsets and rests between notes. Pairing is deterministic: sort by tick, duration and pitch (and original stable note ID as tie breaker).
4. Ignores any model-proposed velocity changes and emits **only `update_note` with `changes: { pitch }`** against original IDs. Zero pitch changes are rejected as a no-op.
5. Dry-runs the batch through Music Core, previews changes, and requires the user to confirm. Existing revision/locks are rechecked on commit; undo remains available.

Thus original `noteId`, timing, velocity, lock metadata, all non-target notes and other tracks are unchanged by successful commits. Rejects model output with shifted starts, changed note lengths, dropped/extra notes, illegal MIDI pitch, or changed scope. Chords with multiple notes at equal start and duration are paired deterministically; strict identity mapping for same-time unisons may require a future note-ID keyed provider protocol.

**Important limitation:** This constraint guarantees structural rhythm preservation, not musical quality or the artistic suitability of the new notes.

## Deterministic semitone transposition

`proposeTranspose(project, trackId, selectedNoteIds, semitones)` works without any model or API key. Current UI offers ±12 semitones for selected notes. It rejects locked notes/tracks, missing/duplicate IDs, invalid interval or MIDI pitch overflow. It proposes `update_note.pitch` commands only, with stable IDs and original velocity/timing unchanged. Preview, confirmation, undo and stale-revision checks use the same edit session.

## UI and integration

Choose **框选音符** and drag a selection rectangle. In the Agent panel choose **仅重写框选音符**, enable **只改音高（保留原节奏/力度/音符 ID）**, enter a musical request, and generate a preview. Alternately choose **所选 +12 半音预览** or **所选 -12 半音预览** for deterministic transposition. Candidate previews show updated and/or new pitch positions as ghost notes; originals designated for update are highlighted.

Model-powered rewrites require local `agent-api` and a server-side `OPENAI_API_KEY`. Real external API calls and qualitative listening studies have **not** been verified by CI; mock-based tests verify the HTTP contract and safety validator.

## Future constraints not yet built

- **Preserve original pitches while rewriting harmony**: requires explicit track ownership/protected melody and chord generation; not equivalent to pitch-only edits.
- **Keep first N selected notes unchanged**: will require protected Note ID sets, constraint-controlled subset edits and UI previews.
- Preserve contour, key/mode, register, velocity range, scale membership, rhythmic density, instrument playability with explicit hard/soft constraint semantics.
- Mixed direct manipulation and text command intent extraction with user review prior to writes.

No new accepted product rule is claimed here; these are engineering implementations of the existing user goal of accurate, user-controllable editing.
