import {describe,it,expect} from 'vitest';
import type {MidiNote} from '@ai-composer/music-core';
import {analyzeTonality,suggestChords} from './tonality.js';
const note=(pitch:number,startTick:number,durationTicks=480):MidiNote=>({noteId:`${pitch}-${startTick}`,pitch,startTick,durationTicks,velocity:88});
describe('bounded tonal hypotheses',()=>{
 it('reports insufficient evidence for a single note rather than inventing a key',()=>{
  const p=analyzeTonality([note(60,0)],0,1920);
  expect(p.status).toBe('insufficient');expect(p.noteCount).toBe(1);expect(p.hypotheses).toHaveLength(3);
  expect(suggestChords([note(60,0)],0,1920,480)[0]?.name).toBeNull();
 });
 it('weights overlapping note durations and respects the chosen time window',()=>{
  const notes=[note(60,0,960),note(64,960,480),note(67,1440,480),note(61,1920,480)];
  const p=analyzeTonality(notes,0,1920);
  expect(p.pitchClasses).toEqual([0,4,7]);
  expect(p.noteCount).toBe(3);
  expect(suggestChords(notes,0,1920,480)[0]?.name).toBe('C');
  expect(analyzeTonality(notes,1920,2400).pitchClasses).toEqual([1]);
 });
 it('makes no assertion of a single certain key for symmetric or sparse material',()=>{
  const notes=[60,62,64,65,67,69,71].map((p,i)=>note(p,i*240,240));
  const p=analyzeTonality(notes,0,1920);
  expect(p.hypotheses.every(h=>h.coverage<=1)).toBe(true);
  expect(p.hypotheses).toHaveLength(3);
 });
 it('returns null for empty chord windows',()=>{
  const suggestions=suggestChords([note(60,0),note(64,480)],0,3840,480);
  expect(suggestions).toHaveLength(2);
  expect(suggestions[1]?.confidence).toBe('insufficient');
 });
});
