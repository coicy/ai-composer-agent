# Scoped arrangement regeneration (composition-domain slice)

`proposeRegionRegeneration(provider,request)` is a transaction-safe candidate generator for an **existing** harmony, bass or accompaniment track, with a read-only reference melody.

Required inputs: `project`, `sourceTrackId`, `targetTrackId`, `targetRole`, selected `startTick/endTick`, instruction, and optional unsigned 32-bit seed and HarmonyPlan. The arrangement provider generates candidate notes according to the existing MIDI validation and planning contracts.

The function constructs a *single* ChangeSet that deletes only target-track notes **entirely within the selected scope**, then adds the validated target-role notes. Other tracks, the melody and target notes outside the window are untouched. Locked target tracks or notes and notes crossing the boundary are rejected **before** invoking any model. The candidate is dry-run against music-core; approval still requires an explicit user action and a matching revision.

This slice **only exposes the domain-level proposal function**. Full application UI for source/target selection, selective preview and approval is a separate next increment; do not claim browser workflows or external model support have been tested for this feature. Current `proposeArrangement` still uses three-role output, even though only one role is applied: optimization toward a single-role provider response is also future work.

## Browser workflow (implemented after domain slice)

The editor now exposes a separate **局部重新编配** panel. Users select a read-only reference melody, an existing and separate target track, and the semantic target role (harmony/bass/accompaniment), followed by a 1–4 bar range, UInt32 seed and textual instruction. Neither source selection nor target selection depends on whichever track is currently visible in the Piano Roll.

**Offline** uses `SeededArranger` deterministically. **AI** reuses `/api/arrange` with the existing server-side structural validation, and then runs `proposeRegionRegeneration` for a second client-side validation. The remote model still produces all three roles, but only the user-selected role becomes `delete_note` + `add_note` operations on the existing target track. No model-returned track ID or ChangeSet is accepted.

The preview switches the Piano Roll to the target track, colors deleted notes red and new notes blue, but leaves MusicProject unchanged. The audio audition constructs a temporary project through `applyChangeSet` and plays it without commit. **确认局部替换** is the only project mutation, a single undoable ChangeSet with a revision check. Cancellation or a project revision change invalidates the preview.

Current UI deliberately does not reuse the nonpersisted HarmonyPlan from the initial arrangement. Scoped generation accepts `plan` in its domain contract, but to avoid falsely implying an old plan is still authoritative after import/edit, the first browser release does not enforce one. Capturing and attaching a chosen HarmonyPlan when regenerating will be a separate increment. Other tracks are protected from modification, not included as additional model musical context beyond the read-only source melody.

### UI limitations
- A target role is explicitly selected. For named `AI 和声/低音/伴奏` tracks the UI infers the initial role, but imported/arbitrary tracks require user selection.
- Notes crossing selected boundaries are rejected in full rather than clipped.
- Only one region/target role may be previewed at a time; this is not yet a per-bar seeded variant bank.
- Source, other part, and target-outside-scope notes remain identical after application. These invariants are unit-tested; Chromium E2E covers offline preview, commit and undo, cancellation, and invalid remote data.

## Read-only cross-part context (increment)

Scoped regeneration now derives a **bounded read-only editingScope** in `packages/composition/src/arrangement/editing-context.ts` from the current MusicProject, rather than trusting context arrays supplied by a client:

- Up to 8 preceding and 8 following target-track notes, to encourage phrase continuity.
- Up to 32 target notes within the selected replacement region, as an **optional musical reference**, not a license to preserve/edit their Note IDs directly.
- Up to 6 *other* preserved tracks, at most 16 notes per track, preferring notes overlapping or nearest to the target region. The source melody is supplied separately, as before.

The client sends only `{editing:{targetTrackId,targetRole}}` to the loopback agent API. The API rejects additional forged editing-context fields; the server independently recalculates this context from the supplied project snapshot and checks target locks/cross-boundary notes **before calling the model**.

Only numeric musical note fields (pitch, startTick, durationTicks, velocity) and a read-only track index are serialized into the OpenAI Responses API input. Stable IDs, track names and writable commands are not included in `editingScope`. Existing source-melody output validation, hard HarmonyPlan constraints, music-core dry-run and atomic approval remain in force. The model still returns all three roles for protocol compatibility; only the requested target role can become a scoped ChangeSet.

Limitations: this is additional *generation context*, not proof of sophisticated voice-leading or orchestration. It does not expose entire large projects to the model or permit editing preserved parts; live-model musical quality is unverified.
