import type {ArrangementCandidate,ArrangementProvider,ArrangementRequest,ArrangementRole} from './arrange.js';
import {ARRANGEMENT_ROLES,proposeArrangement} from './arrange.js';
import {validateHarmonyPlan} from '../planning/harmony-plan.js';

const SEED_MAX=0xffffffff;
export const MAX_ARRANGEMENT_VARIANTS=4;
const validSeed=(n:unknown):n is number=>Number.isSafeInteger(n)&&typeof n==='number'&&n>=0&&n<=SEED_MAX;
/** Stable 32-bit variation schedule, independent of engine clock, iteration history or Math.random. */
export function deriveArrangementSeed(baseSeed:number,variantIndex:number):number{
 if(!validSeed(baseSeed)||!Number.isSafeInteger(variantIndex)||variantIndex<0||variantIndex>=MAX_ARRANGEMENT_VARIANTS)
  throw new Error('invalid_arrangement_seed');
 return (baseSeed+Math.imul(variantIndex,0x9e3779b9))>>>0;
}
/** Serial generation limits rate pressure; one invalid candidate rejects the complete bank. */
export async function proposeArrangementVariants(
 provider:ArrangementProvider,request:ArrangementRequest,count:number,signal?:AbortSignal
):Promise<readonly ArrangementCandidate[]>{
 if(!validSeed(request.seed))throw new Error('invalid_arrangement_seed');
 if(!Number.isSafeInteger(count)||count<2||count>MAX_ARRANGEMENT_VARIANTS)throw new Error('invalid_variant_count');
 const variants:ArrangementCandidate[]=[];
 for(let index=0;index<count;index++){
  if(signal?.aborted)throw new Error('generation_cancelled');
  variants.push(await proposeArrangement(provider,{...request,seed:deriveArrangementSeed(request.seed,index)},signal));
 }
 return variants;
}
export interface ArrangementPartChoices extends Readonly<Record<ArrangementRole,number>>{}
export interface MixedArrangementCandidate extends ArrangementCandidate {
 readonly roleSeeds:Readonly<Record<ArrangementRole,number>>;
}
/** Never splice raw ChangeSets from independent variants: build and validate a fresh three-track proposal. */
export async function combineArrangementVariants(
 request:ArrangementRequest,variants:readonly ArrangementCandidate[],choices:ArrangementPartChoices
):Promise<MixedArrangementCandidate>{
 if(!validSeed(request.seed)||variants.length<2||variants.length>MAX_ARRANGEMENT_VARIANTS)throw new Error('invalid_variant_bank');
 const expectedPlan=request.plan===undefined?undefined:
  validateHarmonyPlan(request.plan,Math.ceil((request.endTick-request.startTick)/(request.project.ppq*4)));
 for(const [index,candidate] of variants.entries()){
  if(candidate.changes.baseRevision!==request.project.revision||
   candidate.sourceTrackId!==request.sourceTrackId||
   candidate.startTick!==request.startTick||candidate.endTick!==request.endTick||
   candidate.seed!==deriveArrangementSeed(request.seed,index)||
   JSON.stringify(candidate.plan)!==JSON.stringify(expectedPlan)||
   candidate.tracks.length!==ARRANGEMENT_ROLES.length)throw new Error('variant_context_mismatch');
 }
 const roleSeeds={} as Record<ArrangementRole,number>;
 const output=ARRANGEMENT_ROLES.map((role,roleIndex)=>{
  const selectedIndex=choices[role];
  if(!Number.isSafeInteger(selectedIndex)||selectedIndex<0||selectedIndex>=variants.length)
   throw new Error('invalid_variant_selection');
  const source=variants[selectedIndex]!;
  const part=source.tracks[roleIndex]!;
  roleSeeds[role]=source.seed!;
  return {role,notes:part.notes.map(n=>({pitch:n.pitch,startTick:n.startTick,durationTicks:n.durationTicks,velocity:n.velocity}))};
 });
 const provider:ArrangementProvider={id:'mixed-arrangement',async generate(){return {tracks:output};}};
 const mixed=await proposeArrangement(provider,{...request,seed:undefined});
 return {...mixed,roleSeeds};
}
