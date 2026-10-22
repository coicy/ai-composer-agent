import {describe,it,expect} from 'vitest';
import {applyChangeSet,validateGenerationRecord} from '@ai-composer/music-core';
import type {MidiNote,MusicProject} from '@ai-composer/music-core';
import {proposeRegionRegeneration} from './regenerate-region.js';
import {proposeRegionVariants} from './region-variants.js';
import {SeededArranger} from './seeded-arranger.js';
import type {ArrangementProvider} from './arrange.js';
import {DEFAULT_REGISTERS} from '../planning/harmony-plan.js';

const n=(noteId:string,pitch:number,startTick:number,durationTicks=480,velocity=80):MidiNote=>
 ({noteId,pitch,startTick,durationTicks,velocity});
const source:MusicProject={projectId:'pitch-only',revision:3,ppq:480,tracks:[
 {trackId:'m',name:'Melody',locked:true,notes:[n('m0',72,0),n('m1',74,960)]},
 {trackId:'h',name:'Harmony',locked:false,notes:[
  n('h0',60,0,480,68),n('h1',64,0,480,78),n('h2',67,960,240,88),n('outside',65,1920)
 ]},
 {trackId:'b',name:'Bass',locked:true,notes:[n('bass',36,0)]}
]};
const req={project:source,sourceTrackId:'m',targetTrackId:'h',targetRole:'harmony' as const,
 startTick:0,endTick:1920,editConstraint:'pitch_only' as const,seed:19501,instruction:'vary pitches only'};
