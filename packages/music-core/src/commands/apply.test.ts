import {describe,it,expect} from 'vitest';
import {applyChangeSet} from './apply.js';
import type {MusicProject} from '../model/types.js';
const base:MusicProject={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]};
const note={noteId:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90};
describe('atomic note operations',()=>{
 it('creates an editable note',()=>{const r=applyChangeSet(base,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}]});expect(r.ok).toBe(true);if(r.ok){expect(r.project.tracks[0]?.notes[0]?.pitch).toBe(60);expect(base.tracks[0]?.notes).toHaveLength(0);}});
 it('rejects stale revision',()=>{expect(applyChangeSet(base,{baseRevision:1,operations:[{type:'add_note',trackId:'melody',note}]})).toMatchObject({ok:false,reason:'stale_revision'});});
 it('rejects invalid pitch without partial commit',()=>{const r=applyChangeSet(base,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note},{type:'add_note',trackId:'melody',note:{...note,noteId:'n2',pitch:140}}]});expect(r.ok).toBe(false);expect(base.tracks[0]?.notes).toHaveLength(0);});
 it('enforces track lock',()=>{const locked={...base,tracks:[{...base.tracks[0]!,locked:true}]};expect(applyChangeSet(locked,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}]})).toMatchObject({ok:false,reason:'track_locked'});});
});

describe('atomic generation provenance',()=>{
 const record={recordId:'gen-p-0',kind:'scoped' as const,sourceTrackId:'melody',targetTrackIds:['melody'],
  startTick:0,endTick:1920,seed:19501,providerId:'seeded-arranger-dev',instruction:'variation',
  planJson:JSON.stringify({tonic:0,mode:'major',degrees:[1]})};
 it('commits note edits and provenance together, and rolls back on invalid record',()=>{
  const change={baseRevision:0,operations:[{type:'add_note' as const,trackId:'melody',note}],generationRecord:record};
  const valid=applyChangeSet(base,change);
  expect(valid.ok).toBe(true);
  if(valid.ok){
   expect(valid.project.generationHistory?.[0]?.seed).toBe(19501);
   expect(valid.project.tracks[0]?.notes).toHaveLength(1);
  }
  const invalid=applyChangeSet(base,{...change,generationRecord:{...record,planJson:'not json'}});
  expect(invalid).toMatchObject({ok:false,reason:'invalid_generation_record'});
  expect(base.generationHistory).toBeUndefined();
 });
 it('rejects duplicate provenance IDs and overlong untrusted plan data',()=>{
  const p={...base,generationHistory:[record]};
  expect(applyChangeSet(p,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}],generationRecord:record}))
   .toMatchObject({ok:false,reason:'invalid_generation_record'});
  expect(applyChangeSet(base,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}],
   generationRecord:{...record,planJson:JSON.stringify({data:'x'.repeat(17000)})}}))
   .toMatchObject({ok:false,reason:'invalid_generation_record'});
 });
});

it('records independent mixed role seeds and rejects malformed ones',()=>{
 const project:MusicProject={projectId:'p',revision:0,ppq:480,tracks:[
  {trackId:'melody',name:'M',locked:false,notes:[]},{trackId:'h',name:'H',locked:false,notes:[]},
  {trackId:'b',name:'B',locked:false,notes:[]},{trackId:'a',name:'A',locked:false,notes:[]}]};
 const record={recordId:'mix0',kind:'three_track' as const,sourceTrackId:'melody',
  targetTrackIds:['h','b','a'],startTick:0,endTick:1920,providerId:'mixed-arrangement',
  instruction:'mix',seedsByRole:{harmony:19501,bass:101,accompaniment:22}};
 expect(applyChangeSet(project,{baseRevision:0,operations:[{type:'add_note',trackId:'h',note}],generationRecord:record}))
  .toMatchObject({ok:true});
 expect(applyChangeSet(project,{baseRevision:0,operations:[{type:'add_note',trackId:'h',note}],
  generationRecord:{...record,seedsByRole:{...record.seedsByRole,bass:-2}}}))
  .toMatchObject({ok:false,reason:'invalid_generation_record'});
});
