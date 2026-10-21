import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {proposeRegionRegeneration} from './regenerate-region.js';
import type {ArrangementProvider} from './arrange.js';
import {SeededArranger} from './seeded-arranger.js';

const p:MusicProject={
 projectId:'p',revision:5,ppq:480,tracks:[
  {trackId:'melody',name:'Original',locked:true,notes:[
   {noteId:'source-1',pitch:64,startTick:0,durationTicks:480,velocity:90},
   {noteId:'source-2',pitch:67,startTick:1920,durationTicks:480,velocity:90}
  ]},
  {trackId:'harmony',name:'Approved harmony',locked:false,notes:[
   {noteId:'keep-before',pitch:60,startTick:0,durationTicks:480,velocity:65},
   {noteId:'replace',pitch:69,startTick:1920,durationTicks:480,velocity:66},
   {noteId:'keep-after',pitch:72,startTick:4000,durationTicks:480,velocity:67}
  ]},
  {trackId:'bass',name:'Approved bass',locked:true,notes:[
   {noteId:'bass-stays',pitch:36,startTick:1920,durationTicks:480,velocity:75}
  ]}
 ]
};
const request={project:p,sourceTrackId:'melody',targetTrackId:'harmony',targetRole:'harmony' as const,
 startTick:1920,endTick:3840,instruction:'Retain other parts and vary this phrase',seed:19501};
describe('scoped arrangement regeneration',()=>{
 it('makes a preview without mutating source, bass or out-of-window notes',async()=>{
  const result=await proposeRegionRegeneration(new SeededArranger(),request);
  expect(result.changes.baseRevision).toBe(5);
  expect(result.changes.operations.map(x=>x.type)).toEqual(['delete_note','add_note','add_note']);
  expect(result.removedNotes.map(n=>n.noteId)).toEqual(['replace']);
  expect(p.tracks[1]!.notes).toHaveLength(3);
  const updated=applyChangeSet(p,result.changes);
  expect(updated.ok).toBe(true);
  if(updated.ok){
   expect(updated.project.revision).toBe(6);
   expect(updated.project.tracks).toHaveLength(3);
   expect(updated.project.tracks[0]).toEqual(p.tracks[0]);
   expect(updated.project.tracks[2]).toEqual(p.tracks[2]);
   const notes=updated.project.tracks[1]!.notes;
   expect(notes.find(n=>n.noteId==='keep-before')).toEqual(p.tracks[1]!.notes[0]);
   expect(notes.find(n=>n.noteId==='keep-after')).toEqual(p.tracks[1]!.notes[2]);
   expect(notes.some(n=>n.noteId==='replace')).toBe(false);
   expect(notes.filter(n=>n.startTick>=1920&&n.startTick<3840)).toHaveLength(2);
  }
 });
 it('returns repeatable seeded MIDI proposals and checks stale commit',async()=>{
  const a=await proposeRegionRegeneration(new SeededArranger(),request);
  const b=await proposeRegionRegeneration(new SeededArranger(),request);
  expect(a.notes).toEqual(b.notes);
  expect(applyChangeSet({...p,revision:6},a.changes)).toMatchObject({ok:false,reason:'stale_revision'});
 });
 it('rejects locked and partially overlapping target notes before model calls',async()=>{
  let called=0;
  const provider:ArrangementProvider={id:'spy',async generate(){called++;throw new Error('should_not_call_provider');}};
  const locked={...p,tracks:p.tracks.map(t=>t.trackId==='harmony'?{...t,locked:true}:t)};
  await expect(proposeRegionRegeneration(provider,{...request,project:locked})).rejects.toThrow('track_locked');
  const withLockedNote={...p,tracks:p.tracks.map(t=>t.trackId==='harmony'?{
   ...t,notes:t.notes.map(n=>n.noteId==='replace'?{...n,locked:true}:n)
  }:t)};
  await expect(proposeRegionRegeneration(provider,{...request,project:withLockedNote})).rejects.toThrow('locked_note_in_range');
  const crossing={...p,tracks:p.tracks.map(t=>t.trackId==='harmony'?{
   ...t,notes:t.notes.map(n=>n.noteId==='replace'?{...n,startTick:1800,durationTicks:300}:n)
  }:t)};
  await expect(proposeRegionRegeneration(provider,{...request,project:crossing})).rejects.toThrow('cross_boundary_note');
  expect(called).toBe(0);
 });
 it('protects source and rejects missing or invalid targets before generation',async()=>{
  await expect(proposeRegionRegeneration(new SeededArranger(),{...request,targetTrackId:'melody'}))
   .rejects.toThrow('source_track_is_target');
  await expect(proposeRegionRegeneration(new SeededArranger(),{...request,targetTrackId:'missing'}))
   .rejects.toThrow('target_track_not_found');
  await expect(proposeRegionRegeneration(new SeededArranger(),{...request,targetRole:'not-a-role' as never}))
   .rejects.toThrow('invalid_arrangement_role');
 });
});
