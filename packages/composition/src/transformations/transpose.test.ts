import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {proposeTranspose} from './transpose.js';
const first={noteId:'a',pitch:60,startTick:0,durationTicks:480,velocity:80};
const second={noteId:'b',pitch:72,startTick:480,durationTicks:240,velocity:100};
const others={noteId:'c',pitch:50,startTick:0,durationTicks:480,velocity:88,locked:true};
const project:MusicProject={projectId:'p',revision:2,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[first,second,others]}]};
describe('deterministic selection transposition',()=>{
 it('transposes only selected pitches, preserving ID, rhythm and velocity',()=>{
  const candidate=proposeTranspose(project,'melody',['b','a'],12);
  expect(candidate.changes.operations.every(x=>x.type==='update_note')).toBe(true);
  const commit=applyChangeSet(project,candidate.changes);
  expect(commit.ok).toBe(true);
  if(commit.ok){
   expect(commit.project.tracks[0]?.notes[0]).toEqual({...first,pitch:72});
   expect(commit.project.tracks[0]?.notes[1]).toEqual({...second,pitch:84});
   expect(commit.project.tracks[0]?.notes[2]).toEqual(others);
  }
  expect(project.tracks[0]?.notes[0]).toEqual(first);
 });
 it('rejects overflow, locked tracks, locked notes and duplicate IDs without mutation',()=>{
  const high={...project,tracks:[{...project.tracks[0]!,notes:[{...first,pitch:124}]}]};
  expect(()=>proposeTranspose(high,'melody',['a'],12)).toThrow('pitch_out_of_range');
  expect(()=>proposeTranspose(project,'melody',['c'],12)).toThrow('locked_note_in_range');
  expect(()=>proposeTranspose({...project,tracks:[{...project.tracks[0]!,locked:true}]},'melody',['a'],12)).toThrow('track_locked');
  expect(()=>proposeTranspose(project,'melody',['a','a'],12)).toThrow('invalid_note_selection');
  expect(()=>proposeTranspose(project,'melody',['missing'],12)).toThrow('selected_note_not_found');
  expect(project.tracks[0]?.notes).toEqual([first,second,others]);
 });
 it('rejects stale preview at commit',()=>{
  const c=proposeTranspose(project,'melody',['a'],-12);
  expect(applyChangeSet({...project,revision:3},c.changes)).toMatchObject({ok:false,reason:'stale_revision'});
 });
});
