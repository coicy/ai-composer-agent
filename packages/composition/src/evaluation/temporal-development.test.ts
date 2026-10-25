import {describe,expect,it} from 'vitest';
import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import {buildRuinsDevelopmentPlan,extractMotifIdentity} from '../planning/motif-development.js';
import {assessTemporalDevelopment} from './temporal-development.js';

const ppq=480,bar=ppq*4,section=bar*4;
export type BenchmarkCase='static_loop'|'surface_density'|'developed'|'scrambled'|'style_mismatch';
type Pattern={pitches:readonly number[];steps:readonly number[];durations:readonly number[];bass:number};
const P:readonly Pattern[]=[
 {pitches:[60,62,61],steps:[0,480,960],durations:[240,240,240],bass:36},
 {pitches:[60,62,61],steps:[0,960,1920],durations:[600,600,600],bass:36},
 {pitches:[60,62],steps:[0,480],durations:[240,240],bass:36},
 {pitches:[60,62,61],steps:[0,480,960],durations:[240,240,240],bass:41},
 {pitches:[72,74,73],steps:[0,480,960],durations:[240,240,240],bass:36},
 {pitches:[60,62,61],steps:[0,480,960],durations:[240,240,240],bass:36}
];
function createCase(kind:BenchmarkCase):{tracks:MusicTrack[];brief:string}{
 const order=kind==='scrambled'?[0,4,2,5,1,3]:[0,1,2,3,4,5];
 const motifs:MidiNote[]=[],basses:MidiNote[]=[];
 for(let i=0;i<6;i++){
  const base=kind==='developed'||kind==='scrambled'||kind==='style_mismatch'?P[order[i]!]!:P[0]!;
  const extra=kind==='surface_density'&&i>0&&i<5?[{pitch:67,tick:1500},{pitch:69,tick:2200},{pitch:67,tick:2900}]:[];
  base.pitches.forEach((pitch,j)=>motifs.push({
   noteId:'lead-'+i+'-'+j,pitch,startTick:i*section+base.steps[j]!,
   durationTicks:base.durations[j]!,velocity:80
  }));
  extra.forEach((n,j)=>motifs.push({
   noteId:'fill-'+i+'-'+j,pitch:n.pitch,startTick:i*section+n.tick,durationTicks:240,velocity:80
  }));
  basses.push({noteId:'bass-'+i,pitch:base.bass,startTick:i*section,durationTicks:960,velocity:65});
 }
 return {tracks:[
  {trackId:'lead',name:'Lead',locked:false,notes:motifs},
  {trackId:'bass',name:'Bass',locked:false,notes:basses}
 ],brief:kind==='style_mismatch'?'Joyful carnival celebration':'Mysterious ancient ruins exploration'};
}
function assessment(kind:BenchmarkCase){
 const sample=createCase(kind);
 const lead=sample.tracks[0]!;
 const original=lead.notes.slice(0,3);
 const motif=extractMotifIdentity('original','lead',original);
 const plan=buildRuinsDevelopmentPlan(motif,ppq);
 return assessTemporalDevelopment(plan,sample.tracks,{sourceTrackId:'lead',bassTrackId:'bass'});
}
describe('controlled MIDI-note temporal-development benchmark A–E',()=>{
 it('A: repeated motif is not mistakenly classified as development',()=>{
  const a=assessment('static_loop');
  expect(a.windows.map(w=>w.state)).toEqual([
   'observed','not_observed','not_observed','not_observed','not_observed','observed'
  ]);
  expect(a.consecutiveDensityChanges).toBe(0);
 });
 it('B: more notes are not a substitute for motif transformations',()=>{
  const b=assessment('surface_density');
  expect(b.consecutiveDensityChanges).toBeGreaterThan(0);
  expect(b.observed).toBe(2);
  expect(b.windows[1]?.state).toBe('not_observed');
  expect(b.windows[4]?.state).toBe('not_observed');
 });
 it('C: verifies all six specified transformations without claiming aesthetic success',()=>{
  const c=assessment('developed');
  expect(c.windows.map(w=>w.state)).toEqual(Array(6).fill('observed'));
  expect(c.observed).toBe(6);
  expect(c.disclaimer).toContain('not a quality score');
 });
 it('D: time-shuffling the exact same sections loses plan-aligned evidence',()=>{
  const c=assessment('developed'),d=assessment('scrambled');
  expect(d.observed).toBeLessThan(c.observed);
  expect(d.notObserved).toBeGreaterThan(0);
 });
 it('E: the same music with mismatched creative brief is indistinguishable structurally',()=>{
  const c=assessment('developed'),e=assessment('style_mismatch');
  expect(e.windows).toEqual(c.windows);
  expect(createCase('style_mismatch').brief).not.toBe(createCase('developed').brief);
 });
 it('missing bass is not silently counted as failed harmony',()=>{
  const sample=createCase('developed');
  const motif=extractMotifIdentity('original','lead',sample.tracks[0]!.notes.slice(0,3));
  const result=assessTemporalDevelopment(buildRuinsDevelopmentPlan(motif),[sample.tracks[0]!],{sourceTrackId:'lead'});
  expect(result.windows[3]?.state).toBe('not_evaluable');
 });
 it('rejects a nonexistent source track rather than fabricating evidence',()=>{
  const sample=createCase('developed');
  const motif=extractMotifIdentity('original','lead',sample.tracks[0]!.notes.slice(0,3));
  expect(()=>assessTemporalDevelopment(buildRuinsDevelopmentPlan(motif),sample.tracks,{sourceTrackId:'missing'}))
   .toThrow('temporal_source_track_missing');
 });
});
