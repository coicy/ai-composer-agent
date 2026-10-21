import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {SeededArranger} from './seeded-arranger.js';
import {combineArrangementVariants,deriveArrangementSeed,proposeArrangementVariants} from './variants.js';
import {DEFAULT_REGISTERS} from '../planning/harmony-plan.js';
const p:MusicProject={projectId:'p',revision:1,ppq:480,tracks:[
 {trackId:'original',name:'原旋律',locked:true,notes:[
  {noteId:'a',pitch:64,startTick:0,durationTicks:480,velocity:92},
  {noteId:'b',pitch:67,startTick:960,durationTicks:480,velocity:80}
 ]}
]};
const plan={tonic:0,mode:'major' as const,degrees:[1,4] as const,registers:DEFAULT_REGISTERS,
 enforcement:{scale:'hard' as const,chords:'hard' as const,registers:'hard' as const,inversions:'hard' as const}};
const req={project:p,sourceTrackId:'original',startTick:0,endTick:3840,instruction:'Arranging motif',plan,seed:19501};
const notes=(a:readonly {tracks:readonly {notes:readonly {pitch:number;startTick:number;durationTicks:number;velocity:number}[]}[]}[])=>a.map(x=>x.tracks.map(t=>t.notes.map(n=>({pitch:n.pitch,startTick:n.startTick,durationTicks:n.durationTicks,velocity:n.velocity}))));
describe('seeded arrangement variant bank',()=>{
 it('stable independent seeds, including 0 and unsigned maximum',()=>{
  expect(deriveArrangementSeed(19501,0)).toBe(19501);
  expect(deriveArrangementSeed(19501,1)).not.toBe(19501);
  expect(deriveArrangementSeed(0xffffffff,3)).toBeGreaterThanOrEqual(0);
  expect(()=>deriveArrangementSeed(-1,0)).toThrow('invalid_arrangement_seed');
  expect(()=>deriveArrangementSeed(1,4)).toThrow('invalid_arrangement_seed');
 });
 it('repeats identical content and offers distinct valid candidates',async()=>{
  const p1=await proposeArrangementVariants(new SeededArranger(),req,3);
  const p2=await proposeArrangementVariants(new SeededArranger(),req,3);
  expect(notes(p1)).toEqual(notes(p2));
  expect(p1.map(x=>x.seed)).toEqual([0,1,2].map(i=>deriveArrangementSeed(19501,i)));
  expect(new Set(p1.map(x=>JSON.stringify(notes([x])))).size).toBeGreaterThan(1);
  expect(p1.every(x=>x.planFindings.length===0)).toBe(true);
  expect(p.tracks).toHaveLength(1);
 });
 it('mixes selected parts, revalidates three-role atomic operations and preserves the source',async()=>{
  const variants=await proposeArrangementVariants(new SeededArranger(),req,3);
  const mixed=await combineArrangementVariants(req,variants,{harmony:0,bass:1,accompaniment:2});
  expect(mixed.roleSeeds).toEqual({harmony:variants[0]!.seed,bass:variants[1]!.seed,accompaniment:variants[2]!.seed});
  expect(notes([mixed])[0]).toEqual([
   notes([variants[0]!])[0]![0],
   notes([variants[1]!])[0]![1],
   notes([variants[2]!])[0]![2]
  ]);
  expect(mixed.changes.operations.map(x=>x.type)).toEqual(['add_track','add_track','add_track']);
  const committed=applyChangeSet(p,mixed.changes);
  expect(committed.ok).toBe(true);
  if(committed.ok)expect(committed.project.tracks[0]).toEqual(p.tracks[0]);
 });
 it('rejects stale revisions, tampered seed and invalid role choices',async()=>{
  const variants=await proposeArrangementVariants(new SeededArranger(),req,2);
  await expect(combineArrangementVariants({...req,project:{...p,revision:p.revision+1}},variants,{harmony:0,bass:0,accompaniment:0}))
   .rejects.toThrow('variant_context_mismatch');
  const altered=variants.map((x,i)=>i===1?{...x,seed:999}:x);
  await expect(combineArrangementVariants(req,altered,{harmony:0,bass:0,accompaniment:0}))
   .rejects.toThrow('variant_context_mismatch');
  await expect(combineArrangementVariants(req,variants,{harmony:2,bass:0,accompaniment:0}))
   .rejects.toThrow('invalid_variant_selection');
  await expect(proposeArrangementVariants(new SeededArranger(),req,5)).rejects.toThrow('invalid_variant_count');
 });
 it('honors cancellation before further generation',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(proposeArrangementVariants(new SeededArranger(),req,3,controller.signal)).rejects.toThrow('generation_cancelled');
 });
});
