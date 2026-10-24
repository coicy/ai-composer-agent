# S3 — First procedural electronic sound presets (Web Audio)

> Implemented feature-branch slice, not a professional DAW or mastered release. No binary audio samples or third-party SoundFonts are bundled. Every audible sound is procedural oscillators/noise created in the local browser.

## The native playback path

- Five melodic preset flavors: legacy basic triangle, synth_bass (short lowpass saw), synth_pluck (fast decay), synth_pad (soft attack/release), saw_lead (more present).
- One GM-compatible `drum_kit`: kick 35/36 uses falling sine pitch; snare/clap and hi-hats use deterministic noise through different filters and amplitude decay envelopes. Other percussion notes use bounded noise fallback. This makes **imported MIDI channel 9** sound recognizably percussive instead of pitched triangle waves.
- Program-aware default selection: GM 38/39 Bass, GM 80–87 Leads, GM 88–95 Pads, GM 24–31 Plucks; legacy tracks without programs still use original basic triangle.
- `SoundDesignPlan` is a validated, versioned, **temporary preview-only** `{trackId,presetId,gainDb,pan,cutoffHz}` list. Unknown track/preset, unsafe or infinite values, drum-to-melodic mapping, duplicate track IDs and unknown fields are rejected.
- Browser arrangement preview offers a checkbox: with an identified electronic style, sound a proposed harmony track as Pad, bass as Synth Bass, accompaniment as Synth Pluck. The project remains unchanged. Native audio and MIDI exporting are separate; sound presets cannot be reconstructed from exported MIDI alone.

## Tests and rights

- Unit tests on patch routing, pitch versus drum instruments, timbre/envelope separation, safe preset bounds and no project mutation.
- A mocked Web Audio API schedules real synth sources plus sine kick/noise snare, respects a 120 → 60 BPM tempo switch, and confirms stop closes the AudioContext and releases scheduled sources.
- No sample library is redistributed and no audio model weight or specialized AI composer is used.

## Not yet present

- Final multi-track drum **composition** role in existing three-track LLM schema. Imported channel-9 drums and manually created drum MIDI now sound like drums, but high-weight House/DnB drum technique assignments remain `deferred` until a separate validated multi-role proposal format is built.
- Proper full MIDI Controller and sound-preset export to DAW (MIDI only carries program/tempo/meter in S0).
- Audio effects, chorus/reverb, programmable ADSR UI, automation lanes, realtime gain ducking or sidechain compressor; these belong to S4 and later feature slices.
- Actual mastered electronic-audio quality evaluation. Hearing basic timbral differences is an engineering milestone, not proof of House/Techno quality.
