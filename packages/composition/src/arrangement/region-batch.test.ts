import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {proposeRegionVariantBatch} from './region-variants.js';
import {deriveArrangementSeed} from './variants.js';
import {SeededArranger} from './seeded-arranger.js';
import type {ArrangementProvider} from './arrange.js';
const original:MusicProject={projectId:'batch',revision:8,ppq:480,tracks:[
 {trackId:'m',name:'Source',locked:true,notes:[{noteId:'m1',pitch:60,startTick:0,durationTicks:480,velocity:85}]},
 {trackId:'h',name:'Harmony',locked:false,notes:[{noteId:'h1',pitch:64,startTick:0,durationTicks:480,velocity:80}]},
 {trackId:'b',name:'Bass',locked:true,notes:[{noteId:'b1',pitch:36,startTick:0,durationTicks:480,velocity:80}]}
]};
const req={project:original,sourceTrackId:'m',targetTrackId:'h',targetRole:'harmony' as const,
 startTick:0,endTick:1920,seed:19501,instruction:'variation'};
const valid={role:'harmony',notes:[{pitch:67,startTick:0,durationTicks:480,velocity:80}]};
describe('partial-success scoped seed banks',()=>{
 it('repeats all candidates when every deterministic seed passes',async()=>{
  const a=await proposeRegionVariantBatch(new SeededArranger(),req,3);
  const b=await proposeRegionVariantBatch(new SeededArranger(),req,3);
  expect(a.failures).toEqual([]);
  expect(a.candidates).toHaveLength(3);
  expect(a.candidates.map(x=>x.seed)).toEqual([0,1,2].map(i=>deriveArrangementSeed(19501,i)));
  expect(a.candidates.map(x=>x.notes)).toEqual(b.candidates.map(x=>x.notes));
 });
 it('reports failed seeds but preserves valid candidates without mutating the project',async()=>{
  const seeds=[0,1,2].map(i=>deriveArrangementSeed(19501,i));
  const before=JSON.stringify(original);
  const provider:ArrangementProvider={id:'mock',async generate(ctx){
   if(ctx.seed===seeds[0])return {role:'bass',notes:valid.notes};
   if(ctx.seed===seeds[1])throw new Error('Authorization: secret API key=abc123');
   return valid;
  }};
  const result=await proposeRegionVariantBatch(provider,req,3);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]?.seed).toBe(seeds[2]);
  expect(result.failures).toEqual([
   {seed:seeds[0],reason:'invalid_single_role_output'},
   {seed:seeds[1],reason:'candidate_generation_failed'}
  ]);
  expect(JSON.stringify(result)).not.toContain('abc123');
  expect(JSON.stringify(original)).toBe(before);
  const commit=applyChangeSet(original,result.candidates[0]!.changes);
  expect(commit.ok).toBe(true);
  if(commit.ok)expect(commit.project.tracks[2]).toEqual(original.tracks[2]);
 });
 it('reports all failures without inventing an approvable candidate',async()=>{
  const provider:ArrangementProvider={id:'mock',async generate(){return {role:'bass',notes:valid.notes};}};
  const batch=await proposeRegionVariantBatch(provider,req,4);
  expect(batch.candidates).toEqual([]);
  expect(batch.failures).toHaveLength(4);
  expect(batch.failures.every(x=>x.reason==='invalid_single_role_output')).toBe(true);
  expect(original.tracks[1]?.notes[0]?.noteId).toBe('h1');
 });
 it('preflights shared locks, invalid seeds and count without calling providers',async()=>{
  let calls=0;
  const provider:ArrangementProvider={id:'spy',async generate(){calls++;return valid;}};
  const locked={...original,tracks:original.tracks.map(t=>t.trackId==='h'?{...t,locked:true}:t)};
  await expect(proposeRegionVariantBatch(provider,{...req,project:locked},3)).rejects.toThrow('track_locked');
  await expect(proposeRegionVariantBatch(provider,{...req,seed:-1},3)).rejects.toThrow('invalid_arrangement_seed');
  await expect(proposeRegionVariantBatch(provider,req,5)).rejects.toThrow('invalid_variant_count');
  expect(calls).toBe(0);
 });
 it('cancellation rejects the batch rather than publishing already generated candidates',async()=>{
  const controller=new AbortController();
  let calls=0;
  const provider:ArrangementProvider={id:'spy',async generate(){
   calls++;if(calls===2)controller.abort();return valid;
  }};
  await expect(proposeRegionVariantBatch(provider,req,4,controller.signal)).rejects.toThrow('generation_cancelled');
  expect(calls).toBe(2);
 });
});
