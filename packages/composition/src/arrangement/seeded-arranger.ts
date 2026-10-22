import type {ArrangementProvider,ArrangementContext,ArrangementRole} from './arrange.js';
import {ARRANGEMENT_ROLES} from './arrange.js';
import {chordPitchClassesAtBeat,chordAtBeat,scalePitchClasses,effectiveChordEvents} from '../planning/harmony-plan.js';
function prng(seed:number):()=>number{
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
/** Offline deterministic demonstration. No random provider, engine or clock state; not a tonal-harmony quality guarantee. */
export class SeededArranger implements ArrangementProvider{
 readonly id='seeded-arranger-dev';
 async generate(context:ArrangementContext):Promise<unknown>{
  if(context.editing?.editConstraint==='pitch_only'){
   const role=context.editing.targetRole,roleIndex=ARRANGEMENT_ROLES.indexOf(role);
   const rng=prng(((context.seed??0)^Math.imul(roleIndex+1,0x9e3779b9))>>>0);
   const originals=[...context.editing.original].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch||a.noteId.localeCompare(b.noteId));
   if(!originals.length)throw new Error('pitch_only_requires_notes');
   const plan=context.plan;
   const events=plan?effectiveChordEvents(plan):[];
   const generatedPitches:number[]=[];
   const prefix=context.editing.protectedPrefixCount??0;
   const leap=context.editing.maxLeapSemitones;
   const preceding=[...context.editing.before].sort((a,b)=>
    b.startTick+b.durationTicks-(a.startTick+a.durationTicks)||a.pitch-b.pitch)[0];
   const following=[...context.editing.after].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch)[0];
   for(const [index,original] of originals.entries()){
    const eligible:number[]=[];
    const previous=index===0?preceding:originals[index-1];
    const previousPitch=index===0?preceding?.pitch:generatedPitches[index-1];
    const next=index===originals.length-1?following:undefined;
    for(let pitch=0;pitch<=127;pitch++){
     if(index<prefix&&pitch!==original.pitch)continue;
     const cls=pitch%12;
     if(plan){
      const range=plan.registers[role];
      if(plan.enforcement.registers==='hard'&&(pitch<range.minPitch||pitch>range.maxPitch))continue;
      if(plan.enforcement.scale==='hard'&&!scalePitchClasses(plan).includes(cls))continue;
      if(plan.enforcement.chords==='hard'&&events.some(event=>{
       const from=context.startTick+event.startBeat*context.ppq,to=from+event.durationBeats*context.ppq;
       return original.startTick<to&&original.startTick+original.durationTicks>from&&
        !chordPitchClassesAtBeat(plan,event.startBeat).includes(cls);
      }))continue;
      if(role==='bass'&&plan.enforcement.inversions==='hard'){
       const firstEvents=events.filter(event=>{
        const from=context.startTick+event.startBeat*context.ppq,to=from+event.durationBeats*context.ppq;
        return original.startTick>=from&&original.startTick<to&&
         originals.filter(n=>n.startTick>=from&&n.startTick<to)[0]===original;
       });
       if(firstEvents.some(event=>cls!==chordPitchClassesAtBeat(plan,event.startBeat)[event.inversion]))continue;
      }
     }
     if(leap!==undefined&&previous&&previousPitch!==undefined&&
      previous.startTick+previous.durationTicks<=original.startTick&&
      Math.abs(pitch-previousPitch)>leap)continue;
     if(leap!==undefined&&next&&original.startTick+original.durationTicks<=next.startTick&&
      Math.abs(pitch-next.pitch)>leap)continue;
     eligible.push(pitch);
    }
    const possible=index<prefix?eligible:eligible.filter(p=>p!==original.pitch);
    if(!possible.length)throw new Error('unrealizable_feedback_constraint');
    possible.sort((a,b)=>Math.abs(a-original.pitch)-Math.abs(b-original.pitch)||a-b);
    generatedPitches.push(index<prefix?original.pitch:possible[Math.floor(rng()*Math.min(6,possible.length))]!);
   }
   return {role,notes:originals.map((note,i)=>({
    pitch:generatedPitches[i]!,startTick:note.startTick,durationTicks:note.durationTicks,velocity:note.velocity
   }))};
  }
  const step=context.plan?.timeline?context.ppq:context.ppq*2;
  const sources=[...context.sourceNotes].sort((a,b)=>a.startTick-b.startTick);
  const roles:readonly ArrangementRole[]=context.editing?[context.editing.targetRole]:ARRANGEMENT_ROLES;
  const generated=roles.map((role:ArrangementRole)=>{
   const roleIndex=ARRANGEMENT_ROLES.indexOf(role);
   const notes=[];
   const rng=context.seed===undefined?null:prng((context.seed^Math.imul(roleIndex+1,0x9e3779b9))>>>0);
   for(let tick=context.startTick;tick<context.endTick;tick+=step){
    const ref=sources.filter(n=>n.startTick<=tick).at(-1)??sources[0]!;
    const targetBase=role==='bass'?Math.max(28,ref.pitch-24):role==='harmony'?Math.min(100,ref.pitch+4):Math.max(36,ref.pitch-12);
    const target=targetBase+(rng?Math.floor(rng()*9)-4:0);
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
     const ranked=candidates.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)||a-b);
     generated=rng?ranked[Math.floor(rng()*Math.min(3,ranked.length))]!:ranked[0]!;
     duration=Math.min(duration,context.startTick+(event.startBeat+event.durationBeats)*context.ppq-tick);
    }
    const velocity=rng?65+Math.floor(rng()*33):(role==='bass'?75:62);
    const actualDuration=rng?Math.max(1,Math.floor(duration*(0.65+0.35*rng()))):duration;
    notes.push({pitch:generated,startTick:tick,durationTicks:actualDuration,velocity});
   }
   return {role,notes};
  });
  return context.editing?{role:context.editing.targetRole,notes:generated[0]!.notes}:{tracks:generated};
 }
}
