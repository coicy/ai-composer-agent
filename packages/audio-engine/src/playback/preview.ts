import type {MusicProject} from '@ai-composer/music-core';
export interface PlaybackHandle {stop():void;}
/** A minimal Web Audio preview; one fixed BPM, no tempo map or production synth. */
export async function playProject(project:MusicProject,bpm=120):Promise<PlaybackHandle>{
 if(!Number.isFinite(bpm)||bpm<=0)throw new Error('invalid_bpm');
 const ctx=new AudioContext();
 await ctx.resume();
 const oscillators:OscillatorNode[]=[];
 const master=ctx.createGain();master.gain.value=0.3;master.connect(ctx.destination);
 const tickSeconds=60/(bpm*project.ppq);
 const start=ctx.currentTime+0.05;
 for(const track of project.tracks){
  for(const note of track.notes){
   const begin=start+note.startTick*tickSeconds;
   const end=begin+note.durationTicks*tickSeconds;
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
