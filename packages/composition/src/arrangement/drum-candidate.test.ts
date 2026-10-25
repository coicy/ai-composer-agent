import {describe,it,expect} from 'vitest';
import {prepareDrumContext,proposeDrumCandidate} from './drum-candidate.js';
import type {MusicProject} from '@ai-composer/music-core';
const project:MusicProject={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'melody',name:'melody',locked:true,notes:[
 {noteId:'m0',pitch:64,startTick:0,durationTicks:480,velocity:90}
]}]};
const request={project,style:'house' as const,startTick:0,endTick:1920,seed:19501,instruction:'Four-floor kick and varied hi-hats'};
const notes=Array.from({length:4},(_,i)=>({pitch:36,startTick:i*480,durationTicks:120,velocity:105}));
describe('independent drum candidates',()=>{
 it('requests concrete signature beats and returns an uncommitted GM drum lane',async()=>{
  const original=JSON.stringify(project);
  const p={id:'mock',async generateDrums(ctx:ReturnType<typeof prepareDrumContext>){
   expect(ctx.requiredKickBeats).toEqual([0,480,960,1440]);return {notes};
  }};
  const result=await proposeDrumCandidate(p,request);
  expect(result.track).toMatchObject({channel:9,isDrum:true,locked:false});
  expect(result.evidence).toMatchObject({status:'observed',expectedCount:4,kickCount:4});
  expect(result.changes.baseRevision).toBe(0);
  expect(JSON.stringify(project)).toBe(original);
 });
 it('reports missing kick evidence instead of inventing success',async()=>{
  const result=await proposeDrumCandidate({id:'mock',async generateDrums(){return {notes:notes.slice(1)};}},request);
  expect(result.evidence).toMatchObject({status:'not_observed',missingBeats:[0]});
 });
 it('rejects invalid notes and unauthorized pitch roles',async()=>{
  await expect(proposeDrumCandidate({id:'x',async generateDrums(){return {notes:[{...notes[0],pitch:60}]};}},request)).rejects.toThrow('invalid_drum_note');
  await expect(proposeDrumCandidate({id:'x',async generateDrums(){return {notes:[{...notes[0],startTick:2000}]};}},request)).rejects.toThrow('invalid_drum_note');
 });
 it('does not impose four-floor kicks on ambient',()=>{
  expect(prepareDrumContext({...request,style:'ambient'}).requiredKickBeats).toHaveLength(0);
 });
});
