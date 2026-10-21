# Implementation status

Basic piano-roll editing, multi-track selection, Web Audio preview, MIDI I/O, transactional note operations and in-memory undo/redo are implemented as a prototype. The optional loopback OpenAI adapter can generate/append/replace MIDI note candidates with explicit approval.

New mouse marquee selection: a selection rectangle chooses stable note IDs; the AI **仅重写框选音符** mode replaces only those IDs, retaining unrelated notes even if they overlap in time. Validation remains two-stage (server/client) plus revision-checked commit. A pure tested geometry package isolates hit-testing from UI and Music Core.

Not yet complete: production authentication, live model music quality tests, real DAW-grade editing, sophisticated automatic accompaniment, arbitrary meter/key and multi-track AI operations.