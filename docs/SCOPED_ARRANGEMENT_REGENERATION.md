# Scoped arrangement regeneration (composition-domain slice)

`proposeRegionRegeneration(provider,request)` is a transaction-safe candidate generator for an **existing** harmony, bass or accompaniment track, with a read-only reference melody.

Required inputs: `project`, `sourceTrackId`, `targetTrackId`, `targetRole`, selected `startTick/endTick`, instruction, and optional unsigned 32-bit seed and HarmonyPlan. The arrangement provider generates candidate notes according to the existing MIDI validation and planning contracts.

The function constructs a *single* ChangeSet that deletes only target-track notes **entirely within the selected scope**, then adds the validated target-role notes. Other tracks, the melody and target notes outside the window are untouched. Locked target tracks or notes and notes crossing the boundary are rejected **before** invoking any model. The candidate is dry-run against music-core; approval still requires an explicit user action and a matching revision.

This slice **only exposes the domain-level proposal function**. Full application UI for source/target selection, selective preview and approval is a separate next increment; do not claim browser workflows or external model support have been tested for this feature. Current `proposeArrangement` still uses three-role output, even though only one role is applied: optimization toward a single-role provider response is also future work.
