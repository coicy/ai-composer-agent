import {describe,it,expect} from 'vitest';
import {Midi} from '@tonejs/midi';
import {exportMidi,importMidi} from './midi.js';
import type {MusicProject} from '@ai-composer/music-core';
const source:MusicProject={
 projectId:'s0-roundtrip',revision:1,ppq:480,
 tempoMap:[{tick:0,bpm:126},{tick:1920,bpm:132}],
 meterMap:[{tick:0,numerator:4,denominator:4},{tick:3840,numerator:6,denominator:8}],
 tracks:[
  {trackId:'lead',name:'Saw Lead',locked:false,
   instrument:{kind:'melodic',program:81,channel:0},
   notes:[{noteId:'a',pitch:69,startTick:0,durationTicks:480,velocity:90},
    {noteId:'b',pitch:71,startTick:2400,durationTicks:960,velocity:88}]},
  {trackId:'drums',name:'Drum Kit',locked:false,
   instrument:{kind:'drums',program:0,channel:9},
   notes:[{noteId:'kick',pitch:36,startTick:0,durationTicks:120,velocity:100},
    {noteId:'snare',pitch:38,startTick:480,durationTicks:120,velocity:95}]}
 ]
};
describe('S0 MIDI exchange of music timebase and instruments',()=>{
 it('writes actual tempo/meter events and GM drum channel',()=>{
  const binary=exportMidi(source);
  const raw=new Midi(binary);
  expect(raw.header.tempos.map(x=>[x.ticks,Math.round(x.bpm)])).toEqual([[0,126],[1920,132]]);
  expect(raw.header.timeSignatures.map(x=>[x.ticks,...x.timeSignature])).toEqual([
   [0,4,4],[3840,6,8]
  ]);
  const lead=raw.tracks.find(t=>t.name==='Saw Lead');
  const drums=raw.tracks.find(t=>t.name==='Drum Kit');
  expect(lead?.channel).toBe(0);
  expect(lead?.instrument.number).toBe(81);
  expect(drums?.channel).toBe(9);
  expect(drums?.notes.map(n=>n.midi)).toEqual([36,38]);
 });
 it('imports authored tempo and meter changes without retaining editing privileges',()=>{
  const project=importMidi(exportMidi(source));
  expect(project.ppq).toBe(480);
  expect(project.tempoMap?.map(x=>[x.tick,Math.round(x.bpm)])).toEqual([[0,126],[1920,132]]);
  expect(project.meterMap).toEqual(source.meterMap);
  expect(project.tracks.map(t=>[t.name,t.instrument?.channel,t.instrument?.program,t.instrument?.kind])).toEqual([
   ['Saw Lead',0,81,'melodic'],['Drum Kit',9,0,'drums']
  ]);
  expect(project.tracks.every(t=>!t.locked)).toBe(true);
  expect(project.tracks[0]?.notes.map(n=>[n.pitch,n.startTick,n.durationTicks])).toEqual([
   [69,0,480],[71,2400,960]
  ]);
  expect(project.revision).toBe(0);
 });
 it('keeps old projects importable with default timeline',()=>{
  const old:MusicProject={projectId:'legacy',revision:0,ppq:480,
   tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[
    {noteId:'m1',pitch:60,startTick:0,durationTicks:240,velocity:70}
   ]}]};
  const imported=importMidi(exportMidi(old));
  expect(imported.tempoMap?.[0]?.bpm).toBe(120);
  expect(imported.meterMap?.[0]).toMatchObject({numerator:4,denominator:4});
  expect(imported.tracks[0]?.notes[0]?.pitch).toBe(60);
  expect(imported.tracks[0]?.instrument?.channel).not.toBe(9);
 });
 it('does not silently encode locks, approvals or FX data as MIDI',()=>{
  const locked={...source,tracks:source.tracks.map(t=>({...t,locked:true}))};
  const data=importMidi(exportMidi(locked));
  expect(data.tracks.every(t=>!t.locked)).toBe(true);
  expect(data.projectId).not.toBe(source.projectId);
 });
});
