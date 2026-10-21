import {describe,it,expect} from 'vitest';
import {tickToX,xToQuantizedTick,pitchToY,yToPitch} from './coordinates.js';
const v={ppq:480,pixelsPerQuarter:60,rowHeight:24,topPitch:127};
describe('piano roll viewport coordinates',()=>{
 it('round-trips pitches across the full MIDI range',()=>{
  for(let p=0;p<=127;p++)expect(yToPitch(pitchToY(p,v)+12,v)).toBe(p);
 });
 it('presents the same tick at different zoom, without changing project data',()=>{
  expect(tickToX(960,v)).toBe(120);
  expect(tickToX(960,{...v,pixelsPerQuarter:120})).toBe(240);
  expect(xToQuantizedTick(124,v)).toBe(960);
 });
 it('quantizes input and clamps negative time and out-of-bounds pitch',()=>{
  expect(xToQuantizedTick(-100,v)).toBe(0);
  expect(xToQuantizedTick(46,v)).toBe(360);
  expect(yToPitch(-100,v)).toBe(127);
  expect(yToPitch(4000,v)).toBe(0);
 });
});
