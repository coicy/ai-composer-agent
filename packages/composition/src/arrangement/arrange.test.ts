import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {proposeArrangement} from './arrange.js';
import type {ArrangementProvider} from './arrange.js';
const melody={noteId:'melody-1',pitch:64,startTick:0,durationTicks:480,velocity:91,locked:true};
const original:MusicProject={projectId:'p',revision:3,ppq:480,tracks:[{trackId:'source',name:'旋律',locked:true,notes:[melody]}]};
const note=(pitch:number,startTick=0)=>({pitch,startTick,durationTicks:480,velocity:84});
const tracks=()=>({tracks:[
 {role:'bass',notes:[note(40)]},
 {role:'accompaniment',notes:[note(55)]},
 {role:'harmony',notes:[note(68)]}
]});
const request={project:original,sourceTrackId:'source',startTick:0,endTick:1920,instruction:'Add fantasy-game harmony and bass'};
const fake=(value:unknown):ArrangementProvider=>({id:'mock',async generate(){return value;}});
describe('atomic three-track arrangement candidate',()=>{
 it('adds three independent tracks in a single revision without changing locked source',async()=>{
  const candidate=await proposeArrangement(fake(tracks()),request);
  expect(candidate.changes.operations.map(x=>x.type)).toEqual(['add_track','add_track','add_track']);
  expect(candidate.tracks.map(t=>t.name)).toEqual(['AI 和声','AI 低音','AI 伴奏']);
  expect(original.tracks).toHaveLength(1);
  const applied=applyChangeSet(original,candidate.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok){
   expect(applied.project.revision).toBe(4);
   expect(applied.project.tracks).toHaveLength(4);
   expect(applied.project.tracks[0]).toEqual(original.tracks[0]);
  }
 });
 it('rejects absent, extra and duplicate roles',async()=>{
  for(const invalid of [{tracks:tracks().tracks.slice(0,2)},{tracks:[...tracks().tracks.slice(0,2),tracks().tracks[0]]},{tracks:[...tracks().tracks,{role:'extra',notes:[note(60)]}]}]){
   await expect(proposeArrangement(fake(invalid),request)).rejects.toThrow();
  }
 });
 it('rejects extra fields, invalid MIDI data and out-of-scope notes',async()=>{
  const cases=[
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[{...note(40),locked:true}]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[note(140)]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[{...note(40),durationTicks:2000}]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[]})}
  ];
  for(const invalid of cases)await expect(proposeArrangement(fake(invalid),request)).rejects.toThrow();
 });
 it('rejects empty source, missing source and scope greater than four bars',async()=>{
  const blank={...original,tracks:[{...original.tracks[0]!,notes:[]}]};
  await expect(proposeArrangement(fake(tracks()),{...request,project:blank})).rejects.toThrow('empty_source_range');
  await expect(proposeArrangement(fake(tracks()),{...request,sourceTrackId:'other'})).rejects.toThrow('source_track_not_found');
  await expect(proposeArrangement(fake(tracks()),{...request,endTick:9000})).rejects.toThrow('invalid_arrangement_scope');
 });
 it('rejects old revision and prevents ID collisions',async()=>{
  const candidate=await proposeArrangement(fake(tracks()),request);
  expect(applyChangeSet({...original,revision:4},candidate.changes)).toMatchObject({ok:false,reason:'stale_revision'});
  const colliding={...original,tracks:[...original.tracks,{trackId:candidate.tracks[0]!.trackId,name:'Existing',locked:false,notes:[]}]};
  await expect(proposeArrangement(fake(tracks()),{...request,project:colliding})).rejects.toThrow('arrangement_track_collision');
 });
});
