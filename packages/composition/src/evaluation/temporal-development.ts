import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import type {DevelopmentOperation,MotifDevelopmentPlan,MotifIdentity} from '../planning/motif-development.js';
import {validateMotifDevelopmentPlan} from '../planning/motif-development.js';

export type EvidenceState='observed'|'not_observed'|'not_evaluable';
export interface TemporalWindowEvidence {
 readonly startTick:number;
 readonly endTick:number;
 readonly operation:DevelopmentOperation;
 readonly state:EvidenceState;
 readonly reason:string;
 readonly melodyNotes:number;
 readonly notesPerBar:number;
 readonly registerMean:number|null;
}
export interface TemporalDevelopmentEvidence {
 readonly version:'temporal-development-v1';
 readonly windows:readonly TemporalWindowEvidence[];
 readonly observed:number;
 readonly notObserved:number;
 readonly notEvaluable:number;
 readonly consecutiveDensityChanges:number;
 readonly disclaimer:string;
}
const EPS=0.2;
function sorted(notes:readonly MidiNote[],start:number,end:number):MidiNote[]{
 return notes.filter(n=>n.startTick>=start&&n.startTick<end)
  .sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
}
function exactIntervals(notes:readonly MidiNote[],intervals:readonly number[]):MidiNote[][]{
 const len=intervals.length+1,found:MidiNote[][]=[];
 for(let i=0;i+len<=notes.length;i++){
  const slice=notes.slice(i,i+len);
  if(slice.every((n,j)=>j===0||n.pitch-slice[j-1]!.pitch===intervals[j-1]))found.push(slice);
 }
 return found;
}
function sourceNotes(motif:MotifIdentity,source:MusicTrack):MidiNote[]|null{
 const byId=new Map(source.notes.map(n=>[n.noteId,n]));
 const notes=motif.noteIds.map(id=>byId.get(id));
 if(notes.some(x=>!x))return null;
 return [...notes as MidiNote[]].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
}
function meanPitch(notes:readonly MidiNote[]):number|null{
 return notes.length?notes.reduce((s,n)=>s+n.pitch,0)/notes.length:null;
}
function sameRhythm(a:readonly MidiNote[],b:readonly MidiNote[]):boolean{
 return a.length===b.length&&a.every((n,i)=>Math.abs(n.durationTicks/b[i]!.durationTicks-1)<=EPS);
}
function baselineBass(track:MusicTrack|undefined,w:{startTick:number;endTick:number}):number|null{
 const n=track&&sorted(track.notes,w.startTick,w.endTick)[0];
 return n?n.pitch%12:null;
}
/**
 * Order-sensitive, plan-conditioned observations only. No absolute musicality
 * scores or inference that a detected operation was aesthetically successful.
 */
export function assessTemporalDevelopment(
 plan:MotifDevelopmentPlan,tracks:readonly MusicTrack[],
 options:{sourceTrackId:string;bassTrackId?:string}
):TemporalDevelopmentEvidence{
 validateMotifDevelopmentPlan(plan);
 const source=tracks.find(t=>t.trackId===options.sourceTrackId);
 if(!source)throw Error('temporal_source_track_missing');
 const bass=options.bassTrackId?tracks.find(t=>t.trackId===options.bassTrackId):undefined;
 if(options.bassTrackId&&!bass)throw Error('temporal_bass_track_missing');
 const first=plan.windows[0]!;
 const baseBass=baselineBass(bass,first);
 const result:TemporalWindowEvidence[]=plan.windows.map(w=>{
  const motif=plan.motifs.find(m=>m.id===w.motifId)!;
  const original=sourceNotes(motif,source);
  const phrases=sorted(source.notes,w.startTick,w.endTick);
  const matches=exactIntervals(phrases,motif.anchorIntervals);
  const originalMean=original?meanPitch(original):null;
  const mean=meanPitch(phrases);
  const density=phrases.length/((w.endTick-w.startTick)/(plan.ppq*4));
  const evidence=(state:EvidenceState,reason:string):TemporalWindowEvidence=>({
   startTick:w.startTick,endTick:w.endTick,operation:w.operation,state,reason,
   melodyNotes:phrases.length,notesPerBar:Number(density.toFixed(4)),registerMean:mean
  });
  if(!original||originalMean===null)return evidence('not_evaluable','Reference motif source notes unavailable.');
  if(!phrases.length)return evidence('not_observed','No melody in planned time window.');
  if(w.operation==='introduce'||w.operation==='thematic_return'){
   const hit=matches.some(seq=>seq.every((n,i)=>n.pitch===original[i]!.pitch)&&sameRhythm(seq,original));
   return evidence(hit?'observed':'not_observed',
    hit?'Original pitch intervals, absolute register and durations recur.':'Original motif identity not observed at expected position.');
  }
  if(w.operation==='rhythmic_augmentation'||w.operation==='rhythmic_diminution'){
   const grow=w.operation==='rhythmic_augmentation';
   const hit=matches.some(seq=>seq.every((n,i)=>{
    const ratio=n.durationTicks/original[i]!.durationTicks;
    return grow?ratio>=1.5:ratio<=0.67;
   }));
   return evidence(hit?'observed':'not_observed',
    hit?'Preserved directed intervals with duration scaling.':'Expected interval-preserving duration scaling absent.');
  }
  if(w.operation==='fragmentation'){
   const partial=motif.anchorIntervals.some(interval=>phrases.some((n,i)=>
    i>0&&n.pitch-phrases[i-1]!.pitch===interval));
   const hit=partial&&matches.length===0;
   return evidence(hit?'observed':'not_observed',
    hit?'A partial interval fragment without the entire motif is present.':'No exclusive interval fragment was found.');
  }
  if(w.operation==='register_transfer'){
   const hit=matches.some(seq=>Math.abs((meanPitch(seq)??originalMean)-originalMean)>=7);
   return evidence(hit?'observed':'not_observed',
    hit?'Interval-identical motif appears in a displaced register.':'Expected register displacement is absent.');
  }
  if(w.operation==='harmonic_recontextualization'){
   const current=baselineBass(bass,w);
   if(baseBass===null||current===null)return evidence('not_evaluable','Bass evidence required to compare harmonic context.');
   const hit=matches.length>0&&current!==baseBass;
   return evidence(hit?'observed':'not_observed',
    hit?'Motif recurs against a different bass pitch class; harmonic function remains unverified.':'No motif plus changed bass pitch class was observed.');
  }
  return evidence('not_evaluable','Operation requires orchestration- or rhythm-specific cross-window analysis.');
 });
 const changes=result.slice(1).reduce((acc,w,i)=>acc+(Math.abs(w.notesPerBar-result[i]!.notesPerBar)>0.01?1:0),0);
 return {
  version:'temporal-development-v1',windows:result,
  observed:result.filter(w=>w.state==='observed').length,
  notObserved:result.filter(w=>w.state==='not_observed').length,
  notEvaluable:result.filter(w=>w.state==='not_evaluable').length,
  consecutiveDensityChanges:changes,
  disclaimer:'Evidence is plan-conditioned and order-sensitive, not a quality score. Motif fragments may be accidental; changed bass pitch class does not prove functional reharmonization. Human listening remains necessary.'
 };
}
