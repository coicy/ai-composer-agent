import {describe,it,expect} from 'vitest';
import {proposeKickDucking} from './kick-ducking.js';
import type {MusicProject} from '@ai-composer/music-core';
const project:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[
 {trackId:'drums',name:'Drums',locked:false,isDrum:true,channel:9,notes:[
  {noteId:'k0',pitch:36,startTick:0,durationTicks:120,velocity:110},
  {noteId:'k1',pitch:36,startTick:480,durationTicks:120,velocity:110},
  {noteId:'hat',pitch:42,startTick:240,durationTicks:120,velocity:80}
 ]},
 {trackId:'bass',name:'Bass',locked:false,notes:[]}
]};
describe('MIDI-triggered audition ducking',()=>{
 it('uses actual kick onsets and recovers before each following kick',()=>{
  const plan=proposeKickDucking(project,{kickTrackId:'drums',targetTrackIds:['bass'],depth:.6,recoveryTicks:200});
  expect(plan.curves).toHaveLength(1);
  expect(plan.curves[0]?.points).toEqual([
   {tick:0,value:.4},{tick:200,value:1},{tick:480,value:.4},{tick:680,value:1}
  ]);
 });
 it('refuses to fabricate absent drum events',()=>{
  expect(()=>proposeKickDucking({...project,tracks:[{...project.tracks[0]!,notes:[]},project.tracks[1]!]},{kickTrackId:'drums',targetTrackIds:['bass']})).toThrow('no_kick_midi_events');
 });
 it('rejects non-drum sources and invalid controls',()=>{
  expect(()=>proposeKickDucking(project,{kickTrackId:'bass',targetTrackIds:['drums']})).toThrow();
  expect(()=>proposeKickDucking(project,{kickTrackId:'drums',targetTrackIds:['bass'],depth:2})).toThrow();
 });
});
