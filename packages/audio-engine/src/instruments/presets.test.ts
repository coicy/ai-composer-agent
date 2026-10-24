import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {
 SOUND_PRESETS,defaultPresetForTrack,validateSoundDesignPlan,
 suggestArrangementSoundPlan,chooseTrackPreset
} from './presets.js';
const project:MusicProject={
 projectId:'sounds',revision:0,ppq:480,
 tracks:[
  {trackId:'lead',name:'Lead',locked:false,notes:[],
   instrument:{kind:'melodic',program:81,channel:0}},
  {trackId:'bass',name:'Bass',locked:false,notes:[],
   instrument:{kind:'melodic',program:38,channel:1}},
  {trackId:'drums',name:'Drums',locked:false,notes:[],
   instrument:{kind:'drums',program:0,channel:9}},
  {trackId:'chords',name:'Chords',locked:false,notes:[],
   instrument:{kind:'melodic',program:89,channel:2}},
  {trackId:'legacy',name:'Legacy',locked:false,notes:[]}
 ]
};
describe('S3 provenance-free procedural synth and drum presets',()=>{
 it('maps MIDI GM patches and channel-9 drums to distinct sound categories',()=>{
  const byId=Object.fromEntries(project.tracks.map(t=>[t.trackId,defaultPresetForTrack(t)]));
  expect(byId).toMatchObject({
   lead:'saw_lead',bass:'synth_bass',drums:'drum_kit',chords:'synth_pad',legacy:'basic_triangle'
  });
  expect(SOUND_PRESETS.synth_bass.wave).toBe('sawtooth');
  expect(SOUND_PRESETS.synth_pad.attackSeconds).toBeGreaterThan(SOUND_PRESETS.synth_pluck.attackSeconds);
  expect(SOUND_PRESETS.drum_kit.wave).toBeNull();
 });
 it('validates transient effects and never mutates user data',()=>{
  const plan={version:'sound-design-v1',trackPresets:[
   {trackId:'bass',presetId:'synth_bass',cutoffHz:650,gainDb:-6,pan:-.2},
   {trackId:'drums',presetId:'drum_kit'}
  ]};
  const prior=JSON.stringify(project);
  expect(validateSoundDesignPlan(plan,project)).toEqual(plan);
  expect(chooseTrackPreset(project.tracks[1]!,validateSoundDesignPlan(plan,project)).cutoffHz).toBe(650);
  expect(JSON.stringify(project)).toBe(prior);
 });
 it('suggests separate electronic harmony, bass and arpeggio timbres',()=>{
  const plan=suggestArrangementSoundPlan(project,{
   harmony:'chords',bass:'bass',accompaniment:'lead'
  });
  expect(plan.trackPresets.map(x=>x.presetId)).toEqual(['synth_pad','synth_bass','synth_pluck']);
  expect(()=>suggestArrangementSoundPlan(project,{
   harmony:'absent',bass:'bass',accompaniment:'lead'
  })).toThrow('track_not_found');
 });
 it('rejects source paths, arbitrary presets and illegal drum/melody mapping',()=>{
  for(const plan of [
   {version:'sound-design-v1',trackPresets:[{trackId:'lead',presetId:'http://example.net/sample.wav'}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'bass',presetId:'drum_kit'}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'drums',presetId:'synth_bass'}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'lead',presetId:'saw_lead',gainDb:NaN}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'bass',presetId:'synth_bass',cutoffHz:20000}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'bass',presetId:'synth_bass',pan:2}]},
   {version:'sound-design-v1',trackPresets:[{trackId:'lead',presetId:'saw_lead'},{trackId:'lead',presetId:'saw_lead'}]}
  ])expect(()=>validateSoundDesignPlan(plan,project)).toThrow();
 });
});