const fake=(result:unknown):ArrangementProvider=>({id:'test',async generate(){return result;}});
const raw=(notes:readonly Omit<MidiNote,'noteId'>[])=>({role:'harmony',notes});
describe('scoped pitch-only contract',()=>{
 it('preserves every original ID, time, duration, velocity, count and other track across commit',async()=>{
  const result=await proposeRegionRegeneration(new SeededArranger(),req);
  expect(result.notes).toHaveLength(3);
  expect(result.changes.operations.every(op=>op.type==='update_note'&&Object.keys(op.changes).join()==='pitch')).toBe(true);
  expect(result.removedNotes).toHaveLength(3);
  const updated=applyChangeSet(source,result.changes);
  expect(updated.ok).toBe(true);
  if(updated.ok){
   const after=updated.project;
   expect(after.tracks[0]).toEqual(source.tracks[0]);
   expect(after.tracks[2]).toEqual(source.tracks[2]);
   const target=after.tracks[1]!.notes;
   expect(target.map(x=>[x.noteId,x.startTick,x.durationTicks,x.velocity]))
    .toEqual(source.tracks[1]!.notes.map(x=>[x.noteId,x.startTick,x.durationTicks,x.velocity]));
   expect(target.some((x,i)=>x.pitch!==source.tracks[1]!.notes[i]?.pitch)).toBe(true);
  }
 });
 it('is deterministically reproducible across batch candidates with protected rhythm',async()=>{
  const first=await proposeRegionVariants(new SeededArranger(),req,3);
  const second=await proposeRegionVariants(new SeededArranger(),req,3);
  expect(first.map(c=>c.notes)).toEqual(second.map(c=>c.notes));
  expect(new Set(first.map(c=>JSON.stringify(c.notes.map(n=>n.pitch)))).size).toBeGreaterThan(1);
  expect(first.every(c=>c.editConstraint==='pitch_only')).toBe(true);
 });
 it('rejects any timing, duration, velocity, note-count changes or noop',async()=>{
  const baseline=[{pitch:62,startTick:0,durationTicks:480,velocity:68},
   {pitch:65,startTick:0,durationTicks:480,velocity:78},
   {pitch:69,startTick:960,durationTicks:240,velocity:88}];
  for(const replacement of [
   baseline.slice(0,2),
   baseline.map((x,i)=>i===0?{...x,startTick:120}:x),
   baseline.map((x,i)=>i===0?{...x,durationTicks:360}:x),
   baseline.map((x,i)=>i===0?{...x,velocity:77}:x)
  ])await expect(proposeRegionRegeneration(fake(raw(replacement)),req)).rejects.toThrow('pitch_only_rhythm_mismatch');
  await expect(proposeRegionRegeneration(fake(raw(source.tracks[1]!.notes.slice(0,3).map(({pitch,startTick,durationTicks,velocity})=>({pitch,startTick,durationTicks,velocity})))),req))
   .rejects.toThrow('no_pitch_changes');
 });
 it('safely pairs chords sharing onset and duration without reassigning identities',async()=>{
  const variant=raw([
   {pitch:66,startTick:0,durationTicks:480,velocity:78},
   {pitch:59,startTick:0,durationTicks:480,velocity:68},
   {pitch:70,startTick:960,durationTicks:240,velocity:88}
  ]);
  const result=await proposeRegionRegeneration(fake(variant),req);
  expect(result.notes.find(x=>x.noteId==='h0')?.pitch).toBe(59);
  expect(result.notes.find(x=>x.noteId==='h1')?.pitch).toBe(66);
  expect(result.notes.find(x=>x.noteId==='h2')?.pitch).toBe(70);
  expect(result.changes.operations).toHaveLength(3);
 });
 it('rejects empty, dense and locked target notes before invoking provider',async()=>{
  let called=0;
  const spy:ArrangementProvider={id:'spy',async generate(){called++;throw new Error('unexpected');}};
  const empty={...source,tracks:source.tracks.map(t=>t.trackId==='h'?{...t,notes:[n('after',65,2300)]}:t)};
  await expect(proposeRegionRegeneration(spy,{...req,project:empty})).rejects.toThrow('pitch_only_requires_notes');
  const dense={...source,tracks:source.tracks.map(t=>t.trackId==='h'?{...t,
   notes:Array.from({length:33},(_,i)=>n('d'+i,50+i%24,0))}:t)};
  await expect(proposeRegionRegeneration(spy,{...req,project:dense})).rejects.toThrow('pitch_only_region_too_dense');
  const locked={...source,tracks:source.tracks.map(t=>t.trackId==='h'?{...t,
   notes:t.notes.map(n=>n.noteId==='h1'?{...n,locked:true}:n)}:t)};
  await expect(proposeRegionRegeneration(spy,{...req,project:locked})).rejects.toThrow('locked_note_in_range');
  await expect(proposeRegionRegeneration(spy,{...req,editConstraint:'ignore' as never})).rejects.toThrow('invalid_edit_constraint');
  expect(called).toBe(0);
 });
 it('keeps hard chord and scale checking active when only pitch can change',async()=>{
  const plan={tonic:0,mode:'major' as const,degrees:[1] as const,registers:DEFAULT_REGISTERS,
   enforcement:{scale:'hard' as const,chords:'hard' as const,registers:'hard' as const}};
  await expect(proposeRegionRegeneration(fake(raw([
   {pitch:61,startTick:0,durationTicks:480,velocity:68},
   {pitch:64,startTick:0,durationTicks:480,velocity:78},
   {pitch:67,startTick:960,durationTicks:240,velocity:88}
  ])),{...req,plan})).rejects.toThrow('plan_scale_violation:harmony');
  const accepted=await proposeRegionRegeneration(fake(raw([
   {pitch:64,startTick:0,durationTicks:480,velocity:68},
   {pitch:67,startTick:0,durationTicks:480,velocity:78},
   {pitch:72,startTick:960,durationTicks:240,velocity:88}
  ])),{...req,plan});
  expect(accepted.changes.operations.every(x=>x.type==='update_note')).toBe(true);
 });
 it('generation provenance records can store the rule only for scoped approvals',()=>{
  const record={recordId:'r1',kind:'scoped' as const,sourceTrackId:'m',targetTrackIds:['h'],
   startTick:0,endTick:1920,seed:19501,providerId:'test',instruction:'pitch',editConstraint:'pitch_only' as const};
  expect(validateGenerationRecord(record)).toBe(true);
  expect(validateGenerationRecord({...record,kind:'three_track',targetTrackIds:['h','b','x']})).toBe(false);
  expect(validateGenerationRecord({...record,editConstraint:'bad' as never})).toBe(false);
 });
});

