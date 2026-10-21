# Harmony timeline v0.2 — quarter-note segments, sevenths, bass inversion, passing tones

This extends, and does not replace, the original HarmonyPlan. One-degree-per-bar `degrees` remains supported if `timeline` is omitted.

## Editable timeline
`timeline` is an ordered array of contiguous chord events in **quarter-note beats** relative to the arrangement window:

```json
{"startBeat":0,"durationBeats":2,"degree":1,"seventh":true,"inversion":1}
```

Each event supplies a degree 1–7, optional diatonic seventh (scale-stacked fourth tone), and inversion 0–2 for triads or 0–3 for sevenths. Coverage must be complete from beat 0 to `barCount × 4`, with **no gaps or overlaps** and at most 16 events for 4 bars. Invalid plans are rejected before invoking a model. The interface can split a chord into adjacent segments, merge segments, and edit each segment's degree/seventh/inversion. Timeline editing is **not** a graphical pixel drag interaction yet; the data represents an exact musical time axis.

## Exact hard vs soft semantics
- Scale and role registers retain the previous semantics.
- Chord membership checks **every chord segment a note overlaps**, not simply the note onset. A held note that crosses a change must belong to both segment chord-tone sets, otherwise hard constraints reject it.
- Inversion is a **bass-line convention**, not a general chord-voicing completeness constraint: for each chord event, take the first bass-track note whose onset is in that event. Its pitch class must match the selected inversion chord member (0=root, 1=third, 2=fifth, 3=seventh). If no bass onset occurs, the inversion check also fails. `enforcement.inversions` may be `hard` or `soft`; old plans omitting this policy retain prior behavior. This does **not** guarantee that every chord tone is actually voiced.
- With `passingTones:"stepwise"`, a nonchord **harmony or accompaniment** note may be exempted from chord membership if it lies between two nonoverlapping, same-chord-segment chord tones, each adjacent melodic step is 1–2 semitones in the same direction, and its own duration is no longer than one quarter note. This exception **does not** bypass a hard scale rule. Bass is excluded. Without the explicit option, all chord nonmembers are rejected when `chords:hard`. This detector is intentionally narrow and is **not a complete nonharmonic-tone theory engine**.

The user receives violations/warnings with role-specific codes; hard violations reject the entire uncommitted proposal and never silently relax to soft.

## Generation and limits
The local deterministic arranger chooses diatonic seventh/chord tones and role-bounded notes at quarter-note boundaries when timeline is used. The model receives this explicit user-authored timeline separately from uncertain machine-estimated key/chord hypotheses. The original source track remains read-only. Server + browser independently apply HarmonyPlan checks and only accept three new tracks in one atomic user-approved operation.

Existing limitations: no chromatically altered or borrowed chords, harmonic minor leading-tone accidentals, fixed 4/4 quarter-note timeline granularity (no eighth-note chords), no independent voiced chord completeness rule, no listening-based quality benchmarks, and no direct editing of existing chord tracks.

### Seventh chord labels
Seventh quality is derived from the selected natural diatonic scale, not merely the seventh toggle: major scale I/IV use `maj7`, V uses dominant `7`, and vii uses half-diminished `ø7`. Natural minor uses i7, iiø7, IIImaj7, iv7, v7, VImaj7, VII7; it does not silently raise the seventh to create harmonic-minor dominant harmony.
