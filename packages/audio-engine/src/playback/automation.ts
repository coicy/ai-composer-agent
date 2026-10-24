import type {MusicProject} from '@ai-composer/music-core';
/** Explicit track bindings prevent a descriptive role from targeting a wrong MIDI track. */
export type AutomationLane='gain'|'filter_hz';
export interface PlaybackAutomationCurve{
 readonly trackId:string;readonly lane:AutomationLane;
 readonly points:readonly {readonly tick:number;readonly value:number}[];
}
export interface PlaybackAutomation {readonly version:'playback-automation-v1';readonly curves:readonly PlaybackAutomationCurve[];}
export function validatePlaybackAutomation(project:MusicProject,plan:PlaybackAutomation):void{
 if(!plan||plan.version!=='playback-automation-v1'||!Array.isArray(plan.curves)||plan.curves.length>project.tracks.length*2)
  throw Error('invalid_playback_automation');
 const ids=new Set(project.tracks.map(t=>t.trackId)),seen=new Set<string>();
 for(const curve of plan.curves){
  if(!curve||!ids.has(curve.trackId)||!['gain','filter_hz'].includes(curve.lane)||
   seen.has(curve.trackId+'/'+curve.lane)||!Array.isArray(curve.points)||curve.points.length<2||curve.points.length>64)
   throw Error('invalid_playback_automation');
  seen.add(curve.trackId+'/'+curve.lane);
  let last=-1;
  for(const p of curve.points){
   if(!p||!Number.isSafeInteger(p.tick)||p.tick<0||p.tick<=last||!Number.isFinite(p.value)||
    (curve.lane==='gain'?(p.value<0||p.value>1):(p.value<100||p.value>16000)))
    throw Error('invalid_playback_automation');
   last=p.tick;
  }
 }
}
export function scheduleAutomation(
 plan:PlaybackAutomation,project:MusicProject,start:number,tickSeconds:number,
 nodes:ReadonlyMap<string,{gain:AudioParam;filter:AudioParam}>
):void{
 validatePlaybackAutomation(project,plan);
 for(const curve of plan.curves){
  const target=nodes.get(curve.trackId);
  if(!target)throw Error('missing_automation_track');
  const param=curve.lane==='gain'?target.gain:target.filter;
  for(const [i,p] of curve.points.entries()){
   const time=start+p.tick*tickSeconds;
   if(i===0)param.setValueAtTime(p.value,time);
   else param.linearRampToValueAtTime(p.value,time);
  }
 }
}
