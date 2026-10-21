# Implementation status

The current prototype includes an editable single-track piano roll view with multi-track selection, preview audio, MIDI exchange, transactional note operations, and undo/redo in memory.

Composition now has two **deterministic algorithmic** modes:
- composeMelody: generate/replace the start of a track in fixed C major, 4/4, eighth notes.
- continueMelody: read existing notes in the selected track, begin after the last sounding note at the next 4/4 bar, reuse recent pitches as a motif or perform seeded step/leap movement, add notes without deleting existing material.

Both modes return proposed ChangeSets that must be approved. Base-revision checks reject stale previews, and track locks are checked at candidate creation and commit.

**Not yet implemented:** LLM or natural-language composition Agent, rich rhythmic and harmonic planning, configurable key/meter, advanced preview diff, project persistence, robust browser E2E coverage and soundfonts. Quality of generated melodies is not independently verified.

See GitHub Actions for the tested status of each commit.