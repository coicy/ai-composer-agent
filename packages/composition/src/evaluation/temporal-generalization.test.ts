import {describe,expect,it} from 'vitest';
import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import {buildRuinsDevelopmentPlan,extractMotifIdentity} from '../planning/motif-development.js';
import {assessTemporalDevelopment} from './temporal-development.js';

// Hold-out synthetic motifs not used by the fixed A–E example. These are
// intervention checks, NOT evidence of performance on real compositions.
const PPQ=480, SECTION=PPQ*16;
type Pattern={root:number;intervals:readonly [number,number];offsets:readonly number[];lengths:readonly number[]};
const intervalSets:[number,number][]=[[2,-1],[-2,5],[3,-4],[1,3],[5,-2]];
function pattern(k:number):Pattern{
 const root=54+(k%8)*3;
 const intervals=intervalSets[Math.floor(k/8)%intervalSets.length]!;
 const alternative=Math.floor(k/5)%2===1;
 return {root,intervals,
  offsets:alternative?[0,360,1140]:[0,480,960],
  lengths:alternative?[180,300,240]:[240,240,240]};
}
function makeTracks(p:Pattern,kind:'correct'|'loop'|'scrambled'|'near_miss'):MusicTrack[]{
 const base=[p.root,p.root+p.intervals[0],p.root+p.intervals[0]+p.intervals[1]];
 const profiles=[
  {pitches:base,scale:1,bass:36},
  {pitches:base,scale:2,bass:36},
  {pitches:base.slice(0,2),scale:1,bass:36},
  {pitches:base,scale:1,bass:41},
  {pitches:base.map(x=>x+(kind==='near_miss'?5:12)),scale:1,bass:36},
  {pitches:base,scale:1,bass:36}
 ];
 const order=kind==='scrambled'?[0,4,2,5,1,3]:[0,1,2,3,4,5];
 const notes:MidiNote[]=[],bass:MidiNote[]=[];
 for(let section=0;section<6;section++){
  const x=kind==='loop'?profiles[0]!:profiles[order[section]!]!;
  x.pitches.forEach((pitch,i)=>{
   notes.push({noteId:`motif-${section}-${i}`,pitch,
    startTick:section*SECTION+p.offsets[i]!,
    durationTicks:p.lengths[i]!*x.scale,velocity:78});
  });
  bass.push({noteId:`bass-${section}`,pitch:x.bass,
   startTick:section*SECTION,durationTicks:PPQ*2,velocity:65});
 }
 return [
  {trackId:'lead',name:'Lead',locked:false,notes},
  {trackId:'bass',name:'Bass',locked:false,notes:bass}
 ];
}
function evaluate(k:number,kind:'correct'|'loop'|'scrambled'|'near_miss',bass=true){
 const tracks=makeTracks(pattern(k),kind);
 const source=tracks[0]!;
 const motif=extractMotifIdentity('motif','lead',source.notes.slice(0,3));
 return assessTemporalDevelopment(buildRuinsDevelopmentPlan(motif,PPQ),
    bass?tracks:[source],{sourceTrackId:'lead',...(bass?{bassTrackId:'bass'}:{})});
}
describe('40 deterministic held-out motif and rhythm interventions',()=>{
 it('detects all six planned operations in each genuinely modified fixture',()=>{
  for(let k=0;k<40;k++){
   const result=evaluate(k,'correct');
   expect(result.windows.map(w=>w.state),`motif ${k}`)
    .toEqual(Array(6).fill('observed'));
  }
 });
 it('does not conflate 40 different static repetitions with theme development',()=>{
  for(let k=0;k<40;k++)
   expect(evaluate(k,'loop').observed,`motif ${k}`).toBe(2);
 });
 it('detects plan-position violation from section reordering in all variants',()=>{
  for(let k=0;k<40;k++){
   const good=evaluate(k,'correct'),bad=evaluate(k,'scrambled');
   expect(good.observed,`motif ${k}`).toBe(6);
   expect(bad.observed,`motif ${k}`).toBe(3);
  }
 });
 it('rejects register shifts too small to satisfy the declared transfer',()=>{
  for(let k=0;k<40;k++)
   expect(evaluate(k,'near_miss').windows[4]?.state,`motif ${k}`)
    .toBe('not_observed');
 });
 it('abstains from harmony without an independently observable bass',()=>{
  for(let k=0;k<40;k++){
   const result=evaluate(k,'correct',false);
   expect(result.windows[3]?.state,`motif ${k}`).toBe('not_evaluable');
   expect(result.notEvaluable).toBe(1);
  }
 });
});
