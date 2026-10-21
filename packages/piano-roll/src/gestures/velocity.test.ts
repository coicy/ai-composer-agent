import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import {makeVelocityOperations} from './velocity.js';
const notes=[
 {noteId:'one',pitch:60,startTick:0,durationTicks:480,velocity:80},
 {noteId:'two',pitch:64,startTick:240,durationTicks:240,velocity:90},
 {noteId:'locked',pitch:67,startTick:480,durationTicks:480,velocity:50,locked:true}
];
describe('velocity editing',()=>{
 it('changes only chosen velocities in a single transaction',()=>{
  const operations=makeVelocityOperations('track',notes,['one','two'],100);
  const p={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'track',name:'A',locked:false,notes}]};
  const changed=applyChangeSet(p,{baseRevision:0,operations});
  expect(changed.ok).toBe(true);
  if(changed.ok){
   expect(changed.project.revision).toBe(1);
   expect(changed.project.tracks[0]!.notes).toEqual([{...notes[0],velocity:100},{...notes[1],velocity:100},notes[2]]);
   expect(p.tracks[0]!.notes).toEqual(notes);
  }
 });
 it('refuses invalid velocity, locked note and stale ID',()=>{
  expect(()=>makeVelocityOperations('track',notes,['one'],0)).toThrow('invalid_velocity');
  expect(()=>makeVelocityOperations('track',notes,['one'],128)).toThrow('invalid_velocity');
  expect(()=>makeVelocityOperations('track',notes,['locked'],88)).toThrow('locked_note_in_range');
  expect(()=>makeVelocityOperations('track',notes,['missing'],88)).toThrow('selected_note_not_found');
  expect(makeVelocityOperations('track',notes,['one'],80)).toHaveLength(0);
 });
});