describe('structured iterative feedback in pitch-only scope',()=>{
 const project:MusicProject={projectId:'feedback',revision:9,ppq:480,tracks:[
  {trackId:'src',name:'Source',locked:true,notes:[n('m',70,0)]},
  {trackId:'target',name:'Harmony',locked:false,notes:[
   n('opening',60,0),n('second',62,480),n('ending',65,960),n('outside',67,2200)
  ]},
  {trackId:'other',name:'Bass',locked:true,notes:[n('bass',40,0)]}
 ]};
 const base={project,sourceTrackId:'src',targetTrackId:'target',targetRole:'harmony' as const,
  editConstraint:'pitch_only' as const,startTick:0,endTick:1920,instruction:'keep the opening, smooth the ending',
  seed:19501,protectedPrefixCount:2,maxLeapSemitones:5};
 const raw3=(p0:number,p1:number,p2:number)=>({role:'harmony',notes:[
  {pitch:p0,startTick:0,durationTicks:480,velocity:80},
  {pitch:p1,startTick:480,durationTicks:480,velocity:80},
  {pitch:p2,startTick:960,durationTicks:480,velocity:80}
 ]});
 it('preserves opening identities and changes only permitted later pitches',async()=>{
  const candidate=await proposeRegionRegeneration(fake(raw3(60,62,67)),base);
  expect(candidate.protectedPrefixCount).toBe(2);
  expect(candidate.maxLeapSemitones).toBe(5);
  expect(candidate.changes.operations).toEqual([
   {type:'update_note',trackId:'target',noteId:'ending',changes:{pitch:67}}
  ]);
  const applied=applyChangeSet(project,candidate.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok){
   expect(applied.project.tracks[1]!.notes.map(x=>x.noteId)).toEqual(['opening','second','ending','outside']);
   expect(applied.project.tracks[1]!.notes.map(x=>x.pitch)).toEqual([60,62,67,67]);
   expect(applied.project.tracks[0]).toEqual(project.tracks[0]);
   expect(applied.project.tracks[2]).toEqual(project.tracks[2]);
  }
 });
 it('rejects generated changes to protected opening, even if the rhythm matches',async()=>{
  await expect(proposeRegionRegeneration(fake(raw3(61,62,67)),base))
   .rejects.toThrow('protected_note_changed');
  await expect(proposeRegionRegeneration(fake(raw3(60,63,67)),base))
   .rejects.toThrow('protected_note_changed');
 });
 it('checks leaps between sequential notes and into untouched following boundary',async()=>{
  await expect(proposeRegionRegeneration(fake(raw3(60,62,75)),base))
   .rejects.toThrow('leap_constraint_violation');
  const brokenBoundary={...base,project:{...project,tracks:project.tracks.map(t=>
   t.trackId==='target'?{...t,notes:t.notes.map(n=>n.noteId==='outside'?{...n,pitch:95}:n)}:t)}};
  await expect(proposeRegionRegeneration(fake(raw3(60,62,67)),brokenBoundary))
   .rejects.toThrow('leap_constraint_violation');
 });
 it('validates malformed constraint scope before calling the model',async()=>{
  let called=0;
  const spy:ArrangementProvider={id:'spy',async generate(){called++;throw new Error('unexpected');}};
  await expect(proposeRegionRegeneration(spy,{...base,protectedPrefixCount:3}))
   .rejects.toThrow('invalid_protected_prefix');
  await expect(proposeRegionRegeneration(spy,{...base,protectedPrefixCount:17}))
   .rejects.toThrow('invalid_protected_prefix');
  await expect(proposeRegionRegeneration(spy,{...base,maxLeapSemitones:0}))
   .rejects.toThrow('invalid_leap_constraint');
  await expect(proposeRegionRegeneration(spy,{...base,maxLeapSemitones:30}))
   .rejects.toThrow('invalid_leap_constraint');
  await expect(proposeRegionRegeneration(spy,{...base,editConstraint:undefined}))
   .rejects.toThrow('feedback_requires_pitch_only');
  expect(called).toBe(0);
 });
 it('makes deterministic seeded iterations satisfying both feedback constraints',async()=>{
  const first=await proposeRegionRegeneration(new SeededArranger(),base);
  const second=await proposeRegionRegeneration(new SeededArranger(),base);
  expect(first.notes).toEqual(second.notes);
  expect(first.notes.slice(0,2).map(x=>x.pitch)).toEqual([60,62]);
  const pitches=first.notes.map(x=>x.pitch);
  expect(Math.abs(pitches[2]!-pitches[1]!)).toBeLessThanOrEqual(5);
  expect(Math.abs(67-pitches[2]!)).toBeLessThanOrEqual(5);
  expect(first.changes.operations).toHaveLength(1);
 });
 it('records feedback parameters only with scoped pitch-only provenance',()=>{
  const record={recordId:'feedback-1',kind:'scoped' as const,sourceTrackId:'src',
   targetTrackIds:['target'],startTick:0,endTick:1920,providerId:'seeded',
   instruction:'keep two',editConstraint:'pitch_only' as const,
   protectedPrefixCount:2,maxLeapSemitones:5};
  expect(validateGenerationRecord(record)).toBe(true);
  expect(validateGenerationRecord({...record,protectedPrefixCount:17})).toBe(false);
  expect(validateGenerationRecord({...record,maxLeapSemitones:0})).toBe(false);
  expect(validateGenerationRecord({...record,editConstraint:undefined})).toBe(false);
 });
});
