import type {MusicProject} from '@ai-composer/music-core';
import {secondsAtTick,validateProject} from '@ai-composer/music-core';
export interface PlaybackHandle {stop():void;}
/** Minimal Web Audio preview. Uses the authoritative project tempo map by default. */
export async function playProject(project:MusicProject,bpm?:number):Promise<PlaybackHandle>{
 if(!validateProject(project))throw new Error('invalid_project');
 if(bpm!==undefined&&(!Number.isFinite(bpm)||bpm<=0))throw new Error('invalid_bpm');
 const ctx=new AudioContext();
 await ctx.resume();
 const oscillators:OscillatorNode[]=[];
 const master=ctx.createGain();master.gain.value=0.3;master.connect(ctx.destination);
 const seconds=(tick:number)=>bpm===undefined?secondsAtTick(project,tick):tick*60/(bpm*project.ppq);
 const start=ctx.currentTime+0.05;
 for(const track of project.tracks){
  for(const note of track.notes){
   const begin=start+seconds(note.startTick);
   const end=start+seconds(note.startTick+note.durationTicks);
   const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='triangle';osc.frequency.value=440*Math.pow(2,(note.pitch-69)/12);
   gain.gain.setValueAtTime(0,begin);
   gain.gain.linearRampToValueAtTime(Math.max(.001,note.velocity/127*.13),begin+.008);
   gain.gain.setValueAtTime(Math.max(.001,note.velocity/127*.13),Math.max(begin+.008,end-.015));
   gain.gain.linearRampToValueAtTime(0,end);
   osc.connect(gain);gain.connect(master);osc.start(begin);osc.stop(end+.01);oscillators.push(osc);
  }
 }
 let stopped=false;
 return {stop(){if(stopped)return;stopped=true;for(const osc of oscillators){try{osc.stop();}catch{}}void ctx.close();}};
}
