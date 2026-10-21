import type {GenerationRecord,MusicProject} from '@ai-composer/music-core';
import type {HarmonyPlan,ChordEvent,DiatonicDegree} from '../planning/harmony-plan.js';
import {effectiveChordEvents,validateHarmonyPlan} from '../planning/harmony-plan.js';

export interface ReusablePlan {
 readonly recordId:string;
 readonly sourceSeed?:number;
 readonly plan:HarmonyPlan;
}
function sliceOne(record:GenerationRecord,startTick:number,endTick:number,ppq:number):HarmonyPlan|null{
 if(!record.planJson||record.startTick>startTick||record.endTick<endTick)return null;
 const bar=ppq*4;
 if(record.startTick%bar||record.endTick%bar||startTick%bar||endTick%bar||
  (endTick-startTick)>4*bar)return null;
 try{
  const original=validateHarmonyPlan(JSON.parse(record.planJson) as unknown,(record.endTick-record.startTick)/bar);
  const from=(startTick-record.startTick)/ppq,to=(endTick-record.startTick)/ppq;
  const events:ChordEvent[]=effectiveChordEvents(original).flatMap(event=>{
   const a=Math.max(from,event.startBeat),b=Math.min(to,event.startBeat+event.durationBeats);
   return a<b?[{...event,startBeat:a-from,durationBeats:b-a}]:[];
  });
  const degrees:DiatonicDegree[]=Array.from({length:(endTick-startTick)/bar},(_,i)=>{
   const beat=i*4;
   const event=events.find(e=>e.startBeat<=beat&&beat<e.startBeat+e.durationBeats);
   if(!event)throw new Error('plan_missing_chord');
   return event.degree;
  });
  return validateHarmonyPlan({...original,degrees,timeline:events},degrees.length);
 }catch{return null;}
}
/** Only offer an explicitly approved plan if it covers the precise reference and target window. */
export function findReusableHarmonyPlan(
 project:MusicProject,sourceTrackId:string,targetTrackId:string,startTick:number,endTick:number
):ReusablePlan|null{
 for(const record of [...(project.generationHistory??[])].reverse()){
  if(record.sourceTrackId!==sourceTrackId||!record.targetTrackIds.includes(targetTrackId))continue;
  const plan=sliceOne(record,startTick,endTick,project.ppq);
  if(plan)return {recordId:record.recordId,sourceSeed:record.seed,plan};
 }
 return null;
}
