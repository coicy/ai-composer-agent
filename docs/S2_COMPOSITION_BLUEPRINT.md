# S2: 16-bar composition blueprint and cross-window motif continuity

> Feature PR stacked on S1/S0. This introduces a read-only, deterministic **composition plan**. It is not an LLM music model, not a new MusicProject authority, and not the final 16-bar browser editing workflow.

## Implemented

- `CompositionBlueprint`: stable version, seed, explicit genre or `general`, meter and PPQ, 16-bar form (also supported 8/12/24/32 in the pure planner), motif identity, section kind, semantic energy and selected dimension to vary.
- `blueprintWindow`: clips a long-lived blueprint to the authorized 1–4 bar region, including partial section boundaries. The same `mainMotifId` is preserved across all parts.
- `prepareArrangementContext`: projects a 16-bar composition blueprint for the current request using the MusicProject's meter, a stable local 16-bar block and existing seed. If the project changes meter inside that block, the blueprint is withheld rather than lying about timebase continuity.
- `createOpenAIArranger`: passes active section and motif information to the generic LLM and explicitly asks for development/reprise of the same recognizable idea with one chosen variable rather than unrelated melody generation.
- Browser candidate review shows the active section, energy target, motif identity and change dimension. No MIDI is committed until the ordinary explicit approval path.
- Unit tests: 16-bar / 6/8 math, repeated motif, cross-section selection and invalid/edited blueprint rejection; model-adapter test asserts the plan reaches the real request.

## Deliberate limitations

- Actual harmonic and thematic material is still authored by a general-purpose LLM. The current `ArrangementRequest` remains a short legacy 4/4 (four-quarter-beat bar) window. **6/8 blueprint validation does not yet make the existing three-role generator a full 6/8 arranger**.
- Sections are ephemeral per 16-bar block and are recomputed; no persistent user-editable song-wide blueprint schema or visual timeline exists yet. Reusing or approving exact themes across unrelated generations still needs persistent motif history and user UI review.
- No audio rendering, waveform, effects, native drums or expanded DAW features in this slice.
- All user hard constraints override creative motifs and energy hints. Automated variations are preferences; whether the created notes maintain motif identity still requires separate evidence and listening experiments.
