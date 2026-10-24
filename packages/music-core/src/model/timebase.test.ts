import {describe,it,expect} from 'vitest';
import {validateProject,secondsAtTick,tempoAtTick,meterAtTick,barTicksAt} from '../index.js';
import type {MusicProject} from '../index.js';
const project:MusicProject={
 projectId:'tempo-test',revision:0,ppq:480,
 tempoMap:[{tick:0,bpm:120},{tick:960,bpm:60}],
 meterMap:[{tick:0,numerator:4,denominator:4},{tick:1920,numerator:6,denominator:8}],
 tracks:[{trackId:'lead',name:'Lead',locked:false,
  instrument:{kind:'melodic',program:81,channel:0},
  notes:[{noteId:'n1',pitch:62,startTick:900,durationTicks:180,velocity:85}]}]
};
describe('S0 project musical timebase',()=>{
 it('preserves legacy projects with implicit 120 BPM and 4/4',()=>{
  const legacy:MusicProject={projectId:'old',revision:0,ppq:480,tracks:[]};
  expect(validateProject(legacy)).toBe(true);
  expect(secondsAtTick(legacy,960)).toBe(1);
  expect(meterAtTick(legacy,600).numerator).toBe(4);
  expect(barTicksAt(legacy,0)).toBe(1920);
 });
 it('integrates tempo changes exactly and picks current meter',()=>{
  expect(validateProject(project)).toBe(true);
  expect(tempoAtTick(project,959)).toBe(120);
  expect(tempoAtTick(project,960)).toBe(60);
  expect(secondsAtTick(project,960)).toBe(1);
  expect(secondsAtTick(project,1440)).toBe(2);
  expect(secondsAtTick(project,1920)).toBe(3);
  expect(barTicksAt(project,1920)).toBe(1440);
  expect(meterAtTick(project,1919).numerator).toBe(4);
  expect(meterAtTick(project,1920).numerator).toBe(6);
 });
 it('rejects corrupt timebase and percussion metadata',()=>{
  const bads:MusicProject[]=[
   {...project,tempoMap:[{tick:96,bpm:120}]},
   {...project,tempoMap:[{tick:0,bpm:120},{tick:0,bpm:80}]},
   {...project,tempoMap:[{tick:0,bpm:NaN}]},
   {...project,meterMap:[{tick:0,numerator:6,denominator:7}]},
   {...project,meterMap:[{tick:0,numerator:6,denominator:8},{tick:0,numerator:4,denominator:4}]},
   {...project,tracks:[{...project.tracks[0]!,instrument:{kind:'drums',program:0,channel:0}}]},
   {...project,tracks:[{...project.tracks[0]!,instrument:{kind:'melodic',program:0,channel:9}}]}
  ];
  for(const bad of bads)expect(validateProject(bad)).toBe(false);
 });
 it('never changes a MusicProject when reading tempo/meter',()=>{
  const before=JSON.stringify(project);
  secondsAtTick(project,980);
  meterAtTick(project,2200);
  expect(JSON.stringify(project)).toBe(before);
 });
});
