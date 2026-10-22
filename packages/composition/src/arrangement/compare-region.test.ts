import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {compareRegionCandidate} from './compare-region.js';
import {proposeRegionRegeneration} from './regenerate-region.js';
import type {ArrangementProvider} from './arrange.js';
const note=(id:string,pitch:number,startTick:number,durationTicks=480,velocity=80)=>
 ({noteId:id,pitch,startTick,durationTicks,velocity});
const project:MusicProject={projectId:'comparison',revision:3,ppq:480,tracks:[
 {trackId:'source',name:'Melody',locked:true,notes:[note('melody-a',72,0),note('melody-b',74,960)]},
 {trackId:'h',name:'Harmony',locked:false,notes:[
  note('h0',60,0),note('h1',65,960),note('outside',67,2400)]},
 {trackId:'b',name:'Bass',locked:true,notes:[note('bass',36,0)]}
]};
const req={project,sourceTrackId:'source',targetTrackId:'h',targetRole:'harmony' as const,
 startTick:0,endTick:1920,instruction:'compare variants',seed:19501};
const provider=(notes:readonly unknown[]):ArrangementProvider=>({id:'test',async generate(){
 return {role:'harmony',notes};
}});
describe('objective scoped candidate comparison',()=>{
 it('counts pitch-only MIDI changes and non-overlapping leaps without touching the project',async()=>{
  const before=JSON.stringify(project);
  const candidate=await proposeRegionRegeneration(provider([
   {pitch:62,startTick:0,durationTicks:480,velocity:80},
   {pitch:67,startTick:960,durationTicks:480,velocity:80}
  ]),{...req,editConstraint:'pitch_only'});
  expect(compareRegionCandidate(project,candidate)).toEqual({
   originalNoteCount:2,proposedNoteCount:2,addedNoteCount:0,removedNoteCount:0,
   changedPitchCount:2,preservedNoteCount:2,
   meanAbsPitchShift:2,maxAbsPitchShift:2,
   maxSequentialLeapBefore:5,maxSequentialLeapAfter:5
  });
  expect(JSON.stringify(project)).toBe(before);
 });
 it('does not fake note pairing or pitch-shift estimates for full replacement',async()=>{
  const candidate=await proposeRegionRegeneration(provider([
   {pitch:69,startTick:0,durationTicks:480,velocity:75}
  ]),req);
  expect(compareRegionCandidate(project,candidate)).toMatchObject({
   originalNoteCount:2,proposedNoteCount:1,
   addedNoteCount:1,removedNoteCount:2,changedPitchCount:0,preservedNoteCount:0,
   meanAbsPitchShift:null,maxAbsPitchShift:null,
   maxSequentialLeapBefore:5,maxSequentialLeapAfter:null
  });
 });
 it('ignores simultaneously sounding adjacent notes when measuring a melodic leap',async()=>{
  const poly:MusicProject={...project,tracks:project.tracks.map(t=>
   t.trackId==='h'?{...t,notes:[note('p0',60,0),note('p1',64,0),note('p2',67,960)]}:t)};
  const candidate=await proposeRegionRegeneration(provider([
   {pitch:62,startTick:0,durationTicks:480,velocity:80},
   {pitch:65,startTick:0,durationTicks:480,velocity:80},
   {pitch:69,startTick:960,durationTicks:480,velocity:80}
  ]),{...req,project:poly,editConstraint:'pitch_only'});
  const report=compareRegionCandidate(poly,candidate);
  expect(report.maxSequentialLeapBefore).toBe(3);
  expect(report.maxSequentialLeapAfter).toBe(4);
 });
 it('rejects stale proposals and operations outside the selected target',async()=>{
  const candidate=await proposeRegionRegeneration(provider([
   {pitch:62,startTick:0,durationTicks:480,velocity:80},
   {pitch:67,startTick:960,durationTicks:480,velocity:80}
  ]),{...req,editConstraint:'pitch_only'});
  expect(()=>compareRegionCandidate({...project,revision:4},candidate)).toThrow('comparison_stale_project');
  expect(()=>compareRegionCandidate(project,{
   ...candidate,changes:{...candidate.changes,operations:[
    {type:'delete_note' as const,trackId:'b',noteId:'bass'}]}
  })).toThrow('invalid_comparison_scope');
 });
});
