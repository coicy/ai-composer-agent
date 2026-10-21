import {describe,it,expect} from 'vitest';
import type {MusicProject,MidiNote} from '@ai-composer/music-core';
import {SeededArranger} from './seeded-arranger.js';
import {proposeArrangement} from './arrange.js';
import {proposeRegionRegeneration} from './regenerate-region.js';
import {createArrangementEditingContext} from './editing-context.js';
import type {ArrangementProvider} from './arrange.js';
import type {ArrangementEditingContext} from './editing-context.js';

const note=(id:string,pitch:number,startTick:number,durationTicks=480):MidiNote=>
 ({noteId:id,pitch,startTick,durationTicks,velocity:85});
const project:MusicProject={projectId:'editing',revision:4,ppq:480,tracks:[
 {trackId:'melody',name:'Main',locked:true,notes:[note('source-a',72,1920),note('source-b',74,2880)]},
 {trackId:'harm',name:'Harmony',locked:false,notes:[
  note('lead-in',67,0),note('old-1',64,1920),note('old-2',65,2880),note('lead-out',69,4000)
 ]},
 {trackId:'bass',name:'Bass',locked:true,notes:[note('bass-secret',40,1920),note('bass-next',43,3840)]},
 {trackId:'perc',name:'Accompaniment',locked:true,notes:[note('pad-secret',55,1920)]}
]};
const req={project,sourceTrackId:'melody',targetTrackId:'harm',targetRole:'harmony' as const,
 startTick:1920,endTick:3840,seed:19501,instruction:'Continue the harmonic contour'};
describe('read-only region editing context',()=>{
 it('exposes bounded reference notes without writing to protected score tracks',async()=>{
  const snapshot=JSON.stringify(project);
  let editing:ArrangementEditingContext|undefined;
  const provider:ArrangementProvider={id:'spy',async generate(ctx){
   editing=ctx.editing;return new SeededArranger().generate(ctx);
  }};
  const result=await proposeRegionRegeneration(provider,req);
  expect(editing).toBeDefined();
  expect(editing?.before.map(n=>n.noteId)).toEqual(['lead-in']);
  expect(editing?.original.map(n=>n.noteId)).toEqual(['old-1','old-2']);
  expect(editing?.after.map(n=>n.noteId)).toEqual(['lead-out']);
  expect(editing?.protectedParts.map(p=>p.trackIndex)).toEqual([2,3]);
  expect(editing?.protectedParts[0]?.notes.map(n=>n.noteId)).toEqual(['bass-secret','bass-next']);
  expect(result.changes.operations.every(op=>op.type==='add_note'||op.type==='delete_note')).toBe(true);
  expect(result.changes.operations.every(op=>op.type==='add_note'||op.type==='delete_note'?
   op.trackId==='harm':false)).toBe(true);
  expect(JSON.stringify(project)).toBe(snapshot);
 });
 it('limits protected context regardless of score size',()=>{
  const many={...project,tracks:project.tracks.map(t=>
   t.trackId==='bass'?{...t,notes:Array.from({length:100},(_,i)=>note('b-'+i,40,480*i))}:t)};
  const ctx=createArrangementEditingContext(many,'melody',{targetTrackId:'harm',targetRole:'harmony'},1920,3840);
  expect(ctx.protectedParts[0]?.notes.length).toBe(16);
  expect(ctx.protectedParts[0]?.notes.map(n=>n.noteId)).toContain('b-4');
 });
 it('rejects locked and crossing targets before provider invocation',async()=>{
  let called=0;
  const spy:ArrangementProvider={id:'spy',async generate(){called++;throw new Error('unexpected');}};
  const locked={...project,tracks:project.tracks.map(t=>
   t.trackId==='harm'?{...t,notes:t.notes.map(n=>n.noteId==='old-1'?{...n,locked:true}:n)}:t)};
  await expect(proposeArrangement(spy,{...req,project:locked,editing:{targetTrackId:'harm',targetRole:'harmony'}}))
   .rejects.toThrow('locked_note_in_range');
  const crossing={...project,tracks:project.tracks.map(t=>
   t.trackId==='harm'?{...t,notes:t.notes.map(n=>n.noteId==='old-1'?{...n,startTick:1900}:n)}:t)};
  await expect(proposeArrangement(spy,{...req,project:crossing,editing:{targetTrackId:'harm',targetRole:'harmony'}}))
   .rejects.toThrow('cross_boundary_note');
  await expect(proposeArrangement(spy,{...req,editing:{targetTrackId:'melody',targetRole:'harmony'}}))
   .rejects.toThrow('source_track_is_target');
  expect(called).toBe(0);
 });
 it('leaves ordinary three-track generation context without an editing intent',async()=>{
  let observed:unknown='unset';
  const provider:ArrangementProvider={id:'spy',async generate(ctx){
   observed=ctx.editing;return new SeededArranger().generate(ctx);
  }};
  await proposeArrangement(provider,{project,sourceTrackId:'melody',startTick:1920,endTick:3840,instruction:'normal',seed:19501});
  expect(observed).toBeUndefined();
 });
});
