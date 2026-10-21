# Scoped AI rewrite workflow

The local model-assisted composer supports two operations:

- `append`: add notes to an empty target range, typically the next bar following the last note in the active track.
- `replace`: provide a specific track and half-open tick interval `[startTick,endTick)`; the model receives recent preceding notes, notes wholly within the selection, and a short following context. If existing notes overlap the interval boundaries or any selected note is locked, the request is rejected before calling the model.

The only accepted model output remains `{notes:[{pitch,startTick,durationTicks,velocity}]}`. No direct delete commands can be emitted by the model. The composition validator builds a batch consisting of delete operations for exactly the eligible selected notes, then add operations for the new notes. A deterministic music-core dry run checks the batch, and the UI displays the intended deletion and creation before asking for user approval.

Commit is only possible against the original base revision, and music-core rechecks locks during commit. If the user edits between generation and approval, the candidate becomes stale. Only the selected track can change; the remainder of the project is preserved.

The UI supports numerical **starting bar and length** for full-bar replacement, plus mouse marquee note-ID selection for targeted replacement. Time assumes 4/4, with an AI length limit of 1–4 bars. Advanced meter mapping, musically nuanced rewriting and rich selection gestures are future work. No live LLM quality testing has been completed.

See [LLM_INTEGRATION.md](LLM_INTEGRATION.md) for local setup.
## Mouse selection and stable-ID rewriting

See [PIANO_ROLL_SELECTION.md](PIANO_ROLL_SELECTION.md) for marquee selection and selected note-ID replacement, which preserves unselected same-bar notes.
