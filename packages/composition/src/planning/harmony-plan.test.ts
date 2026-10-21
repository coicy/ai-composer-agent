import {describe,it,expect} from 'vitest';
import type {MusicTrack} from '@ai-composer/music-core';
import {chordPitchClasses,chordPitchClassesAtBeat,chordEventLabel,effectiveChordEvents,chordLabel,checkHarmonyPlan,validateHarmonyPlan,DEFAULT_REGISTERS} from './harmony-plan.js';
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

describe('beat-granular harmonic timeline',()=>{
 const timeline=[{startBeat:0,durationBeats:2,degree:1,seventh:true,inversion:1},
  {startBeat:2,durationBeats:2,degree:5,seventh:true,inversion:0}] as const;
 const config=()=>validateHarmonyPlan({...base,degrees:[1],timeline,passingTones:'none',
  enforcement:{...base.enforcement,inversions:'hard'}},1);
 const note=(id:string,pitch:number,startTick:number,durationTicks=240)=>({noteId:id,pitch,startTick,durationTicks,velocity:85});
 it('supports two seventh chords in a bar with validated inversions',()=>{
  const p=config();
  expect(effectiveChordEvents(p)).toHaveLength(2);
  expect(chordPitchClassesAtBeat(p,1)).toEqual([0,4,7,11]);
  expect(chordPitchClassesAtBeat(p,3)).toEqual([7,11,2,5]);
  expect(chordEventLabel(p,p.timeline![0]!)).toContain('7 · 第1转位');
  const arranged:MusicTrack[]=[
   {trackId:'h',name:'H',locked:false,notes:[note('h1',64,0),note('h2',67,960)]},
   {trackId:'b',name:'B',locked:false,notes:[note('b1',40,0),note('b2',43,960)]},
   {trackId:'a',name:'A',locked:false,notes:[note('a1',55,0),note('a2',59,960)]}
  ];
  expect(checkHarmonyPlan(p,arranged,0,1920,480)).toEqual([]);
  expect(()=>checkHarmonyPlan(p,[arranged[0]!,{...arranged[1]!,notes:[note('wrong',36,0),note('b2',43,960)]},arranged[2]!],0,1920,480)).toThrow('plan_inversions_violation:bass');
 });
 it('rejects gaps, overlaps, invalid seventh inversions and improper timeline coverage',()=>{
  for(const tl of [
   [{startBeat:0,durationBeats:1,degree:1,seventh:false,inversion:3},{startBeat:1,durationBeats:3,degree:5,seventh:true,inversion:1}],
   [{startBeat:0,durationBeats:2,degree:1,seventh:true,inversion:0},{startBeat:3,durationBeats:1,degree:5,seventh:true,inversion:0}],
   [{startBeat:0,durationBeats:3,degree:1,seventh:true,inversion:0},{startBeat:2,durationBeats:1,degree:5,seventh:true,inversion:0}],
   [{startBeat:0,durationBeats:2,degree:1,seventh:true,inversion:0}]
  ])expect(()=>validateHarmonyPlan({...base,degrees:[1],timeline:tl},1)).toThrow('invalid_plan_timeline');
 });
 it('detects cross-chord sustained note without silently clipping or weakening hard rule',()=>{
  const p=config();
  const tracksNow:MusicTrack[]=[
   {trackId:'h',name:'H',locked:false,notes:[note('long',64,480,720)]},
   {trackId:'b',name:'B',locked:false,notes:[note('b1',40,0),note('b2',43,960)]},
   {trackId:'a',name:'A',locked:false,notes:[note('a1',55,0),note('a2',59,960)]}
  ];
  expect(()=>checkHarmonyPlan(p,tracksNow,0,1920,480)).toThrow('plan_chords_violation:harmony');
 });
 it('permits stepwise passing nonchord tone but rejects leap and chord-boundary passing',()=>{
  const p=validateHarmonyPlan({...base,degrees:[1],passingTones:'stepwise',enforcement:{...base.enforcement,inversions:'soft'}},1);
  const h=(pitch2:number,start=480)=>[note('first',60,0,480),note('pass',pitch2,start,240),note('last',64,960,480)];
  const make=(hNotes:ReturnType<typeof h>):MusicTrack[]=>[
   {trackId:'h',name:'H',locked:false,notes:hNotes},
   {trackId:'b',name:'B',locked:false,notes:[note('bass',36,0)]},
   {trackId:'a',name:'A',locked:false,notes:[note('accomp',55,0)]}
  ];
  expect(checkHarmonyPlan(p,make(h(62)),0,1920,480)).toEqual([]);
  expect(()=>checkHarmonyPlan(p,make(h(65)),0,1920,480)).toThrow('plan_chords_violation:harmony');
  const split=validateHarmonyPlan({...p,timeline:[{startBeat:0,durationBeats:1,degree:1,seventh:false,inversion:0},
   {startBeat:1,durationBeats:3,degree:5,seventh:false,inversion:0}]},1);
  expect(()=>checkHarmonyPlan(split,make(h(62)),0,1920,480)).toThrow('plan_chords_violation:harmony');
 });
});
