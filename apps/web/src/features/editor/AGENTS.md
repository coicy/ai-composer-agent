# apps/web/src/features/editor

Editor presentation lives here, with no project state authority.
- VelocityLane must render only note-data projections and emit a user intent via `onChange(ids,velocity)`.
- Do not edit MusicProject or bypass music-core; translate intent to atomic commands in the app adapter or piano-roll gesture package.
- Keep the lane horizontally aligned with the note grid by following the shared zoom and scrollLeft.
- Capture a drag as ONE transaction, not one transaction per pointermove.
- The visual preview must not modify the underlying project or its revision.
