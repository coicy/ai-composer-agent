import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import type {MotifIdentity,DevelopmentWindow} from '../planning/motif-development.js';
export interface MotifRealizationEvidence {
 readonly state:'observed'|'not_observed'|'not_evaluable';
 readonly operation:DevelopmentWindow['operation'];
 readonly testedWindows:number;
 readonly explanation:string;
}
/** Interval contour is a conservative *partial* MIDI observation, not aesthetic proof. */
export function assessMotifRealization(motif:MotifIdentity,window:DevelopmentWindow,tracks:readonly MusicTrack[]):MotifRealizationEvidence{
 const sequences=tracks.map(t=>t.notes.filter(n=>n.startTick>=window.startTick&&n.startTick<window.endTick)
  .sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch));
 const noteCount=sequences.reduce((sum,notes)=>sum+notes.length,0);
 const contour=motif.anchorIntervals.map(x=>Math.sign(x)).join(',');
 const search=(seq:readonly MidiNote[],len:number)=>{
  for(let i=0;i<=seq.length-len;i++){
   const slice=seq.slice(i,i+len);
   const c=slice.slice(1).map((n,j)=>Math.sign(n.pitch-slice[j]!.pitch)).join(',');
   if(c===contour)return true;
  }
  return false;
 };
 if(noteCount<2||motif.anchorIntervals.length<2)return {state:'not_evaluable',operation:window.operation,testedWindows:noteCount,explanation:'Not enough comparable note material.'};
 if(window.operation==='harmonic_recontextualization'||window.operation==='texture_subtraction')
  return {state:'not_evaluable',operation:window.operation,testedWindows:noteCount,explanation:'Cannot infer functional harmonic context or meaningful texture change from this one window.'};
 if(window.preserve==='interval_contour'){
  const hit=sequences.some(notes=>search(notes,motif.anchorIntervals.length+1));
  return {state:hit?'observed':'not_observed',operation:window.operation,testedWindows:noteCount,
   explanation:hit?'Matching directed-interval contour observed; transformation quality not proven.':'Expected directed interval contour not detected.'};
 }
 return {state:'not_evaluable',operation:window.operation,testedWindows:noteCount,
  explanation:'Rhythm shape or identifiable fragment requires a cross-window comparison and human hearing.'};
}
