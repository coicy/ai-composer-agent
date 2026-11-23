import {describe, it, expect} from 'vitest';
import type {MidiNote, MusicTrack} from '@ai-composer/music-core';
import {validateEnsemblePlan, buildEnsembleCues, assessEnsembleRelations} from './ensemble.js';

const ppq = 480, endTick = 3840;
const note = (tick: number, pitch: number, velocity = 85, duration = 420): MidiNote => ({
  noteId: 'n-' + tick + '-' + pitch, pitch, startTick: tick, durationTicks: duration, velocity
});
const source = [note(0, 72), note(960, 74), note(1920, 76), note(2880, 74)];
const plan = {
  version: 1,
  voices: [
    {id: 'guzheng', trackRole: 'source', purpose: 'lead', instrumentHint: '古筝'},
    {id: 'dizi', trackRole: 'harmony', purpose: 'answer', instrumentHint: '竹笛'},
    {id: 'bass', trackRole: 'bass', purpose: 'foundation'},
    {id: 'yangqin', trackRole: 'accompaniment', purpose: 'rhythmic', instrumentHint: '扬琴'}
  ],
  relations: [
    {id: 'reply', fromVoiceId: 'guzheng', toVoiceId: 'dizi', kind: 'call_response', startTick: 0, endTick},
    {id: 'yield', fromVoiceId: 'guzheng', toVoiceId: 'bass', kind: 'lead_follow', startTick: 0, endTick},
    {id: 'pulse', fromVoiceId: 'guzheng', toVoiceId: 'yangqin', kind: 'rhythmic_interlock', startTick: 0, endTick}
  ]
};
const track = (name: string, notes: MidiNote[]): MusicTrack => ({trackId: name, name, locked: false, notes});

describe('ensemble voice design: advisory relationship contract', () => {
  it('preserves voice purpose and instrument hints, without binding them to a MIDI instrument program', () => {
    const valid = validateEnsemblePlan(plan, 0, endTick);
    expect(valid.voices.map(v => v.purpose)).toEqual(['lead', 'answer', 'foundation', 'rhythmic']);
    expect(valid.relations.map(r => r.kind)).toEqual(['call_response', 'lead_follow', 'rhythmic_interlock']);
    expect(valid.voices[1]?.instrumentHint).toBe('竹笛');
  });
  it('rejects malformed, duplicated, unknown, or out-of-scope relationships', () => {
    const cases: unknown[] = [
      {...plan, version: 2},
      {...plan, voices: plan.voices.map((v, i) => i === 1 ? {...v, trackRole: 'source'} : v)},
      {...plan, voices: plan.voices.map((v, i) => i === 1 ? {...v, id: 'guzheng'} : v)},
      {...plan, relations: [{...plan.relations[0], toVoiceId: 'missing'}]},
      {...plan, relations: [{...plan.relations[0], endTick: 4000}]},
      {...plan, relations: [{...plan.relations[0], startTick: 100, endTick: 100}]},
      {...plan, relations: [{...plan.relations[0], kind: 'delete_source'}]},
      {...plan, relations: [{...plan.relations[0], hard: true}]},
      {...plan, voices: plan.voices.map((v, i) => i === 0 ? {...v, admin: true} : v)},
      {...plan, relations: [{...plan.relations[0], toVoiceId: 'guzheng'}]}
    ];
    for (const invalid of cases) expect(() => validateEnsemblePlan(invalid, 0, endTick)).toThrow();
    expect(() => validateEnsemblePlan(plan, 0, 0)).toThrow('invalid_ensemble_scope');
  });
  it('detects actual reply windows after notes rather than leading silence', () => {
    const cues = buildEnsembleCues(validateEnsemblePlan(plan, 0, endTick), source, ppq);
    expect(cues[0]?.availableWindows).toEqual([
      {startTick: 420, endTick: 960},
      {startTick: 1380, endTick: 1920},
      {startTick: 2340, endTick: 2880},
      {startTick: 3300, endTick: 3840}
    ]);
    expect(cues[0]?.toRole).toBe('harmony');
  });
  it('reports missed answers, foreground conflicts and synchronous rhythm with evidence counts', () => {
    const bad = [
      track('harmony', [note(500, 79)]),
      track('bass', [note(0, 40, 95, 480), note(960, 43, 95, 480), note(1920, 45, 95, 480)]),
      track('accompaniment', [note(0, 60), note(960, 62), note(1920, 64)])
    ];
    const result = assessEnsembleRelations(validateEnsemblePlan(plan, 0, endTick), source, bad, ppq);
    expect(result.findings.map(f => [f.code, f.count, f.inspected])).toEqual([
      ['missing_response', 3, 4], ['foreground_conflict', 3, 3], ['onset_collision', 3, 3]
    ]);
    expect(result.disclaimer).toContain('不是');
  });
  it('does not change note data or mistake deliberate interlocking for an error', () => {
    const good = [
      track('harmony', [note(540, 79), note(1500, 78), note(2460, 76), note(3420, 74)]),
      track('bass', [note(0, 40, 55, 320), note(960, 43, 55, 320)]),
      track('accompaniment', [note(240, 60, 55, 180), note(1200, 62, 55, 180), note(2160, 64, 55, 180)])
    ];
    const before = JSON.stringify(good);
    const result = assessEnsembleRelations(validateEnsemblePlan(plan, 0, endTick), source, good, ppq);
    expect(result.findings).toEqual([]);
    expect(JSON.stringify(good)).toBe(before);
  });
  it('reports when sustained source notes leave no opportunity for call-and-response', () => {
    const result = assessEnsembleRelations(validateEnsemblePlan(plan, 0, endTick), [note(0, 72, 80, endTick)],
      [track('harmony', []), track('bass', []), track('accompaniment', [])], ppq);
    expect(result.findings.some(f => f.code === 'no_response_window')).toBe(true);
  });
});
