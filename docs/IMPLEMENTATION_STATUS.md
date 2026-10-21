# Implementation status

The browser prototype now supports piano-roll note editing, multiple track selection, basic audio playback, MIDI import/export, and in-memory undo/redo.

AI candidate workflows now support **append** and **scoped replace** on an explicit track and bar range. The model receives bounded neighboring note context and existing target notes, but can return only replacement note data. Server and browser validators independently enforce schema, target range, note locks, cross-boundary overlap and full atomic dry-run, and the UI previews deleted/new notes before user approval. Stale project revisions are rejected at commit time.

Limitations: drag-to-range selection is not implemented (numerical start-bar and length controls are used); current scope uses fixed 4/4 timing; the service remains loopback-only and not safe for public hosting without authentication; no actual paid model musical quality test has been performed. The tool is not yet a production DAW or fully autonomous multi-step music Agent.