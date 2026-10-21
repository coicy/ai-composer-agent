import type {MusicTrack,MidiNote} from '@ai-composer/music-core';
import type {ArrangementRole} from '../arrangement/arrange.js';

export type PlanConstraint='hard'|'soft';
export type DiatonicDegree=1|2|3|4|5|6|7;
export type PlanRegister={readonly minPitch:number;readonly maxPitch:number};
export interface ChordEvent {
 readonly startBeat:number; // 0-based quarter-note beats from arrangement start
 readonly durationBeats:number; // positive integer quarter-note beats
 readonly degree:DiatonicDegree;
 readonly seventh:boolean;
 readonly inversion:0|1|2|3; // index into diatonically stacked chord tones
}
export interface HarmonyPlan {
 readonly tonic:number;
 readonly mode:'major'|'minor';
 /** Legacy one-triad-per-bar contract; retained as a fallback when timeline is absent. */
 readonly degrees:readonly DiatonicDegree[];
 readonly timeline?:readonly ChordEvent[];
 readonly passingTones?:'none'|'stepwise';
 readonly registers:Readonly<Record<ArrangementRole,PlanRegister>>;
 readonly enforcement:Readonly<{scale:PlanConstraint;chords:PlanConstraint;registers:PlanConstraint;inversions?:PlanConstraint}>;
}
export interface PlanFinding {
 readonly role:ArrangementRole;
 readonly constraint:'scale'|'chords'|'registers'|'inversions';
 readonly count:number;
 readonly message:string;
}
export const DEFAULT_REGISTERS:Readonly<Record<ArrangementRole,PlanRegister>>={
 harmony:{minPitch:55,maxPitch:88},bass:{minPitch:28,maxPitch:60},accompaniment:{minPitch:42,maxPitch:84}
};
const MODES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]} as const;
const ROLES=['harmony','bass','accompaniment'] as const;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const hasOnly=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const pc=(n:number)=>((n%12)+12)%12;
export function scalePitchClasses(plan:HarmonyPlan):readonly number[]{
 return MODES[plan.mode].map(i=>(i+plan.tonic)%12);
}
export function effectiveChordEvents(plan:HarmonyPlan):readonly ChordEvent[]{
 return plan.timeline??plan.degrees.map((degree,i)=>({startBeat:i*4,durationBeats:4,degree,seventh:false,inversion:0}));
}
function eventPitchClasses(plan:HarmonyPlan,event:ChordEvent):readonly number[]{
 const scale=scalePitchClasses(plan);
 return Array.from({length:event.seventh?4:3},(_,i)=>scale[(event.degree-1+2*i)%7]!);
}
export function chordPitchClasses(plan:HarmonyPlan,barIndex:number):readonly number[]{
 const start=barIndex*4;
 const event=effectiveChordEvents(plan).find(e=>e.startBeat<=start&&start<e.startBeat+e.durationBeats);
 if(!event)throw new Error('plan_bar_missing');
 return eventPitchClasses(plan,event);
}
export function chordAtBeat(plan:HarmonyPlan,beat:number):ChordEvent{
 const event=effectiveChordEvents(plan).find(e=>e.startBeat<=beat&&beat<e.startBeat+e.durationBeats);
 if(!event)throw new Error('plan_chord_missing');
 return event;
}
export function chordPitchClassesAtBeat(plan:HarmonyPlan,beat:number):readonly number[]{
 return eventPitchClasses(plan,chordAtBeat(plan,beat));
}
export function chordLabel(plan:HarmonyPlan,barIndex:number):string{
 return chordEventLabel(plan,chordAtBeat(plan,barIndex*4));
}
export function chordEventLabel(plan:HarmonyPlan,event:ChordEvent):string{
 const major=['I','ii','iii','IV','V','vi','vii°'];
 const minor=['i','ii°','III','iv','v','VI','VII'];
 const label=(plan.mode==='major'?major:minor)[event.degree-1]!;
 return label+(event.seventh?'7':'')+(event.inversion?` · 第${event.inversion}转位`:'');
}
export function validateHarmonyPlan(value:unknown,barCount:number):HarmonyPlan{
 if(!Number.isSafeInteger(barCount)||barCount<1||barCount>4)throw new Error('invalid_plan_progression');
 if(!object(value)||!hasOnly(value,['tonic','mode','degrees','registers','enforcement','timeline','passingTones']))throw new Error('invalid_harmony_plan');
 if(!Number.isSafeInteger(value.tonic)||(value.tonic as number)<0||(value.tonic as number)>11||
  (value.mode!=='major'&&value.mode!=='minor'))throw new Error('invalid_plan_key');
 if(!Array.isArray(value.degrees)||value.degrees.length!==barCount||value.degrees.some(n=>!Number.isSafeInteger(n)||n<1||n>7))throw new Error('invalid_plan_progression');
 if(!object(value.registers)||!hasOnly(value.registers,ROLES))throw new Error('invalid_plan_register');
 for(const role of ROLES){
  const range=value.registers[role];
  if(!object(range)||!hasOnly(range,['minPitch','maxPitch'])||!Number.isSafeInteger(range.minPitch)||!Number.isSafeInteger(range.maxPitch)||
   (range.minPitch as number)<0||(range.maxPitch as number)>127||(range.minPitch as number)>(range.maxPitch as number))throw new Error('invalid_plan_register');
 }
 if(!object(value.enforcement)||!hasOnly(value.enforcement,['scale','chords','registers','inversions'])||
  !['scale','chords','registers'].every(k=>['hard','soft'].includes((value.enforcement as Record<string,unknown>)[k] as string))||
  (value.enforcement.inversions!==undefined&&!['hard','soft'].includes(value.enforcement.inversions as string)))
  throw new Error('invalid_plan_enforcement');
 if(value.passingTones!==undefined&&value.passingTones!=='none'&&value.passingTones!=='stepwise')throw new Error('invalid_plan_passing_tones');
 let timeline:ChordEvent[]|undefined;
 if(value.timeline!==undefined){
  if(!Array.isArray(value.timeline)||value.timeline.length<1||value.timeline.length>barCount*4)throw new Error('invalid_plan_timeline');
  timeline=[];let cursor=0;
  for(const item of value.timeline as unknown[]){
   if(!object(item)||!hasOnly(item,['startBeat','durationBeats','degree','seventh','inversion'])||
    !Number.isSafeInteger(item.startBeat)||!Number.isSafeInteger(item.durationBeats)||
    item.startBeat!==cursor||(item.durationBeats as number)<1||
    !Number.isSafeInteger(item.degree)||(item.degree as number)<1||(item.degree as number)>7||
    typeof item.seventh!=='boolean'||!Number.isSafeInteger(item.inversion)||
    (item.inversion as number)<0||(item.inversion as number)>(item.seventh?3:2))throw new Error('invalid_plan_timeline');
   timeline.push({startBeat:item.startBeat as number,durationBeats:item.durationBeats as number,
    degree:item.degree as DiatonicDegree,seventh:item.seventh,inversion:item.inversion as ChordEvent['inversion']});
   cursor+=item.durationBeats as number;
   if(cursor>barCount*4)throw new Error('invalid_plan_timeline');
  }
  if(cursor!==barCount*4)throw new Error('invalid_plan_timeline');
 }
 return {
  tonic:value.tonic as number,mode:value.mode as HarmonyPlan['mode'],
  degrees:[...value.degrees] as DiatonicDegree[],
  ...(timeline?{timeline}:{}),
  ...(value.passingTones!==undefined?{passingTones:value.passingTones as HarmonyPlan['passingTones']}:{}),
  registers:Object.fromEntries(ROLES.map(role=>[role,{minPitch:(value.registers as Record<string,PlanRegister>)[role]!.minPitch,maxPitch:(value.registers as Record<string,PlanRegister>)[role]!.maxPitch}])) as HarmonyPlan['registers'],
  enforcement:{scale:value.enforcement.scale as PlanConstraint,chords:value.enforcement.chords as PlanConstraint,
   registers:value.enforcement.registers as PlanConstraint,
   ...(value.enforcement.inversions!==undefined?{inversions:value.enforcement.inversions as PlanConstraint}:{})}
 };
}
export function isStepwisePassingTone(notes:readonly MidiNote[],index:number,plan:HarmonyPlan,startTick:number,ppq:number):boolean{
 const current=notes[index],previous=notes[index-1],next=notes[index+1];
 if(!current||!previous||!next||current.durationTicks>ppq)return false;
 if(previous.startTick+previous.durationTicks>current.startTick||current.startTick+current.durationTicks>next.startTick)return false;
 const delta1=current.pitch-previous.pitch,delta2=next.pitch-current.pitch;
 if(![1,2,-1,-2].includes(delta1)||![1,2,-1,-2].includes(delta2)||Math.sign(delta1)!==Math.sign(delta2))return false;
 const beat=(current.startTick-startTick)/ppq;
 const chord=chordAtBeat(plan,beat);
 const begin=startTick+chord.startBeat*ppq,end=begin+chord.durationBeats*ppq;
 if(previous.startTick<begin||next.startTick>=end||current.startTick+current.durationTicks>end)return false;
 const tones=new Set(eventPitchClasses(plan,chord));
 return tones.has(pc(previous.pitch))&&tones.has(pc(next.pitch))&&!tones.has(pc(current.pitch));
}
/** Hard rules apply to all overlapping chord windows. A passing-tone exception is narrowly defined by adjacent voices. */
export function checkHarmonyPlan(plan:HarmonyPlan,tracks:readonly MusicTrack[],startTick:number,endTick:number,ppq:number):PlanFinding[]{
 const findings:PlanFinding[]=[];
 const scale=new Set(scalePitchClasses(plan));
 const events=effectiveChordEvents(plan);
 for(const [i,role] of ROLES.entries()){
  const track=tracks[i];
  if(!track)throw new Error('invalid_arrangement_track');
  const count={scale:0,chords:0,registers:0,inversions:0};
  const range=plan.registers[role];
  const sorted=[...track.notes].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
  for(const [index,note] of sorted.entries()){
   const cls=pc(note.pitch);
   if(!scale.has(cls))count.scale++;
   if(note.pitch<range.minPitch||note.pitch>range.maxPitch)count.registers++;
   const violated=events.some(event=>{
    const from=startTick+event.startBeat*ppq,to=from+event.durationBeats*ppq;
    return note.startTick<to&&note.startTick+note.durationTicks>from&&!eventPitchClasses(plan,event).includes(cls);
   });
   const passing=plan.passingTones==='stepwise'&&role!=='bass'&&isStepwisePassingTone(sorted,index,plan,startTick,ppq);
   if(violated&&!passing)count.chords++;
  }
  if(role==='bass'&&(plan.timeline!==undefined||plan.enforcement.inversions!==undefined)){
   for(const event of events){
    const from=startTick+event.startBeat*ppq,to=from+event.durationBeats*ppq;
    const first=sorted.find(n=>n.startTick>=from&&n.startTick<to);
    const pitch=eventPitchClasses(plan,event)[event.inversion]!;
    if(!first||pc(first.pitch)!==pitch)count.inversions++;
   }
  }
  for(const kind of ['scale','chords','registers','inversions'] as const){
   if(!count[kind])continue;
   const enforcement=kind==='inversions'?(plan.enforcement.inversions??'soft'):plan.enforcement[kind];
   if(enforcement==='hard')throw new Error(`plan_${kind}_violation:${role}`);
   const labels={scale:'调外音',chords:'未被允许的和弦外音（含跨和弦延音）',registers:'超出建议音域',inversions:'低音未采用计划转位的音符'};
   findings.push({role,constraint:kind,count:count[kind],message:`${role}：${count[kind]} 处属于${labels[kind]}，建议核听。`});
  }
 }
 return findings;
}
