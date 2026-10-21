import type {MidiNote} from '@ai-composer/music-core';

const NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'] as const;
const MODES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]} as const;
export type ScaleMode=keyof typeof MODES;
export interface KeyHypothesis {
 readonly tonic:number;
 readonly mode:ScaleMode;
 readonly name:string;
 readonly coverage:number;
 readonly score:number;
}
export interface TonalProfile {
 readonly status:'insufficient'|'ambiguous'|'suggestive';
 readonly noteCount:number;
 readonly pitchClasses:readonly number[];
 readonly hypotheses:readonly KeyHypothesis[];
}
export interface ChordSuggestion {
 readonly startTick:number;
 readonly endTick:number;
 readonly name:string|null;
 readonly confidence:'insufficient'|'tentative';
 readonly pitchClasses:readonly number[];
}
const pc=(pitch:number)=>((pitch%12)+12)%12;
const overlaps=(n:MidiNote,start:number,end:number)=>Math.max(0,Math.min(n.startTick+n.durationTicks,end)-Math.max(n.startTick,start));

export function analyzeTonality(notes:readonly MidiNote[],startTick:number,endTick:number):TonalProfile{
 const weights=Array<number>(12).fill(0);
 const active=notes.filter(n=>overlaps(n,startTick,endTick)>0);
 for(const n of active)weights[pc(n.pitch)]!+=overlaps(n,startTick,endTick);
 const total=weights.reduce((a,b)=>a+b,0);
 const pitchClasses=weights.flatMap((weight,i)=>weight>0?[i]:[]);
 if(total===0)return {status:'insufficient',noteCount:0,pitchClasses:[],hypotheses:[]};
 const hypotheses:KeyHypothesis[]=[];
 for(let tonic=0;tonic<12;tonic++)for(const mode of ['major','minor'] as const){
  const scale=new Set<number>(MODES[mode].map(offset=>(tonic+offset)%12));
  const covered=weights.reduce((acc,weight,i)=>acc+(scale.has(i)?weight:0),0);
  const coverage=covered/total;
  const score=coverage+.10*weights[tonic]!/total+.025*weights[(tonic+7)%12]!/total;
  hypotheses.push({tonic,mode,name:`${NAMES[tonic]} ${mode==='major'?'大调':'小调'}`,coverage,score});
 }
 hypotheses.sort((a,b)=>b.score-a.score||a.tonic-b.tonic||a.mode.localeCompare(b.mode));
 const distinct=pitchClasses.length;
 const status=active.length<5||distinct<4?'insufficient':
  hypotheses[0]!.score-hypotheses[1]!.score>=.04&&hypotheses[0]!.coverage>=.85?'suggestive':'ambiguous';
 return {status,noteCount:active.length,pitchClasses,hypotheses:hypotheses.slice(0,3)};
}

/** Melody-only chord hypotheses. Not a harmonic transcription or true chord recognition. */
export function suggestChords(notes:readonly MidiNote[],startTick:number,endTick:number,ppq:number):ChordSuggestion[]{
 if(!Number.isSafeInteger(ppq)||ppq<=0)throw new Error('invalid_ppq');
 const bar=ppq*4;
 const results:ChordSuggestion[]=[];
 for(let from=startTick;from<endTick;from+=bar){
  const until=Math.min(endTick,from+bar);
  const weights=Array<number>(12).fill(0);
  for(const n of notes)weights[pc(n.pitch)]!+=overlaps(n,from,until);
  const present=weights.flatMap((v,i)=>v>0?[i]:[]);
  const total=weights.reduce((a,b)=>a+b,0);
  if(present.length<2){results.push({startTick:from,endTick:until,name:null,confidence:'insufficient',pitchClasses:present});continue;}
  let best:{name:string;score:number;root:number}|null=null;
  const shapes=[{intervals:[0,4,7],label:''},{intervals:[0,3,7],label:'m'},{intervals:[0,3,6],label:'dim'}];
  for(let root=0;root<12;root++)for(const shape of shapes){
   const tones=new Set(shape.intervals.map(i=>(root+i)%12));
   const match=weights.reduce((sum,w,i)=>sum+(tones.has(i)?w:0),0);
   const score=match/total+(weights[root]!>0?.025:0);
   if(best===null||score>best.score)best={name:`${NAMES[root]}${shape.label}`,score,root};
  }
  results.push({startTick:from,endTick:until,name:best!==null&&best.score>=.65?best.name:null,
   confidence:'tentative',pitchClasses:present});
 }
 return results;
}
