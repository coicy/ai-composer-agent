import type {MusicTrack,MidiNote} from '@ai-composer/music-core';
import type {ArrangementRole} from '../arrangement/arrange.js';

export type PlanConstraint='hard'|'soft';
export type DiatonicDegree=1|2|3|4|5|6|7;
export type PlanRegister={readonly minPitch:number;readonly maxPitch:number};
export interface HarmonyPlan{
 readonly tonic:number;
 readonly mode:'major'|'minor';
 readonly degrees:readonly DiatonicDegree[];
 readonly registers:Readonly<Record<ArrangementRole,PlanRegister>>;
 readonly enforcement:Readonly<{scale:PlanConstraint;chords:PlanConstraint;registers:PlanConstraint}>;
}
export interface PlanFinding {
 readonly role:ArrangementRole;
 readonly constraint:'scale'|'chords'|'registers';
 readonly count:number;
 readonly message:string;
}
export const DEFAULT_REGISTERS:Readonly<Record<ArrangementRole,PlanRegister>>={
 harmony:{minPitch:55,maxPitch:88},
 bass:{minPitch:28,maxPitch:60},
 accompaniment:{minPitch:42,maxPitch:84}
};
const MODES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]} as const;
const ROLES=['harmony','bass','accompaniment'] as const;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const hasOnly=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const pc=(n:number)=>((n%12)+12)%12;
export function scalePitchClasses(plan:HarmonyPlan):readonly number[]{
 return MODES[plan.mode].map(i=>(i+plan.tonic)%12);
}
export function chordPitchClasses(plan:HarmonyPlan,barIndex:number):readonly number[]{
 const degree=plan.degrees[barIndex];
 if(degree===undefined)throw new Error('plan_bar_missing');
 const scale=scalePitchClasses(plan);
 return [0,2,4].map(delta=>scale[(degree-1+delta)%7]!);
}
export function chordLabel(plan:HarmonyPlan,barIndex:number):string{
 const degree=plan.degrees[barIndex];
 if(degree===undefined)throw new Error('plan_bar_missing');
 const quality=plan.mode==='major'?['I','ii','iii','IV','V','vi','vii°']:['i','ii°','III','iv','v','VI','VII'];
 return quality[degree-1]!;
}
export function validateHarmonyPlan(value:unknown,barCount:number):HarmonyPlan{
 if(!object(value)||!hasOnly(value,['tonic','mode','degrees','registers','enforcement']))throw new Error('invalid_harmony_plan');
 if(!Number.isSafeInteger(value.tonic)||(value.tonic as number)<0||(value.tonic as number)>11||
  (value.mode!=='major'&&value.mode!=='minor'))throw new Error('invalid_plan_key');
 if(!Array.isArray(value.degrees)||value.degrees.length!==barCount||value.degrees.some(n=>!Number.isSafeInteger(n)||n<1||n>7))throw new Error('invalid_plan_progression');
 if(!object(value.registers)||!hasOnly(value.registers,ROLES))throw new Error('invalid_plan_register');
 for(const role of ROLES){
  const range=value.registers[role];
  if(!object(range)||!hasOnly(range,['minPitch','maxPitch'])||!Number.isSafeInteger(range.minPitch)||!Number.isSafeInteger(range.maxPitch)||
   (range.minPitch as number)<0||(range.maxPitch as number)>127||(range.minPitch as number)>(range.maxPitch as number))throw new Error('invalid_plan_register');
 }
 if(!object(value.enforcement)||!hasOnly(value.enforcement,['scale','chords','registers'])||
   !['scale','chords','registers'].every(k=>value.enforcement!==undefined&&object(value.enforcement)&&['hard','soft'].includes(value.enforcement[k] as string)))throw new Error('invalid_plan_enforcement');
 return {
  tonic:value.tonic as number,mode:value.mode as HarmonyPlan['mode'],
  degrees:[...value.degrees] as DiatonicDegree[],
  registers:Object.fromEntries(ROLES.map(role=>[role,{minPitch:(value.registers as Record<string,PlanRegister>)[role]!.minPitch,maxPitch:(value.registers as Record<string,PlanRegister>)[role]!.maxPitch}])) as HarmonyPlan['registers'],
  enforcement:{scale:value.enforcement.scale as PlanConstraint,chords:value.enforcement.chords as PlanConstraint,registers:value.enforcement.registers as PlanConstraint}
 };
}
/** Every affected chord window is checked, not only the note onset; sustained notes cannot bypass a chord change. */
export function checkHarmonyPlan(plan:HarmonyPlan,tracks:readonly MusicTrack[],startTick:number,endTick:number,ppq:number):PlanFinding[]{
 const findings:PlanFinding[]=[];
 const scale=new Set(scalePitchClasses(plan));
 const barTicks=ppq*4;
 const chordSets=plan.degrees.map((_,i)=>new Set(chordPitchClasses(plan,i)));
 for(const [i,role] of ROLES.entries()){
  const track=tracks[i];
  if(!track)throw new Error('invalid_arrangement_track');
  const count={scale:0,chords:0,registers:0};
  const range=plan.registers[role];
  for(const note of track.notes){
   const cls=pc(note.pitch);
   if(!scale.has(cls))count.scale++;
   if(note.pitch<range.minPitch||note.pitch>range.maxPitch)count.registers++;
   const first=Math.max(0,Math.floor((note.startTick-startTick)/barTicks));
   const last=Math.min(chordSets.length-1,Math.floor((Math.min(endTick,note.startTick+note.durationTicks)-1-startTick)/barTicks));
   if(Array.from({length:Math.max(0,last-first+1)},(_,offset)=>first+offset).some(bar=>!chordSets[bar]!.has(cls)))count.chords++;
  }
  for(const kind of ['scale','chords','registers'] as const){
   if(!count[kind])continue;
   if(plan.enforcement[kind]==='hard')throw new Error(`plan_${kind}_violation:${role}`);
   const labels={scale:'调外音',chords:'非该小节和弦音（含跨小节延音）',registers:'超出建议音域'};
   findings.push({role,constraint:kind,count:count[kind],message:`${role}：${count[kind]} 个音符属于${labels[kind]}，建议核听。`});
  }
 }
 return findings;
}
