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

## Single-role targeted generation protocol (current)

The prior three-track `/api/arrange` response remains the contract for **initial full arrangement only**. When `editing:{targetTrackId,targetRole}` is present, the server now invokes `proposeRegionRegeneration` and its shared preflight, then requests a **single part**. Scoped output is strictly:

```json
{"role":"harmony","notes":[{"pitch":64,"startTick":0,"durationTicks":480,"velocity":80}]}
```

Exactly one matching `role` and 1–64 MIDI notes must appear. The server **and browser independently reject** a three-track payload, any other role, note IDs, edit commands, malformed notes, illegal MIDI values, and out-of-scope notes. The response never grants permission to modify the source melody or other existing parts.

The browser continues using the existing `/api/arrange` route and `createRemoteArranger` transport; the server branches on validated editing intent, returns only the selected part, and emits the selected-role Structured Outputs schema to OpenAI. The model still receives read-only melody/neighbor/protected-part musical context but **does not** generate unused harmony/bass/accompaniment. This reduces output schema/volume; cost and quality reductions are not empirically measured.

Local `SeededArranger` now emits only the requested role when editing intent is present, using the **same role-index-derived RNG stream** as its legacy three-part version. A role-specific plan check applies scale/chords/registers/inversions only to the newly generated part; otherwise, an ungenerated bass part might erroneously fail an inversion check.

The API keeps the full existing MusicProject snapshot as untrusted input in its local prototype context. It does not provide hosted multi-user authentication. The final `delete_note` + `add_note` ChangeSet still runs through Music Core dry-run and revision-checked explicit confirmation, leaving locks, source/other tracks and out-of-region material untouched.

## Pitch-only edit mode: multi-round melodic variation while keeping the approved rhythm

A scoped request may specify `editConstraint:'pitch_only'`. The editor exposes this as **局部重编仅改音高**. This mode is intended for cases such as “Keep bar 1 and the existing accompaniment; revise only the pitches of the harmony in bar 2 without changing its rhythm.”

This is an actual **Music Core operation constraint**, not merely prompt text. The target window must contain 1–32 fully-contained unlocked notes. A missing, dense, locked, or boundary-crossing selection is rejected **before calling a provider**.

For a valid response `{role,notes}`, all new notes must reproduce the exact multiset of:
- `startTick`
- `durationTicks`
- `velocity`

The model **must not** return note IDs. For simultaneous notes with the same onset, length and velocity, the validator pairs old/new notes in ascending pitch order, using stable note IDs as tie breakers for original notes. It rejects count or rhythm/velocity discrepancies, malformed MIDI and entirely unchanged outputs.

Instead of `delete_note + add_note`, the generated candidate contains **only `update_note` operations changing `pitch`**. Original note IDs, rhythm, duration, velocity, notes outside the selected window and all protected tracks are retained. The candidate is dry-run against Music Core and does not write the project before explicit approval; revision checks, undo and redo remain effective. An approved provenance record stores `editConstraint:'pitch_only'` in the project JSON (not standard MIDI).

The seeded offline provider chooses alternative pitches from a deterministic role-specific pseudorandom stream while copying timing, length and velocity from the authoritative target notes. If strict HarmonyPlan constraints are active, it searches within permitted scale, overlapping chord membership, instrument register and first-onset bass inversion; if no feasible pitch exists, it rejects instead of weakening a hard rule. This remains a demonstration algorithm, not evidence of musical quality.

The remote OpenAI provider receives an explicit strict pitch-only prompt and unchanged target-original musical properties. Server and browser **both** check timing/velocity after generation, and the loopback API refuses altered data. If the model ignores the constraint, it must be retried or the constraint explicitly disabled by the user; no silent adjustment.

**Limitations:** The first implementation preserves all notes in one contiguous 1–4 bar window, not arbitrary noncontiguous Note IDs. A chord inversion can be changed only when the new pitches meet any chosen hard plan. Same-seed reproducibility applies to the local deterministic provider, not remotely hosted model output.

## Iterative feedback: protected opening and bounded melodic motion

Following the explicit `pitch_only` mode, the editor now provides two **structured, auditable feedback constraints**; arbitrary natural-language instructions do not silently authorize or synthesize them:

- `protectedPrefixCount`: an integer from 0–16, strictly fewer than the count of eligible original notes. The earliest target notes are ordered by `startTick`, then pitch, then original ID. Their **pitches must remain identical**. No note onset, duration, velocity or identity is changed.
- `maxLeapSemitones`: an optional integer from 1–24. For adjacent notes **whose audible durations do not overlap**, the absolute pitch difference cannot exceed this amount. The check includes the closest preceding and following untouched target notes at the selection boundary. This is a simplified monophonic-motion heuristic, not a full chord voicing or voice-leading evaluator; overlapping notes are not compared as melodic jumps.

