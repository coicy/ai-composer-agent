# S0 — Musical timebase and instrument identity (implemented slice)

> This feature branch models tempo, meter and GM instrument/drum channel metadata without changing the AI music model choice. It does **not** yet add a UI to author tempo changes. Review the pull request and CI before treating the slice as a release.

## Backward compatible core state

- `MusicProject.tempoMap?: readonly {tick,bpm}[]` (10–600 BPM) and `meterMap?: readonly {tick,numerator,denominator}[]`; initial event at tick 0, ordered events, integer tick. Legacy projects without arrays play and export as 120 BPM / 4/4.
- `MusicTrack.instrument?: {kind:'melodic'|'drums', program:0..127, channel:0..15}`. Standard MIDI uses channel **9 zero-based** for drums; other tracks cannot use it. No implicit mutating defaults are attached to legacy projects.
- `secondsAtTick(project,tick)` integrates piecewise tempo; `meterAtTick` and `barTicksAt` expose meter changes without rewriting song history.
- `validateProject` enforces correct ordered maps and instrument channel. Existing note-lock, revision and approval invariants are unchanged; `applyChangeSet` currently has no operation to edit timebase metadata, so editing the maps is a **future** versioned command/UX slice.

## MIDI exchange and preview

- `midi-io` now serializes actual tempo and meter meta events plus track program/channel. Imported MIDI includes these fields and treats missing defaults as 120 BPM and 4/4.
- SMF does not retain project locks, approved edits, provenance, audio effects, or SoundDesignPlan; import resets revision and creates fresh IDs and unlocked tracks.
- `audio-engine` preview schedules note start and end with real tempo map by default. Explicit `playProject(project,bpm)` still overrides all tempo events for caller compatibility.
- **Still unsupported:** automatic conversion of old 4/4-only HarmonyPlan and ArrangementRequest into 6/8, browser tempo control, audio drum samples/preset routing, fine-grained MIDI controller changes or a full multi-tempo editing workflow. The MIDI data contracts provide prerequisites, not completed electronic-music production.

## Tests / quality gates

- Core: legacy fallback, 6/8 meter, 120→60 BPM piecewise mapping, invalid maps and illegal drum channels, input immutability.
- MIDI: nondefault 126→132 BPM, 4/4→6/8 events, melodic GM patch, percussion channel, note integrity, legacy import and lock loss.
- Must pass project `pnpm check` and Playwright tests. Do not merge until completed/success.
