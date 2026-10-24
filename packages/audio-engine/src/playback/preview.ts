import type {MusicProject} from '@ai-composer/music-core';
import {secondsAtTick,validateProject} from '@ai-composer/music-core';
import {
 chooseTrackPreset,SOUND_PRESETS,validateSoundDesignPlan
} from '../instruments/presets.js';
import type {SoundDesignPlan,PresetSpec} from '../instruments/presets.js';
export interface PlaybackHandle{stop():void;}

const midiHz=(midi:number)=>440*Math.pow(2,(midi-69)/12);
const toGain=(db:number)=>Math.pow(10,db/20);
function makeNoise(ctx:AudioContext):AudioBuffer{
 const length=Math.ceil(ctx.sampleRate*.45);
 const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
 const channel=buffer.getChannelData(0);
 let state=0x5a17d0e3;
 for(let i=0;i<channel.length;i++){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  channel[i]=(state/2147483648)-1;
 }
 return buffer;
}
function envelope(gain:AudioParam,begin:number,end:number,preset:PresetSpec,peak:number):number{
 const attack=Math.min(preset.attackSeconds,Math.max(.001,(end-begin)*.4));
 const release=preset.releaseSeconds;
 const a=begin+attack;
 const d=Math.min(end,a+preset.decaySeconds);
 gain.setValueAtTime(0,begin);
 gain.linearRampToValueAtTime(peak,a);
 if(d>a)gain.linearRampToValueAtTime(Math.max(.0001,peak*preset.sustain),d);
 if(end>d)gain.setValueAtTime(Math.max(.0001,peak*preset.sustain),end);
 gain.linearRampToValueAtTime(0,end+release);
 return end+release;
}
function melodicNote(ctx:AudioContext,output:AudioNode,preset:PresetSpec,
 pitch:number,velocity:number,begin:number,end:number):OscillatorNode{
 const osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=preset.wave??'triangle';
 osc.frequency.setValueAtTime(midiHz(pitch),begin);
 const stop=envelope(gain.gain,begin,end,preset,preset.gain*velocity/127);
 osc.connect(gain);gain.connect(output);
 osc.start(begin);osc.stop(stop+.02);
 return osc;
}
function drumNote(ctx:AudioContext,output:AudioNode,noise:AudioBuffer,
 pitch:number,velocity:number,begin:number):AudioScheduledSourceNode{
 const peak=Math.max(.0001,Math.min(.8,velocity/127*.27));
 if(pitch===35||pitch===36){
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';
  osc.frequency.setValueAtTime(150,begin);
  osc.frequency.exponentialRampToValueAtTime(48,begin+.12);
  gain.gain.setValueAtTime(peak,begin);
  gain.gain.exponentialRampToValueAtTime(.0001,begin+.23);
  osc.connect(gain);gain.connect(output);
  osc.start(begin);osc.stop(begin+.25);
  return osc;
 }
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 source.buffer=noise;
 const hiHat=pitch===42||pitch===44||pitch===46;
 const snare=pitch===38||pitch===40;
 filter.type=hiHat?'highpass':snare?'bandpass':'highpass';
 filter.frequency.value=hiHat?6500:snare?1700:1000;
 const duration=hiHat?(pitch===46?.25:.065):snare?.15:.11;
 gain.gain.setValueAtTime(peak*(hiHat?.45:1),begin);
 gain.gain.exponentialRampToValueAtTime(.0001,begin+duration);
 source.connect(filter);filter.connect(gain);gain.connect(output);
 source.start(begin,0,duration);
 source.stop(begin+duration+.005);
 return source;
}
/**
 * Browser-only, all procedural: no third-party drum samples, plugins or
 * SoundFont redistributed. SoundPlan is ephemeral and never mutates MusicProject.
 * BPM override is retained for existing consumers; omit to use project tempoMap.
 */
export async function playProject(project:MusicProject,bpm?:number,soundPlan?:SoundDesignPlan):Promise<PlaybackHandle>{
 if(!validateProject(project))throw Error('invalid_project');
 if(bpm!==undefined&&(!Number.isFinite(bpm)||bpm<=0))throw Error('invalid_bpm');
 const plan=soundPlan===undefined?undefined:validateSoundDesignPlan(soundPlan,project);
 const ctx=new AudioContext();
 await ctx.resume();
 const master=ctx.createGain();master.gain.value=.45;master.connect(ctx.destination);
 const sources:AudioScheduledSourceNode[]=[];
 const seconds=(tick:number)=>bpm===undefined?secondsAtTick(project,tick):tick*60/(bpm*project.ppq);
 const origin=ctx.currentTime+.06;
 let noise:AudioBuffer|null=null;
 for(const track of project.tracks){
  const choice=chooseTrackPreset(track,plan),preset=SOUND_PRESETS[choice.presetId];
  const bus=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner();
  bus.gain.value=toGain(choice.gainDb??0);
  filter.type='lowpass';filter.frequency.value=choice.cutoffHz??preset.cutoffHz;filter.Q.value=.7;
  pan.pan.value=choice.pan??0;
  bus.connect(filter);filter.connect(pan);pan.connect(master);
  for(const note of track.notes){
   const begin=origin+seconds(note.startTick);
   const end=origin+seconds(note.startTick+note.durationTicks);
   if(preset.kind==='drums'){
    noise??=makeNoise(ctx);
    sources.push(drumNote(ctx,bus,noise,note.pitch,note.velocity,begin));
   }else{
    sources.push(melodicNote(ctx,bus,preset,note.pitch,note.velocity,begin,end));
   }
  }
 }
 let stopped=false;
 return {stop(){
  if(stopped)return;stopped=true;
  for(const source of sources){try{source.stop();}catch{/* Source already stopped. */}}
  void ctx.close();
 }};
}
