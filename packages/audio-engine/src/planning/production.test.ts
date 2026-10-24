import {describe,it,expect} from 'vitest';
import {createProductionPlan,validateProductionPlan,inferPreset} from './production.js';
import type {MusicProject,MusicTrack} from '@ai-composer/music-core';
const notes=[{noteId:'n',pitch:60,startTick:0,durationTicks:480,velocity:90}];
const tr=(id:string,program?:number,isDrum?:boolean):MusicTrack=>({
 trackId:id,name:id,locked:false,notes,
 ...(program!==undefined?{program}:{}),
 ...(isDrum!==undefined?{isDrum}:{}),
 ...(isDrum?{channel:9}:{})
});
const project:MusicProject={projectId:'synth',revision:0,ppq:480,tempoBpm:124,meter:{numerator:4,denominator:4},
 tracks:[tr('legacy'),tr('bass',38),tr('pluck',81),tr('pad',89),tr('lead',83),tr('drum',0,true)]};
describe('basic electronic production plan',()=>{
 it('maps program/GM drums to independent audible presets and preserves legacy triangle',()=>{
  expect(project.tracks.map(inferPreset)).toEqual([
   'legacy_triangle','synth_bass','synth_pluck','synth_pad','synth_lead','drum_machine'
  ]);
  const plan=createProductionPlan(project);
  expect(plan.version).toBe('basic-production-v1');
  expect(plan.tracks.map(t=>t.presetId)).toEqual(project.tracks.map(inferPreset));
  expect(plan.tracks.every(t=>t.cutoffHz>30&&Number.isFinite(t.gainDb))).toBe(true);
 });
 it('accepts only bounded, per-existing-track production settings',()=>{
  const plan=createProductionPlan(project);
  expect(()=>validateProductionPlan(project,plan)).not.toThrow();
  for(const invalid of [
   {...plan,tracks:plan.tracks.map((t,i)=>i===0?{...t,cutoffHz:NaN}:t)},
   {...plan,tracks:plan.tracks.map((t,i)=>i===0?{...t,cutoffHz:50000}:t)},
   {...plan,tracks:plan.tracks.map((t,i)=>i===0?{...t,gainDb:20}:t)},
   {...plan,tracks:plan.tracks.map((t,i)=>i===0?{...t,presetId:'unauthorized-vst' as never}:t)},
   {...plan,tracks:plan.tracks.map((t,i)=>i===0?{...t,trackId:'../secrets'}:t)},
   {...plan,tracks:plan.tracks.slice(1)}
  ])expect(()=>validateProductionPlan(project,invalid as typeof plan)).toThrow('invalid_production_plan');
 });
 it('does not alter MusicProject source notes when assembling audio plans',()=>{
  const old=structuredClone(project);
  createProductionPlan(project);
  expect(project).toEqual(old);
 });
});