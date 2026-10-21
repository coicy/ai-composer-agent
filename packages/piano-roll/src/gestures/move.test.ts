import {describe,it,expect} from 'vitest';
import type {MidiNote} from '@ai-composer/music-core';
import {applyChangeSet} from '@ai-composer/music-core';
import {makeMoveOperations} from './move.js';
const a:MidiNote={noteId:'a',pitch:60,startTick:240,durationTicks:480,velocity:90};
const b:MidiNote={noteId:'b',pitch:64,startTick:480,durationTicks:240,velocity:70};
const locked:MidiNote={noteId:'locked',pitch:70,startTick:0,durationTicks:480,velocity:99,locked:true};
const notes=[a,b,locked];
describe('atomic multi-note movement',()=>{
 it('moves chosen notes together without changing unselected notes',()=>{
  const operations=makeMoveOperations('melody',notes,['b','a'],120,3);
  expect(operations).toHaveLength(2);
  const project={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'melody',name:'melody',locked:false,notes}]};
  const applied=applyChangeSet(project,{baseRevision:0,operations});
  expect(applied.ok).toBe(true);
  if(applied.ok){
   const after=applied.project.tracks[0]!.notes;
   expect(after[0]).toEqual({...a,pitch:63,startTick:360});
   expect(after[1]).toEqual({...b,pitch:67,startTick:600});
   expect(after[2]).toEqual(locked);
  }
 });
 it('refuses locked, out-of-range and missing selections before constructing a batch',()=>{
  expect(()=>makeMoveOperations('melody',notes,['a','locked'],0,1)).toThrow('locked_note_in_range');
  expect(()=>makeMoveOperations('melody',notes,['a'],0,-61)).toThrow('move_out_of_range');
  expect(()=>makeMoveOperations('melody',notes,['a'],-241,0)).toThrow('move_out_of_range');
  expect(()=>makeMoveOperations('melody',notes,['missing'],120,0)).toThrow('selected_note_not_found');
  expect(()=>makeMoveOperations('melody',notes,['a','a'],120,0)).toThrow('invalid_note_selection');
 });
});
