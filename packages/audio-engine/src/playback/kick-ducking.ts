import type {MusicProject} from '@ai-composer/music-core';
import type {PlaybackAutomation,PlaybackAutomationCurve} from './automation.js';
import {validatePlaybackAutomation} from './automation.js';

export interface DuckingRequest {
 readonly kickTrackId:string;
 readonly targetTrackIds:readonly string[];
 readonly depth?:number;
 readonly recoveryTicks?:number;
 readonly kickPitches?:readonly number[];
}
/** Kick-triggered volume ducking, derived ONLY from real MIDI kick events.
 * This is envelope-based audition ducking, not an audio signal sidechain compressor.
 */
export function proposeKickDucking(project:MusicProject,request:DuckingRequest):PlaybackAutomation{
 const {kickTrackId,targetTrackIds}=request;
 const depth=request.depth??0.65;
 const recovery=request.recoveryTicks??Math.max(2,Math.floor(project.ppq/2));
 const pitches=request.kickPitches??[35,36];
 if(!Number.isFinite(depth)||depth<0.1||depth>0.95||
  !Number.isSafeInteger(recovery)||recovery<2||recovery>project.ppq*4||
  !Array.isArray(pitches)||pitches.length<1||pitches.length>8||
  new Set(pitches).size!==pitches.length||
  pitches.some(p=>!Number.isInteger(p)||p<0||p>127)||
  !Array.isArray(targetTrackIds)||targetTrackIds.length<1||targetTrackIds.length>8||
  new Set(targetTrackIds).size!==targetTrackIds.length||
  targetTrackIds.includes(kickTrackId))throw Error('invalid_ducking_request');
 const kick=project.tracks.find(t=>t.trackId===kickTrackId);
 if(!kick||!(kick.isDrum===true||kick.channel===9))throw Error('kick_track_must_be_percussion');
 if(targetTrackIds.some(id=>!project.tracks.some(t=>t.trackId===id)))throw Error('ducking_target_not_found');
 const onset=[...new Set(kick.notes.filter(n=>pitches.includes(n.pitch)).map(n=>n.startTick))].sort((a,b)=>a-b);
 if(onset.length===0)throw Error('no_kick_midi_events');
 if(onset.length>20)throw Error('too_many_kick_events_for_automation');
 const curves:PlaybackAutomationCurve[]=targetTrackIds.map(trackId=>{
  const points:{tick:number;value:number}[]=[];
  if(onset[0]!>0)points.push({tick:0,value:1});
  for(let i=0;i<onset.length;i++){
   const tick=onset[i]!,next=onset[i+1];
   // Explicit duck at onset, recover before the next kick; note that an instantaneous
   // change at onset is intentional for this first bounded MIDI-triggered envelope.
   points.push({tick,value:Number((1-depth).toFixed(4))});
   const end=Math.min(tick+recovery,next===undefined?tick+recovery:next-1);
   if(end>tick)points.push({tick:end,value:1});
  }
  return {trackId,lane:'gain' as const,points};
 });
 const plan:PlaybackAutomation={version:'playback-automation-v1',curves};
 validatePlaybackAutomation(project,plan);
 return plan;
}
