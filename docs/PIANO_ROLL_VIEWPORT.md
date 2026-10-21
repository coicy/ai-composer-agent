# Piano Roll viewport and manual editing — M2 incremental slice

## Implemented
- **MIDI 0–127 visible via vertical scrolling.** The note grid contains 128 rows; the keyboard column is sticky horizontally. Initial scroll position targets the middle register around MIDI note 72.
- **Horizontal zoom:** discrete 50%, 100%, 150%, 200% UI scale, independent from persisted integer ticks. Mouse quantization updates with the displayed scale and the current project PPQ.
- **Direct editing:** double-click a blank cell to add a note; drag its body to change pitch/start; drag its right handle to change duration.
- **Multi-note dragging:** use the marquee tool to select multiple stable Note IDs, switch back to the edit tool, then drag any selected note. All selected notes move together as a single `ChangeSet` and one undo entry. Invalid/out-of-range movements are rejected without partial writes.
- **Velocity (1–127):** the active note's detail panel contains a numeric velocity editor. With a marquee selection present, changing this value applies it atomically to all selected notes. Frozen/locked notes and malformed velocities are rejected.
- Geometry is separated into `packages/piano-roll/src/viewport/coordinates.ts`. Batch move/velocity command construction lives under `src/gestures/`, while `music-core` remains the authority for validation, transaction and revision checks.

## Invariants
- Display coordinates are never persisted as music time; only MIDI `pitch`, integer `startTick`, `durationTicks` and `velocity` are persisted.
- Horizontal zoom does not change existing tick values; screen hit-testing uses the current zoom and project PPQ.
- Full-range dragging rejects any pitch outside 0–127 and any start time before 0.
- All selected notes must exist and be unlocked before a move/velocity ChangeSet is constructed. Music Core still checks track locks and stale revisions during the atomic commit.
- Unselected notes are not modified. Batch gesture = one undoable history entry.

## Prototype limitations
- This currently uses DOM-rendered notes and a repeating CSS grid, not a virtualized Canvas/PixiJS editor.
- Horizontal zoom is discrete, not anchored to the pointer; scrolling/zooming large imported projects has not been performance-profiled.
- Piano Roll has a fixed 24px note-row height and a single active track view; no vertical zoom or automatic pitch-range fitting.
- Velocity editing is numerical, not a fully fledged per-note velocity-lane graph.
- No shift-additive selection, keyboard nudging, multi-note resizing or note quantization presets yet.
- The browser UI interaction was not exercised in a real browser by CI; pure viewport and batch gesture logic is unit tested and TypeScript build is checked.

The next UX pass should include browser Playwright E2E for drag/zoom/undo and a genuine Velocity lane before classifying this as a mature Piano Roll.

## Velocity lane and browser E2E (incremental)
The Velocity lane is placed directly under the Piano Roll, mirroring the editor's horizontal scroll position and zoom. Each note has a draggable bar; dragging one bar updates only that note unless the bar belongs to the current marquee selection, in which case all selected notes receive the same velocity in one transaction. The lane's pending drag is visual-only until pointer release. The numeric velocity input remains supported.

Playwright browser scenarios cover note creation, horizontal zoom invariance, velocity gesture + undo, marquee selection, multi-note movement + undo. GitHub Actions uses a dedicated Chromium job. See the exact workflow for whether E2E has passed on a given commit; typechecking and unit tests alone do not prove real browser interactions.
