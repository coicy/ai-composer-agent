import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {applyChangeSet} from '@ai-composer/music-core';
import {SeededArranger} from './seeded-arranger.js';
import {proposeRegionRegeneration} from './regenerate-region.js';
import type {ArrangementProvider} from './arrange.js';
import {DEFAULT_REGISTERS} from '../planning/harmony-plan.js';

const project:MusicProject={projectId:'single-role',revision:2,ppq:480,tracks:[
 {trackId:'melody',name:'Source',locked:true,notes:[{noteId:'melody-1',pitch:60,startTick:0,durationTicks:480,velocity:90}]},
 {trackId:'harmony',name:'Existing harmony',locked:false,notes:[
  {noteId:'harmony-old',pitch:64,startTick:0,durationTicks:480,velocity:85},
  {noteId:'harmony-after',pitch:65,startTick:2300,durationTicks:480,velocity:85}
 ]},
 {trackId:'bass',name:'Protected bass',locked:true,notes:[{noteId:'bass-protected',pitch:36,startTick:0,durationTicks:480,velocity:83}]}
]};
const request={project,sourceTrackId:'melody',targetTrackId:'harmony',targetRole:'harmony' as const,
 startTick:0,endTick:1920,instruction:'one-part embellishment',seed:19501};
const midi=(pitch:number)=>({pitch,startTick:0,durationTicks:480,velocity:82});
const fake=(output:unknown):ArrangementProvider=>({id:'test-one-role',async generate(){return output;}});
const plan={tonic:0,mode:'major' as const,degrees:[1] as const,registers:DEFAULT_REGISTERS,
 enforcement:{scale:'hard' as const,chords:'hard' as const,registers:'hard' as const,inversions:'hard' as const}};
describe('one-role scoped MIDI protocol',()=>{
 it('generates one deterministic target role and preserves source, protected bass and out-of-range notes',async()=>{
  const a=await proposeRegionRegeneration(new SeededArranger(),request);
  const b=await proposeRegionRegeneration(new SeededArranger(),request);
  expect(a.notes).toEqual(b.notes);
  expect(a.notes).toHaveLength(2);
  expect(a.changes.operations.map(x=>x.type)).toEqual(['delete_note','add_note','add_note']);
  const next=applyChangeSet(project,a.changes);
  expect(next.ok).toBe(true);
  if(next.ok){
   expect(next.project.tracks[0]).toEqual(project.tracks[0]);
   expect(next.project.tracks[2]).toEqual(project.tracks[2]);
   expect(next.project.tracks[1]?.notes.some(n=>n.noteId==='harmony-after')).toBe(true);
  }
 });
 it('rejects three-track outputs, wrong roles, injected IDs or extras',async()=>{
  for(const response of [
   {tracks:[{role:'harmony',notes:[midi(64)]}]},
   {role:'bass',notes:[midi(40)]},
   {role:'harmony',notes:[{...midi(64),noteId:'spoof'}]},
   {role:'harmony',notes:[midi(64)],operations:[{type:'delete_note',trackId:'bass'}]},
   {role:'harmony',notes:[]}
  ]){
   await expect(proposeRegionRegeneration(fake(response),request)).rejects.toThrow();
  }
 });
 it('rejects illegal MIDI, non-integer note data and notes crossing scope',async()=>{
  for(const bad of [
   {...midi(64),startTick:-1},
   {...midi(64),startTick:1900},
   {...midi(64),velocity:128},
   {...midi(64),pitch:60.5}
  ]){
   await expect(proposeRegionRegeneration(fake({role:'harmony',notes:[bad]}),request)).rejects.toThrow();
  }
 });
 it('enforces only the selected part of a hard plan; a nonexistent generated bass must not block harmony',async()=>{
  const withPlan={...request,plan};
  const candidate=await proposeRegionRegeneration(fake({role:'harmony',notes:[midi(64)]}),withPlan);
  expect(candidate.changes.operations).toHaveLength(2);
  await expect(proposeRegionRegeneration(fake({role:'harmony',notes:[midi(62)]}),withPlan))
   .rejects.toThrow('plan_chords_violation:harmony');
 });
 it('applies bass inversion to the actual requested bass role',async()=>{
  const bassProject={...project,tracks:project.tracks.map(t=>t.trackId==='bass'?{...t,locked:false}:t)};
  const bassPlan={...plan,enforcement:{...plan.enforcement,inversions:'hard' as const}};
  const bassRequest={...request,project:bassProject,targetTrackId:'bass',targetRole:'bass' as const,plan:bassPlan};
  await expect(proposeRegionRegeneration(fake({role:'bass',notes:[midi(40)]}),bassRequest))
   .rejects.toThrow('plan_inversions_violation:bass');
  const accepted=await proposeRegionRegeneration(fake({role:'bass',notes:[midi(36)]}),bassRequest);
  expect(accepted.notes).toHaveLength(1);
 });
});
