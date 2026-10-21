import {describe,it,expect} from 'vitest';
import type {MidiNote} from '@ai-composer/music-core';
import {rectangleBetween,selectNotesInRect,timeRangeOfSelectedNotes} from './marquee.js';
const notes:MidiNote[]=[
 {noteId:'A',pitch:72,startTick:0,durationTicks:480,velocity:90},
 {noteId:'B',pitch:60,startTick:0,durationTicks:480,velocity:90},
 {noteId:'C',pitch:72,startTick:480,durationTicks:480,velocity:90},
 {noteId:'D',pitch:75,startTick:960,durationTicks:480,velocity:90}
];
const geometry={ppq:480,pixelsPerQuarter:60,rowHeight:24,topPitch:83};
describe('marquee selection geometry',()=>{
 it('selects only notes physically intersecting a two-dimensional rectangle',()=>{
  const rect=rectangleBetween({x:65,y:275},{x:5,y:260});
  expect(selectNotesInRect(notes,rect,geometry)).toEqual(['A','C']);
  expect(timeRangeOfSelectedNotes(notes,['A','C'])).toEqual({startTick:0,endTick:960});
 });
 it('works when dragging backwards and clamps negative x',()=>{
  expect(rectangleBetween({x:80,y:40},{x:-20,y:10})).toEqual({left:0,right:80,top:10,bottom:40});
 });
 it('does not select merely adjacent pitch rows or time bounds',()=>{
  const a=rectangleBetween({x:0,y:264},{x:60,y:264+24});
  expect(selectNotesInRect(notes,a,geometry)).toEqual(['A']);
  const out=rectangleBetween({x:60,y:264},{x:120,y:288});
  expect(selectNotesInRect(notes,out,geometry)).toEqual(['C']);
 });
 it('reports stale selection and empty ranges',()=>{
  expect(timeRangeOfSelectedNotes(notes,[])).toBe(null);
  expect(()=>timeRangeOfSelectedNotes(notes,['missing'])).toThrow('selected_note_not_found');
 });
});
