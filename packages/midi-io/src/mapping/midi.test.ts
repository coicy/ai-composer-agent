import {describe,it,expect} from 'vitest';
import {Midi} from '@tonejs/midi';
import {importMidi,exportMidi} from './midi.js';
import type {MusicProject} from '@ai-composer/music-core';
const source:MusicProject={
 projectId:'test',revision:0,ppq:480,tempoBpm:126,meter:{numerator:6,denominator:8},
 tracks:[
  {trackId:'bass',name:'Bass',locked:false,program:38,channel:0,isDrum:false,
   notes:[{noteId:'n1',pitch:38,startTick:0,durationTicks:360,velocity:101}]},
  {trackId:'kick',name:'Drums',locked:false,program:0,channel:9,isDrum:true,
   notes:[{noteId:'n2',pitch:36,startTick:480,durationTicks:120,velocity:112}]}
 ]
};
describe('MIDI constant timebase / program / drum roundtrip',()=>{
 it('exports 126 BPM, 6/8, Bass patch and MIDI channel 10 drums',()=>{
  const raw=exportMidi(source);
  const midi=new Midi(raw);
  expect(midi.header.tempos[0]?.bpm).toBeCloseTo(126,1);
  expect(midi.header.timeSignatures[0]?.timeSignature).toEqual([6,8]);
  expect(midi.tracks).toHaveLength(2);
  expect(midi.tracks[0]).toMatchObject({name:'Bass',channel:0});
  expect(midi.tracks[0]?.instrument.number).toBe(38);
  expect(midi.tracks[1]?.channel).toBe(9);
  expect(midi.tracks[1]?.notes[0]?.midi).toBe(36);
  const returned=importMidi(raw);
  expect(returned.tempoBpm).toBeCloseTo(126,1);
  expect(returned.meter).toEqual({numerator:6,denominator:8});
  expect(returned.tracks[0]).toMatchObject({name:'Bass',program:38,channel:0,isDrum:false});
  expect(returned.tracks[1]).toMatchObject({name:'Drums',channel:9,isDrum:true});
  expect(returned.tracks[1]?.notes[0]).toMatchObject({pitch:36,startTick:480,durationTicks:120});
 });
 it('keeps old project files working with 120 BPM, 4/4',()=>{
  const legacy:MusicProject={projectId:'old',revision:0,ppq:480,tracks:[{trackId:'one',name:'Old',locked:false,
   notes:[{noteId:'a',pitch:60,startTick:0,durationTicks:480,velocity:85}]}]};
  const imported=importMidi(exportMidi(legacy));
  expect(imported.tempoBpm).toBeCloseTo(120,1);
  expect(imported.meter).toEqual({numerator:4,denominator:4});
 });
 it('explicitly rejects tempo or meter map changes before they can be silently lost',()=>{
  const changeTempo=new Midi(exportMidi(source));
  changeTempo.header.tempos.push({ticks:480,bpm:140});
  changeTempo.header.update();
  expect(()=>importMidi(changeTempo.toArray())).toThrow('unsupported_tempo_changes');
  const changeMeter=new Midi(exportMidi(source));
  changeMeter.header.timeSignatures.push({ticks:480,timeSignature:[4,4]});
  changeMeter.header.update();
  expect(()=>importMidi(changeMeter.toArray())).toThrow('unsupported_meter_changes');
 });
 it('rejects conflicting programs on a reused channel',()=>{
  const conflicted:MusicProject={...source,tracks:[
   {...source.tracks[0]!,channel:0,program:38},
   {...source.tracks[0]!,trackId:'second',channel:0,program:81}
  ]};
  expect(()=>exportMidi(conflicted)).toThrow('midi_channel_program_conflict');
 });
});