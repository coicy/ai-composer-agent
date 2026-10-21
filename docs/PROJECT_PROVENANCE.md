# AI Composer project provenance and scoped candidate banks

## Project format and storage
Standard MIDI (.mid) contains note events, but does not preserve this prototype's composition-specific HarmonyPlan or generation parameters. The web app now supports **导出工程 JSON** and **导入 MIDI / 工程 JSON**. The project file is `composition.aic.json` with format marker `ai-composer-project-v1` and a validated `MusicProject`. There is no background/cloud persistence: export the file to retain the state between page reloads.

The optional `MusicProject.generationHistory` stores up to 128 **approved** `GenerationRecord` objects: kind (three_track or scoped), original source track, affected track ID(s), absolute MIDI Tick window, instruction, model/provider identifier, optional seed, optional three per-role seeds when variants were mixed, and optional `planJson` containing the approved HarmonyPlan. History is audit/provenance of approved actions; it is **not automatically authoritative** after subsequent manual MIDI edits. Users must explicitly enable inherited planning rules when regenerating a region.

Music Core accepts an optional `ChangeSet.generationRecord`. It validates identifiers, scope, source/target existence after note operations, bounded strings and valid JSON, and appends the record in the *same atomic transaction* as the new MIDI notes. If validation fails, none of the change is committed. Undo/redo restores both note and provenance state.

## Saved plan reuse
`findReusableHarmonyPlan` searches approved records newest first for a saved plan matching the same source track and target track and **covering the requested bar-aligned time scope**. It independently reparses and validates the HarmonyPlan, then slices the chord timeline to the target window. If it cannot find a valid plan it returns null. It does not infer the source key or silently set new hard constraints. The browser displays a checked “继承已批准和声规划” option when a usable plan is available. Users can disable it before regeneration.

## Local multi-candidate regeneration
`proposeRegionVariants` reuses deterministic derived seeds (UInt32 base seed, 2–4 candidates). Each candidate must pass `proposeRegionRegeneration` and preserve the source, other tracks, target-outside-scope notes and locks. The UI shows each candidate Seed and note count, letting users compare ghost notes and hear one complete temporary version. Only the selected candidate is committed, with an atomic generation provenance record. Model-mode seeds remain variation hints, not exact reproduction guarantees.

## Known limits
- JSON must be explicitly exported, then manually imported when returning. Refreshing the app otherwise loses in-memory work.
- Importing standard MIDI replaces the project and has no generation history. Importing project JSON restores the structured records, but does not restore undo history.
- This is a strict history schema, not an arbitrary metadata extension system; external project format compatibility may require future version migration.
- The composition engine still asks the AI model for all three roles even when only one role is being regenerated. No true track-context-aware single-role model prompt, mixing quality ranking, or automated real-model quality evaluation is claimed.
- Source note IDs are referenced by track history, but no cryptographic audit of subsequently manually edited pitches exists. Reuse of a saved plan is a **user-authorized new constraint** rather than a guarantee that it still reflects earlier musical intent.
