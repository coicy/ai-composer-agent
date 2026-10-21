import type {ArrangementProvider,ArrangementContext,ArrangementRole} from './arrange.js';
import {ARRANGEMENT_ROLES} from './arrange.js';
/** Offline deterministic demonstration. Not a tonal-harmony quality guarantee. */
export class SeededArranger implements ArrangementProvider{
 readonly id='seeded-arranger-dev';
 async generate(context:ArrangementContext):Promise<unknown>{
  const step=context.ppq*2;
  const sources=[...context.sourceNotes].sort((a,b)=>a.startTick-b.startTick);
  return {tracks:ARRANGEMENT_ROLES.map((role:ArrangementRole)=>{
   const notes=[];
   for(let tick=context.startTick;tick<context.endTick;tick+=step){
    const ref=sources.filter(n=>n.startTick<=tick).at(-1)??sources[0]!;
    const pitch=role==='bass'?Math.max(28,ref.pitch-24):role==='harmony'?Math.min(100,ref.pitch+4):Math.max(36,ref.pitch-12);
    notes.push({pitch,startTick:tick,durationTicks:Math.min(step,context.endTick-tick),velocity:role==='bass'?75:62});
   }
   return {role,notes};
  })};
 }
}
