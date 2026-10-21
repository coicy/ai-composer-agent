import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {SeededArranger} from './seeded-arranger.js';
import {deriveArrangementSeed} from './variants.js';
import {proposeRegionVariants} from './region-variants.js';
import {findReusableHarmonyPlan} from './reuse-plan.js';
import {DEFAULT_REGISTERS} from '../planning/harmony-plan.js';
const original:MusicProject={projectId:'p',revision:2,ppq:480,tracks:[
 {trackId:'melody',name:'主旋律',locked:true,notes:[{noteId:'m',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
 {trackId:'h',name:'和声',locked:false,notes:[{noteId:'old',pitch:64,startTick:0,durationTicks:480,velocity:75}]},
 {trackId:'b',name:'低音',locked:true,notes:[{noteId:'bass',pitch:36,startTick:0,durationTicks:480,velocity:85}]}
]};
const req={project:original,sourceTrackId:'melody',targetTrackId:'h',targetRole:'harmony' as const,
 startTick:0,endTick:1920,seed:19501,instruction:'vary harmony'};
describe('local seeded multi-candidate regeneration',()=>{
 it('repeats same notes and offers variations while respecting target-only changes',async()=>{
  const bank=await proposeRegionVariants(new SeededArranger(),req,3);
  const repeat=await proposeRegionVariants(new SeededArranger(),req,3);
  expect(bank.map(c=>c.notes)).toEqual(repeat.map(c=>c.notes));
  expect(bank.map(c=>c.seed)).toEqual([0,1,2].map(i=>deriveArrangementSeed(19501,i)));
  expect(new Set(bank.map(c=>JSON.stringify(c.notes.map(n=>[n.pitch,n.velocity,n.durationTicks])))).size).toBeGreaterThan(1);
  const applied=applyChangeSet(original,bank[1]!.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok){expect(applied.project.tracks[0]).toEqual(original.tracks[0]);expect(applied.project.tracks[2]).toEqual(original.tracks[2]);}
  expect(original.tracks[1]!.notes).toHaveLength(1);
 });
 it('bounds batch size, rejects invalid seed and aborts before provider execution',async()=>{
  await expect(proposeRegionVariants(new SeededArranger(),{...req,seed:-1},3)).rejects.toThrow('invalid_arrangement_seed');
  await expect(proposeRegionVariants(new SeededArranger(),req,5)).rejects.toThrow('invalid_variant_count');
  const controller=new AbortController();controller.abort();
  await expect(proposeRegionVariants(new SeededArranger(),req,2,controller.signal)).rejects.toThrow('generation_cancelled');
 });
});
describe('persisted HarmonyPlan scope matching',()=>{
 const plan={tonic:0,mode:'major',degrees:[1,4,5,1],registers:DEFAULT_REGISTERS,
  enforcement:{scale:'hard',chords:'hard',registers:'hard'},timeline:[
   {startBeat:0,durationBeats:2,degree:1,seventh:true,inversion:0},
   {startBeat:2,durationBeats:2,degree:5,seventh:false,inversion:0},
   {startBeat:4,durationBeats:4,degree:4,seventh:false,inversion:0},
   {startBeat:8,durationBeats:4,degree:5,seventh:false,inversion:0},
   {startBeat:12,durationBeats:4,degree:1,seventh:false,inversion:0}]};
 const withHistory:MusicProject={...original,generationHistory:[{recordId:'gen-1',kind:'three_track',
  sourceTrackId:'melody',targetTrackIds:['h','b','other'],startTick:0,endTick:7680,seed:19501,
  providerId:'test',instruction:'compose',planJson:JSON.stringify(plan)}]};
 it('reuses only an approved saved plan, slicing in-bar events to local window',()=>{
  const match=findReusableHarmonyPlan(withHistory,'melody','h',0,1920);
  expect(match?.plan.timeline).toHaveLength(2);
  expect(match?.plan.degrees).toEqual([1]);
  expect(findReusableHarmonyPlan(withHistory,'melody','h',1920,3840)?.plan.degrees).toEqual([4]);
  expect(findReusableHarmonyPlan(withHistory,'melody','h',7680,9600)).toBeNull();
  expect(findReusableHarmonyPlan(withHistory,'melody','not-part',0,1920)).toBeNull();
 });
 it('returns null for malformed or absent metadata instead of guessing a plan',()=>{
  expect(findReusableHarmonyPlan(original,'melody','h',0,1920)).toBeNull();
  const corrupt={...withHistory,generationHistory:withHistory.generationHistory!.map(r=>({...r,planJson:'{}'}))};
  expect(findReusableHarmonyPlan(corrupt,'melody','h',0,1920)).toBeNull();
 });
});
