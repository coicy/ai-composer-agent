import type {ArrangementProvider,ArrangementContext,ArrangementRole} from './arrange.js';
import {ARRANGEMENT_ROLES} from './arrange.js';
import {chordPitchClasses,scalePitchClasses} from '../planning/harmony-plan.js';
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
    let generated=pitch;
    if(context.plan){
     const plan=context.plan;
     const index=Math.floor((tick-context.startTick)/(context.ppq*4));
     const options=plan.enforcement.chords==='hard'?chordPitchClasses(plan,index):
      plan.enforcement.scale==='hard'?scalePitchClasses(plan):[0,1,2,3,4,5,6,7,8,9,10,11];
     const range=plan.registers[role];
     const min=plan.enforcement.registers==='hard'?range.minPitch:0;
     const max=plan.enforcement.registers==='hard'?range.maxPitch:127;
     const candidates=Array.from({length:Math.max(0,max-min+1)},(_,i)=>i+min).filter(n=>options.includes(n%12));
     if(candidates.length===0)throw new Error('unrealizable_harmony_plan');
     generated=candidates.reduce((best,n)=>Math.abs(n-pitch)<Math.abs(best-pitch)?n:best,candidates[0]!);
    }
    notes.push({pitch:generated,startTick:tick,durationTicks:Math.min(step,context.endTick-tick),velocity:role==='bass'?75:62});
   }
   return {role,notes};
  })};
 }
}
