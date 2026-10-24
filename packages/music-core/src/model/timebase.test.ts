import {describe,it,expect} from 'vitest';
import {ticksPerBar,resolveTempoBpm,resolveMeter,tickToSeconds,validateProject,applyChangeSet} from '../index.js';
import type {MusicProject} from '../index.js';
const base:MusicProject={projectId:'timebase',revision:0,ppq:480,tracks:[{trackId:'lead',name:'Lead',locked:false,notes:[]}]};
describe('backward-compatible music timebase and MIDI track semantics',()=>{
 it('resolves explicit 6/8 tempo and respects legacy 120/4/4',()=>{
  expect(resolveTempoBpm(base)).toBe(120);
  expect(resolveMeter(base)).toEqual({numerator:4,denominator:4});
  const compound={...base,tempoBpm:126,meter:{numerator:6,denominator:8 as const}};
  expect(validateProject(compound)).toBe(true);
  expect(ticksPerBar(compound.ppq,compound.meter)).toBe(1440);
  expect(tickToSeconds(960,480,120)).toBe(1);
  expect(tickToSeconds(960,480,240)).toBe(.5);
  expect(ticksPerBar(480,{numerator:7,denominator:8})).toBe(1680);
 });
 it('rejects malformed or unsafe timebase/instrument metadata',()=>{
  for(const invalid of [
   {...base,tempoBpm:0},{...base,tempoBpm:NaN},{...base,tempoBpm:301},
   {...base,meter:{numerator:0,denominator:4}},
   {...base,meter:{numerator:6,denominator:3}},
   {...base,tracks:[{...base.tracks[0],program:128}]},
   {...base,tracks:[{...base.tracks[0],channel:16}]},
   {...base,tracks:[{...base.tracks[0],channel:9,isDrum:false}]}
  ])expect(validateProject(invalid as MusicProject)).toBe(false);
  expect(()=>ticksPerBar(1,{numerator:3,denominator:16})).toThrow('unsupported_meter_ppq');
 });
 it('preserves extended project fields when committing note commands',()=>{
  const p:MusicProject={...base,tempoBpm:127,meter:{numerator:3,denominator:4},
   tracks:[{...base.tracks[0]!,program:81,channel:1,isDrum:false}]};
  const result=applyChangeSet(p,{baseRevision:0,operations:[{
   type:'add_note',trackId:'lead',note:{noteId:'x',pitch:60,startTick:0,durationTicks:240,velocity:80}
  }]});
  expect(result.ok).toBe(true);
  if(result.ok){
   expect(result.project.tempoBpm).toBe(127);
   expect(result.project.meter).toEqual({numerator:3,denominator:4});
   expect(result.project.tracks[0]).toMatchObject({program:81,channel:1,isDrum:false});
  }
 });
});