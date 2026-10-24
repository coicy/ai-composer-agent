import type {MidiNote,MusicProject} from '@ai-composer/music-core';
import {resolveTempoBpm,validateProject} from '@ai-composer/music-core';
import {createProductionPlan,validateProductionPlan} from '../planning/production.js';
import type {PresetId,TrackSound,ProductionPlan} from '../planning/production.js';
import {scheduleAutomation,validatePlaybackAutomation} from './automation.js';
import type {PlaybackAutomation} from './automation.js';

export interface PlaybackHandle {stop():void;}
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const gainFromDb=(db:number)=>Math.pow(10,db/20);
function noiseBuffer(ctx:AudioContext):AudioBuffer{
 const n=Math.floor(ctx.sampleRate*.35),buffer=ctx.createBuffer(1,n,ctx.sampleRate);
 const channel=buffer.getChannelData(0);
 let seed=0x4c475043;
 for(let i=0;i<n;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  channel[i]=seed/2147483648-1;
 }
 return buffer;
}
function scheduleDrum(
 ctx:AudioContext,noise:AudioBuffer,note:MidiNote,begin:number,
 out:AudioNode,sources:AudioScheduledSourceNode[],config:TrackSound
):void{
 const isKick=note.pitch===35||note.pitch===36;
 if(isKick){
  const oscillator=ctx.createOscillator(),amp=ctx.createGain();
  const peak=gainFromDb(config.gainDb)*note.velocity/127*.8;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(135,begin);
  oscillator.frequency.exponentialRampToValueAtTime(49,begin+.09);
  amp.gain.setValueAtTime(0,begin);
  amp.gain.linearRampToValueAtTime(peak,begin+.007);
  amp.gain.exponentialRampToValueAtTime(.0001,begin+.27);
  oscillator.connect(amp);amp.connect(out);oscillator.start(begin);oscillator.stop(begin+.3);
  sources.push(oscillator);
  return;
 }
 const hat=[42,44,46].includes(note.pitch);
 const sample=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=ctx.createGain();
 sample.buffer=noise;filter.type='highpass';filter.frequency.value=hat?6800:1050;
 const peak=gainFromDb(config.gainDb)*note.velocity/127*(hat ? 0.27 : 0.50);
 const len=hat ? (note.pitch===46 ? 0.27 : 0.09) : 0.20;
 amp.gain.setValueAtTime(.00001,begin);
 amp.gain.linearRampToValueAtTime(Math.max(.0002,peak),begin+.004);
 amp.gain.exponentialRampToValueAtTime(.00001,begin+len);
 sample.connect(filter);filter.connect(amp);amp.connect(out);
 sample.start(begin);sample.stop(begin+len);
 sources.push(sample);
}
function scheduleSynth(
 ctx:AudioContext,note:MidiNote,preset:PresetId,config:TrackSound,
 begin:number,end:number,out:AudioNode,sources:AudioScheduledSourceNode[]
):void{
 const osc=ctx.createOscillator(),amp=ctx.createGain(),filter=ctx.createBiquadFilter();
 osc.type=preset==='synth_bass'?'sawtooth':
  preset==='synth_pad'?'sawtooth':
  preset==='synth_pluck'?'square':
  preset==='synth_lead'?'sawtooth':'triangle';
 osc.frequency.value=440*Math.pow(2,(note.pitch-69)/12);
 filter.type='lowpass';filter.frequency.value=config.cutoffHz;filter.Q.value=.7;
 const duration=end-begin;
 const attack=Math.min(duration/3,Math.max(.0001,config.attackMs/1000));
 const release=Math.min(duration/3,Math.max(.0001,config.releaseMs/1000));
 const peak=Math.max(.0001,gainFromDb(config.gainDb)*note.velocity/127*.34);
 amp.gain.setValueAtTime(0,begin);
 amp.gain.linearRampToValueAtTime(peak,begin+attack);
 amp.gain.setValueAtTime(peak,Math.max(begin+attack,end-release));
 amp.gain.linearRampToValueAtTime(0,end);
 osc.connect(filter);filter.connect(amp);amp.connect(out);
 osc.start(begin);osc.stop(end+.02);sources.push(osc);
}
/**
 * A lightweight, deterministic Web Audio preview, not a mastering engine.
 * Programs 38/80/81/88..95 and percussion channel 10 gain differentiated timbres.
 * Legacy projects without programs retain their prior simple triangle waveform.
 * All nodes are disposed on stop. No remote samples, external fonts or music models.
 */
export async function playProject(
 project:MusicProject,bpm=resolveTempoBpm(project),production?:ProductionPlan,automation?:PlaybackAutomation
):Promise<PlaybackHandle>{
 if(!validateProject(project))throw new Error('invalid_project');
 if(!Number.isFinite(bpm)||bpm<20||bpm>300)throw new Error('invalid_bpm');
 const plan=production??createProductionPlan(project);
 validateProductionPlan(project,plan);
 if(automation)validatePlaybackAutomation(project,automation);
 const ctx=new AudioContext();
 const sources:AudioScheduledSourceNode[]=[];
 try{
  await ctx.resume();
  const master=ctx.createGain();master.gain.value=.40;master.connect(ctx.destination);
  const tickSeconds=60/(bpm*project.ppq),start=ctx.currentTime+.05;
  const sounds=new Map(plan.tracks.map(p=>[p.trackId,p]));
  let noise:AudioBuffer|undefined;
  const automationNodes=new Map<string,{gain:AudioParam;filter:AudioParam}>();
  for(const track of project.tracks){
   const sound=sounds.get(track.trackId);
   if(!sound)throw Error('invalid_production_plan');
   if(sound.presetId==='drum_machine')noise??=noiseBuffer(ctx);
   const trackGain=ctx.createGain(),trackFilter=ctx.createBiquadFilter();
   trackGain.gain.value=1;trackFilter.type='lowpass';trackFilter.frequency.value=16000;
   trackFilter.connect(trackGain);trackGain.connect(master);
   automationNodes.set(track.trackId,{gain:trackGain.gain,filter:trackFilter.frequency});
   for(const note of track.notes){
    const begin=start+note.startTick*tickSeconds;
    const end=begin+note.durationTicks*tickSeconds;
    if(sound.presetId==='drum_machine')
     scheduleDrum(ctx,noise!,note,begin,trackFilter,sources,sound);
    else scheduleSynth(ctx,note,sound.presetId,sound,begin,end,trackFilter,sources,sound);
   }
  }
  if(automation)scheduleAutomation(automation,project,start,tickSeconds,automationNodes);
 }catch(error){
  for(const source of sources){try{source.stop();}catch{/* already stopped */}}
  void ctx.close();
  throw error;
 }
 let stopped=false;
 return {stop(){
  if(stopped)return;stopped=true;
  for(const source of sources){try{source.stop();}catch{/* already stopped */}}
  void ctx.close();
 }};
}