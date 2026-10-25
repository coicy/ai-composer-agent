# Motivic development: implementation gap and MIDI reference admission

## Diagnosis
The existing `electronic-techniques.ts` selects genre-weighted accompaniment textures, but does not offer actionable motif development operations (sequential transposition, inversion, augmentation/diminution, fragmentation, rhythmic displacement, call-response, contrast and purposeful return). The existing `electronic-blueprint.ts` says reprise/develop without a persistent motif representation or validator. This matches the user's report that the ruins example sounded technically correct yet insufficiently developed; this is a plausible explanation, not a causally proven diagnosis.

## License-grounded MIDI sources
`references/development/sources.json` lists three *source-confirmed* Mutopia MIDI editions of Bach's Inventions #2, #4 and #8 (Public Domain as declared at source). The MIDI links are real externally hosted download URLs, not locally bundled binaries. The fetcher `scripts/fetch_development_references.py` validates the SMF header, size and host, then creates a SHA-256 audit manifest. It must actually be run in an internet-enabled CI environment before claiming downloaded assets are present.

These examples provide **counterpoint and motif-development study material**, not evidence that Baroque music sounds like a mysterious ancient ruin. Technique labels are **hypotheses** pending independent MIDI analysis and listening review. No melodic phrases may be copied into outputs.

## Proposed executable development plan
For every named motif, store: `motifId`, note-event fingerprint, source section, allowed transformations, return section, transformations-by-window, and preserved identity (subset of interval/rhythm shape). Require at least one *purposeful* development event per phrase group only when the brief asks for development, not as a universal density mandate.

Transform catalog: `sequence` (interval transposition with harmony adaptation), `rhythmic_augmentation`, `rhythmic_diminution`, `fragmentation`, `inversion`, `register_transfer`, `call_response`, `harmonic_recontextualization`, `texture_subtraction`, `thematic_return`.

## Specific ruins test
Create 24 bars at 72 BPM or less than 2 minutes. A: introduce 3–5 event sparse motif. A': alter ONE motif property while keeping its recognizable contour; B: develop through register/response and harmony movement; A'': return with contrasting accompaniment and a stable loop entry. Preserve silences, use pad/drone as support rather than replacing thematic work. Evaluate note-fingerprint similarity, changed parameter, transition measures and listening judgment. Two alternatives are needed to avoid treating one recipe as obligatory.

## Admission gates
1. Legal provenance + file digest.
2. Real MIDI parsing and note/track/timebase extraction.
3. Independent technique annotation with exact section/tick evidence and confidence.
4. Rights-aware reference retrieval: content analyzed, not copied, with source and license retained.
5. Controlled experiment against baseline on the same task with blinded listening. Do not claim improvement before real Agent production and listener scores.

## Current status
Source catalog + downloader + specification submitted in this branch. External MIDI download, musical technique annotation, integration into LLM planning and actual before/after production are not completed in this slice.

## Implementation update — scoped arranger bridge
- `ArrangementRequest.developmentPlan` optionally carries a validated `MotifDevelopmentPlan`; its MIDI identity must refer to existing project note IDs and the requested four-bar composition window must lie within a single development window.
- `ArrangementProvider.generate` now receives `context.developmentGuidance` and generated candidates contain advisory `developmentEvidence` (directed-interval contour only). A contour match is NOT confirmation of meaningful musical development; harmony and fragment assessments explicitly remain `not_evaluable`.
- Development metadata has not yet been checked to pass through the remote LLM-specific API prompt serialization. Do not describe this as end-to-end LLM execution until the adapter is verified.
- Vitest tests added for planning, provider context and limited realization evidence. CI currently tests reference ingestion; TypeScript/Vitest checks must still run on this stacked PR.
