import {describe,it,expect} from 'vitest';
import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import {evaluateArrangement} from './arrangement.js';
const note=(id:string,pitch:number,start=0,duration=480):MidiNote=>({noteId:id,pitch,startTick:start,durationTicks:duration,velocity:80});
const tracks=(h:MidiNote[],b:MidiNote[],a:MidiNote[]):MusicTrack[]=>[
 {trackId:'h',name:'H',locked:false,notes:h},
 {trackId:'b',name:'B',locked:false,notes:b},
 {trackId:'a',name:'A',locked:false,notes:a}
];
describe('explainable nonblocking arrangement diagnostics',()=>{
 it('finds voice-crossing, register, leap, and dense vertical tension with explicit counts',()=>{
  const source=[note('m1',60,0),note('m2',62,480)];
  const arranged=tracks([note('h1',61,0),note('h2',90,480)],[note('b1',66,0),note('b2',80,480)],[note('a1',48,0)]);
  const r=evaluateArrangement(source,arranged,0,1920,480);
  expect(r.metrics.bassAboveMelody).toBeGreaterThan(0);
  expect(r.metrics.bassRegisterOutliers).toBeGreaterThan(0);
  expect(r.metrics.largeVoiceLeaps).toBeGreaterThan(0);
  expect(r.metrics.harmonyBassCrossings).toBeGreaterThan(0);
  expect(r.findings.map(f=>f.code)).toContain('bass_above_melody');
  expect(r.findings.every(f=>f.severity==='review')).toBe(true);
 });
 it('does not issue an absolute quality verdict for simple low-bass consonance',()=>{
  const source=[note('m',60,0)];
  const r=evaluateArrangement(source,tracks([note('h',64,0)],[note('b',36,0)],[note('a',55,0)]),0,1920,480);
  expect(r.findings).toEqual([]);
  expect(r.tonalProfile.status).toBe('insufficient');
  expect(r.disclaimer).toContain('启发式');
 });
 it('is deterministic under equivalent ordering of parts',()=>{
  const source=[note('m1',60,0),note('m2',62,480)];
  const arranged=tracks([note('h2',66,480),note('h1',64,0)],[note('b1',36,0)],[note('a1',55,0)]);
  const reversed=tracks([...arranged[0]!.notes].reverse(),[...arranged[1]!.notes],[...arranged[2]!.notes]);
  expect(evaluateArrangement(source,arranged,0,1920,480).metrics).toEqual(evaluateArrangement(source,reversed,0,1920,480).metrics);
 });
});
