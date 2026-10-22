# MIDI references — third-party music works

44 original MIDI binary files, stored in Git and versioned with per-file evidence and legalcode.
**This directory is not an open-source license for the application.**

## Where to look
- midi/: untouched source MIDI files (28 Groove drums, 8 OpenGameArt games, 8 Mutopia scores).
- catalog/manifest.json: original download path, individual rights record, SHA-256, and musical fact facets.
- catalog/coverage.json and catalog/targets.json: missing sample types and independent-source counts.
- THIRD_PARTY_NOTICES.md: mandatory attribution, original-author credits, individual rights evidence.
- licenses/CC-BY-4.0.txt and licenses/CC0-1.0.txt: complete official license legalcodes.

## Redistribution rules
| Source | Count | Conditions |
|---|---:|---|
| Google LLC Groove MIDI Dataset | 28 | CC BY 4.0: attribution and legalcode link required |
| Aureolus_Omicron 15 Melodic RPG Chiptunes | 8 | CC0 1.0; author voluntarily credited |
| Mutopia Project: eight specific sheet-music editions | 8 | Public Domain statement checked individually |

## Rebuild and verify
Run Python 3.11+ with mido==1.3.3 installed:

    python scripts/build_midi_reference_catalog.py
    python scripts/stage_reference_snapshot.py
    python scripts/verify_reference_snapshot.py

Build downloads the authorized originals; publisher additionally downloads the Creative Commons legalcode.
The MIDI bytes in this directory have NOT been modified.

## Important limits
28 of 44 references contain percussion only; these do not validate any musical mode.
The 6/8 trio are from the same drummer and are not independent stylistic representatives.
5/4 and 5/8 are single clips; 7/8 and 12/8 are still missing.
No independent verification yet exists for mode, swing subtype, compositional form, or musical quality.
