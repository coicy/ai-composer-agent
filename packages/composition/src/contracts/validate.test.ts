import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {applyChangeSet} from '@ai-composer/music-core';
import type {CompositionProvider} from './provider.js';
import {proposeWithProvider} from './validate.js';
import {SeededProvider} from '../providers/seeded-provider.js';
const project:MusicProject={projectId:'test',revision:2,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[{noteId:'human',pitch:60,startTick:0,durationTicks:480,velocity:80,locked:true}]}]};
const request={project,trackId:'melody',startTick:1920,endTick:3840,instruction:'Write a short continuation'};
const fake=(raw:unknown):CompositionProvider=>({id:'fake',async generate(){return raw;}});
describe('composition provider boundary',()=>{
 it('returns a preview without mutating project',async()=>{
  const p=await proposeWithProvider(new SeededProvider(),request);
  expect(p.notes.length).toBeGreaterThan(0);
  expect(project.tracks[0]?.notes).toHaveLength(1);
  const applied=applyChangeSet(project,p.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok)expect(applied.project.tracks[0]?.notes[0]?.noteId).toBe('human');
 });
 it('rejects provider output outside scope',async()=>{
  await expect(proposeWithProvider(fake({notes:[{pitch:60,startTick:0,durationTicks:240,velocity:90}]}),request)).rejects.toThrow('note_outside_scope');
 });
 it('rejects untrusted extra fields and invalid notes',async()=>{
  await expect(proposeWithProvider(fake({notes:[{pitch:60,startTick:1920,durationTicks:240,velocity:90,locked:false}]}),request)).rejects.toThrow('unexpected_provider_field');
  await expect(proposeWithProvider(fake({notes:[{pitch:140,startTick:1920,durationTicks:240,velocity:90}]}),request)).rejects.toThrow('invalid_provider_note');
 });
 it('rejects nonempty or locked target scope',async()=>{
  await expect(proposeWithProvider(new SeededProvider(),{...request,startTick:0,endTick:1920})).rejects.toThrow('scope_not_empty');
  const locked={...project,tracks:[{...project.tracks[0]!,locked:true}]};
  await expect(proposeWithProvider(new SeededProvider(),{...request,project:locked})).rejects.toThrow('track_locked');
 });
 it('rejects applying a stale preview',async()=>{
  const p=await proposeWithProvider(new SeededProvider(),request);
  expect(applyChangeSet({...project,revision:3},p.changes)).toMatchObject({ok:false,reason:'stale_revision'});
 });
});
