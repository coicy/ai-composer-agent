import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {applyChangeSet} from '@ai-composer/music-core';
import type {CompositionProvider} from './provider.js';
import {proposeWithProvider} from './validate.js';
import {SeededProvider} from '../providers/seeded-provider.js';

const project:MusicProject={projectId:'test',revision:2,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[{noteId:'human',pitch:60,startTick:0,durationTicks:480,velocity:80,locked:true}]}]};
const request={project,trackId:'melody',startTick:1920,endTick:3840,instruction:'Write a short continuation'};
const fake=(raw:unknown):CompositionProvider=>({id:'fake',async generate(){return raw;}});
const note=(startTick:number,pitch=62)=>({pitch,startTick,durationTicks:240,velocity:90});
describe('composition provider boundary',()=>{
 it('previews append without mutation and preserves human note',async()=>{
  const p=await proposeWithProvider(new SeededProvider(),request);
  expect(p.notes.length).toBeGreaterThan(0);
  expect(p.removedNotes).toHaveLength(0);
  expect(project.tracks[0]?.notes).toHaveLength(1);
  const applied=applyChangeSet(project,p.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok)expect(applied.project.tracks[0]?.notes[0]?.noteId).toBe('human');
 });
 it('replaces ONLY entirely-contained unlocked notes',async()=>{
  const target={noteId:'edit-me',...note(1920)};
  const after={noteId:'after',...note(3840)};
  const before={noteId:'before',...note(1440)};
  const p0:MusicProject={...project,tracks:[{...project.tracks[0]!,notes:[...project.tracks[0]!.notes,before,target,after]}]};
  const result=await proposeWithProvider(fake({notes:[note(1920,72),note(2160,74)]}),{...request,project:p0,mode:'replace'});
  expect(result.removedNotes.map(n=>n.noteId)).toEqual(['edit-me']);
  expect(result.changes.operations.map(n=>n.type)).toEqual(['delete_note','add_note','add_note']);
  expect(p0.tracks[0]?.notes.some(n=>n.noteId==='edit-me')).toBe(true);
  const committed=applyChangeSet(p0,result.changes);expect(committed.ok).toBe(true);
  if(committed.ok){
   const updated=committed.project.tracks[0]!.notes;
   expect(updated.find(n=>n.noteId==='edit-me')).toBeUndefined();
   expect(updated.find(n=>n.noteId==='before')).toEqual(before);
   expect(updated.find(n=>n.noteId==='after')).toEqual(after);
   expect(updated.find(n=>n.noteId==='human')).toEqual(project.tracks[0]!.notes[0]);
  }
 });
 it('rejects partial-overlap and locked selections BEFORE provider call',async()=>{
  let calls=0;
  const provider:CompositionProvider={id:'spy',async generate(){calls++;return {notes:[note(1920)]};}};
  for(const overlapping of [
    {noteId:'left',pitch:60,startTick:1800,durationTicks:240,velocity:90},
    {noteId:'right',pitch:60,startTick:3720,durationTicks:480,velocity:90}
  ]){
   const p0={...project,tracks:[{...project.tracks[0]!,notes:[overlapping]}]};
   await expect(proposeWithProvider(provider,{...request,project:p0,mode:'replace'})).rejects.toThrow('cross_boundary_note');
  }
  const locked={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'locked-target',...note(1920),locked:true}]}]};
  await expect(proposeWithProvider(provider,{...request,project:locked,mode:'replace'})).rejects.toThrow('locked_note_in_range');
  expect(calls).toBe(0);
 });
 it('rejects provider output outside scope',async()=>{
  await expect(proposeWithProvider(fake({notes:[note(0)]}),request)).rejects.toThrow('note_outside_scope');
 });
 it('rejects untrusted extra fields and invalid notes',async()=>{
  await expect(proposeWithProvider(fake({notes:[{...note(1920),locked:false}]}),request)).rejects.toThrow('unexpected_provider_field');
  await expect(proposeWithProvider(fake({notes:[note(1920,140)]}),request)).rejects.toThrow('invalid_provider_note');
 });
 it('rejects occupied append and locked target track',async()=>{
  await expect(proposeWithProvider(new SeededProvider(),{...request,startTick:0,endTick:1920})).rejects.toThrow('scope_not_empty');
  const locked={...project,tracks:[{...project.tracks[0]!,locked:true}]};
  await expect(proposeWithProvider(new SeededProvider(),{...request,project:locked})).rejects.toThrow('track_locked');
 });
 it('rejects stale preview and does not mutate previous project',async()=>{
  const p=await proposeWithProvider(new SeededProvider(),request);
  expect(applyChangeSet({...project,revision:3},p.changes)).toMatchObject({ok:false,reason:'stale_revision'});
  expect(project.tracks[0]!.notes).toHaveLength(1);
 });
});