Both rules are **only legal when `editConstraint: 'pitch_only'` is active**. Invalid, out-of-range, non-integer, or unsupported-mode requests are rejected *before* calling the provider; a prefix encompassing every target note is also rejected as it cannot form a pitch-only edit. If a generated phrase changes a protected note or exceeds the allowed melodic jump, the **entire candidate** is rejected, without silent pitch repair or relaxation.

The offline `SeededArranger` preserves the selected prefix and samples deterministic alternative pitches within applicable register/scale/chord, preceding note, and following boundary constraints. Failure to find an alternative yields `unrealizable_feedback_constraint`. Different Seeds can produce different revisions without modifying the approved original until explicit selection, audition and confirmation. The remote model receives only the bounded, server-verified feedback parameters plus read-only music context. Server and browser independently validate the final notes.

Approved JSON project provenance can store `protectedPrefixCount` and `maxLeapSemitones` together with the `pitch_only` editing mode, and undo reverts both the notes and their generation record.

**Scope limitation:** "keep the opening" here means a count of chronological notes in one continuous 1–4-bar target window, not an arbitrary set of note IDs or a form/phrase recognition model. "Reduce jumps" is specifically the numeric leap bound, not an AI claim of improved musical taste. More expressive feedback-to-constraint interpretation remains future work.

## Feedback interpreter with explicit human approval

The scoped editor now offers a separate **音乐反馈解释器**. Feedback is not a command to edit a MIDI project. An offline rules-only parser supports explicit phrases such as “保留前三个音” and “跳进不超过五个半音”; natural-language emotion words do not silently introduce a hard numeric musical threshold.

Optionally, a local agent API at `POST /api/feedback` uses OpenAI Responses Structured Outputs to suggest only `{pitchOnly,protectedPrefixCount,maxLeapSemitones,explanation,unresolved}`. It sends **only feedback text and the number of target notes**, never the MIDI project or target IDs. Provider JSON is untrusted and independently checked by the service and client for exact keys, correct types, bounds and consistency. Calls are size limited, subject to local API origin/rate/key controls, and do not mutate anything.

Both interpretations produce a review UI that lists the proposed editing mode, numerical constraints and unresolved ambiguity. The user must deliberately select **确认并应用建议约束** to copy suggestions into the existing controls, or **仅填入创作指令（不改约束）** to use subjective wording as a soft composition instruction. The first button is disabled when no actionable constraint was identified. Neither button creates notes or commits a project edit. Applying a draft invalidates outstanding scoped candidates; changing the feedback, project revision, edit target or time window makes prior suggestions stale.

This is a bounded draft interpreter, **not full conversational music cognition**. “Better harmony”, “more tension”, etc. remain stylistic guidance without deterministic authorization. Model suggestions may be wrong; a reviewer can edit numeric values before generation, and all established pitch-only, note-lock, score-scope and plan checks still apply at final proposal and commit.

## Arbitrary protected notes (selected MIDI IDs)

The pitch-only editor can also protect **specific existing target notes** independently of the chronological prefix. The UI lists the notes in the target window and permits individual checkboxes or adding the current Piano Roll multi-selection while its active track is the chosen target.

The editable request includes up to 32 unique `protectedNoteIds` in `editing` only when `editConstraint:'pitch_only'` is active. The server reconstructs the target MusicProject and rejects forged, duplicate, unknown, outside-window or all-protected IDs **before requesting model generation**. Protected-prefix and individually protected notes form a union, with at least one original editable note required.

For anonymous model output the composition layer matches MIDI notes by the exact (startTick, durationTicks, velocity) multiset and then stable sorted pitches. A protected note must retain its original pitch and stable ID, or the entire proposal is rejected. If two indistinguishable MIDI notes share pitch and timing but only one is protected, the operation is rejected as `ambiguous_protected_note`; the model cannot identify which duplicate to preserve. For initial model input, the server sends **numeric protected indices**, not stable note IDs; all validation uses authoritative server/project IDs independently of model text. Other tracks remain read-only and source melody remains untouched.

The offline deterministic SeededArranger respects these notes for every seed. The approved generation record stores `protectedNoteIds` for auditing inside the project JSON (not ordinary MIDI), and undo restores the previous project. If target track, scope or project revision changes, the browser stops applying stale selections; invalid IDs are still rejected server-side.

This is positional MIDI protection, not high-level musical motif recognition. Protecting a note's pitch is not the same as copying an immutable musical phrase across voices.
