import type {ArrangementProvider,ArrangementContext,ArrangementRole} from './arrange.js';
import {ARRANGEMENT_ROLES} from './arrange.js';
import {chordPitchClassesAtBeat,chordAtBeat,scalePitchClasses} from '../planning/harmony-plan.js';
/** Offline deterministic demonstration. Not a tonal-harmony quality guarantee. */
export class SeededArranger implements ArrangementProvider{
 readonly id='seeded-arranger-dev';
 async generate(context:ArrangementContext):Promise<unknown>{
  const step=context.plan?.timeline?context.ppq:context.ppq*2;
  const sources=[...context.sourceNotes].sort((a,b)=>a.startTick-b.startTick);
  return {tracks:ARRANGEMENT_ROLES.map((role:ArrangementRole)=>{
   const notes=[];
   for(let tick=context.startTick;tick<context.endTick;tick+=step){
    const ref=sources.filter(n=>n.startTick<=tick).at(-1)??sources[0]!;
    const target=role==='bass'?Math.max(28,ref.pitch-24):role==='harmony'?Math.min(100,ref.pitch+4):Math.max(36,ref.pitch-12);
    let generated=target,duration=Math.min(step,context.endTick-tick);
    if(context.plan){
     const plan=context.plan;
     const beat=(tick-context.startTick)/context.ppq;
     const event=chordAtBeat(plan,beat);
     const chord=chordPitchClassesAtBeat(plan,beat);
     const options=plan.enforcement.chords==='hard'?chord:
      plan.enforcement.scale==='hard'?scalePitchClasses(plan):[0,1,2,3,4,5,6,7,8,9,10,11];
     const bounds=plan.registers[role];
     const min=plan.enforcement.registers==='hard'?bounds.minPitch:0;
     const max=plan.enforcement.registers==='hard'?bounds.maxPitch:127;
     const inversionPitch=chord[event.inversion]!;
     const candidates=Array.from({length:max-min+1},(_,i)=>i+min).filter(n=>options.includes(n%12) &&
      (role!=='bass'||plan.enforcement.inversions!=='hard'||n%12===inversionPitch));
     if(!candidates.length)throw new Error('unrealizable_harmony_plan');
     generated=candidates.reduce((best,n)=>Math.abs(n-target)<Math.abs(best-target)?n:best,candidates[0]!);
     duration=Math.min(duration,context.startTick+(event.startBeat+event.durationBeats)*context.ppq-tick);
    }
    notes.push({pitch:generated,startTick:tick,durationTicks:duration,velocity:role==='bass'?75:62});
   }
   return {role,notes};
  })};
 }
}
