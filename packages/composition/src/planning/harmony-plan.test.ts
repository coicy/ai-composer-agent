import {describe,it,expect} from 'vitest';
import type {MusicTrack} from '@ai-composer/music-core';
import {chordPitchClasses,chordLabel,checkHarmonyPlan,validateHarmonyPlan,DEFAULT_REGISTERS} from './harmony-plan.js';
const base={tonic:0,mode:'major',degrees:[1,4],registers:DEFAULT_REGISTERS,enforcement:{scale:'hard',chords:'hard',registers:'hard'}};
const plan=()=>validateHarmonyPlan(base,2);
const tracks=(h:number,b:number,a:number,duration=480):MusicTrack[]=>[
 {trackId:'h',name:'H',locked:false,notes:[{noteId:'h',pitch:h,startTick:0,durationTicks:duration,velocity:80}]},
 {trackId:'b',name:'B',locked:false,notes:[{noteId:'b',pitch:b,startTick:0,durationTicks:duration,velocity:80}]},
 {trackId:'a',name:'A',locked:false,notes:[{noteId:'a',pitch:a,startTick:0,durationTicks:duration,velocity:80}]}
];
describe('harmony planning validation',()=>{
 it('resolves diatonic triads, including minor mode and sharp roots',()=>{
  expect(chordPitchClasses(plan(),0)).toEqual([0,4,7]);
  expect(chordPitchClasses(plan(),1)).toEqual([5,9,0]);
  expect(chordLabel(plan(),1)).toBe('IV');
  const minor=validateHarmonyPlan({...base,tonic:2,mode:'minor',degrees:[1,2]},2);
  expect(chordLabel(minor,1)).toBe('ii°');
  expect(chordPitchClasses(minor,0)).toEqual([2,5,9]);
 });
 it('rejects malformed untrusted plans and wrong number of bars',()=>{
  for(const value of [
   {...base,tonic:12},{...base,mode:'jazz'},{...base,degrees:[1]},{...base,degrees:[1,8]},
   {...base,registers:{...DEFAULT_REGISTERS,bass:{minPitch:75,maxPitch:60}}},
   {...base,enforcement:{...base.enforcement,chords:'skip'}},
   {...base,unknown:true}
  ])expect(()=>validateHarmonyPlan(value,2)).toThrow();
 });
 it('permits exact chord tones inside ranges and rejects scale/chord/range violations separately',()=>{
  expect(checkHarmonyPlan(plan(),tracks(64,36,55),0,3840,480)).toEqual([]);
  expect(()=>checkHarmonyPlan(plan(),tracks(61,36,55),0,3840,480)).toThrow('plan_scale_violation');
  expect(()=>checkHarmonyPlan(plan(),tracks(62,36,55),0,3840,480)).toThrow('plan_chords_violation');
  expect(()=>checkHarmonyPlan(plan(),tracks(64,72,55),0,3840,480)).toThrow('plan_registers_violation');
 });
 it('checks sustained notes against every overlapped chord, including near-bar-boundary overlap',()=>{
  const crossing=tracks(64,36,55,2400);
  expect(()=>checkHarmonyPlan(plan(),crossing,0,3840,480)).toThrow('plan_chords_violation');
 });
 it('returns informative soft warnings while preserving valid MIDI',()=>{
  const p=validateHarmonyPlan({...base,enforcement:{scale:'soft',chords:'soft',registers:'soft'}},2);
  const results=checkHarmonyPlan(p,tracks(61,72,55),0,3840,480);
  expect(results.map(x=>x.constraint)).toContain('scale');
  expect(results.map(x=>x.constraint)).toContain('registers');
  expect(results.every(x=>x.count>=1)).toBe(true);
 });
});
