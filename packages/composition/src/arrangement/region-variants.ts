import type {ArrangementProvider} from './arrange.js';
import {proposeRegionRegeneration} from './regenerate-region.js';
import type {RegionRegenerationRequest,RegionRegenerationCandidate} from './regenerate-region.js';
import {deriveArrangementSeed,MAX_ARRANGEMENT_VARIANTS} from './variants.js';

/** Batch generation validates each target-region edit individually; nothing touches MusicProject. */
export async function proposeRegionVariants(
 provider:ArrangementProvider,request:RegionRegenerationRequest,count:number,signal?:AbortSignal
):Promise<readonly RegionRegenerationCandidate[]>{
 if(!Number.isSafeInteger(request.seed)||request.seed===undefined||request.seed<0||request.seed>0xffffffff)
  throw new Error('invalid_arrangement_seed');
 if(!Number.isSafeInteger(count)||count<2||count>MAX_ARRANGEMENT_VARIANTS)throw new Error('invalid_variant_count');
 const candidates:RegionRegenerationCandidate[]=[];
 for(let i=0;i<count;i++){
  if(signal?.aborted)throw new Error('generation_cancelled');
  candidates.push(await proposeRegionRegeneration(provider,{...request,seed:deriveArrangementSeed(request.seed,i)},signal));
 }
 return candidates;
}

import {prepareArrangementContext} from './arrange.js';

export interface FailedRegionVariant {
 readonly seed:number;
 readonly reason:string;
}
export interface RegionVariantBatch {
 readonly candidates:readonly RegionRegenerationCandidate[];
 readonly failures:readonly FailedRegionVariant[];
}
/** Only known structural/composition failures are exposed; never provider secrets or raw responses. */
function safeVariantReason(error:unknown):string{
 const reason=error instanceof Error?error.message:'';
 if([
  'no_pitch_changes','unrealizable_harmony_plan','unrealizable_feedback_constraint',
  'pitch_only_rhythm_mismatch','protected_note_changed','leap_constraint_violation',
  'invalid_single_role_output','invalid_arrangement_note','invalid_arrangement_note_count',
  'arrangement_note_outside_scope','invalid_model_response','model_not_completed'
 ].includes(reason))return reason;
 if(/^plan_(scale|chords|registers|inversions)_violation:(harmony|bass|accompaniment)$/.test(reason))return reason;
 return 'candidate_generation_failed';
}
/**
 * A seed-specific generation or strict MIDI rejection does not erase other accepted proposals.
 * Invalid shared scope/locks/plans are preflighted BEFORE trying any seed.
 * Abort is always fatal; it never returns a partially published bank.
 */
export async function proposeRegionVariantBatch(
 provider:ArrangementProvider,request:RegionRegenerationRequest,count:number,signal?:AbortSignal
):Promise<RegionVariantBatch>{
 if(!Number.isSafeInteger(request.seed)||request.seed===undefined||request.seed<0||request.seed>0xffffffff)
  throw new Error('invalid_arrangement_seed');
 if(!Number.isSafeInteger(count)||count<2||count>MAX_ARRANGEMENT_VARIANTS)
  throw new Error('invalid_variant_count');
 if(signal?.aborted)throw new Error('generation_cancelled');
 prepareArrangementContext({...request,editing:{
  targetTrackId:request.targetTrackId,targetRole:request.targetRole,
  editConstraint:request.editConstraint,protectedPrefixCount:request.protectedPrefixCount,
  protectedNoteIds:request.protectedNoteIds,maxLeapSemitones:request.maxLeapSemitones
 }});
 const candidates:RegionRegenerationCandidate[]=[];
 const failures:FailedRegionVariant[]=[];
 for(let i=0;i<count;i++){
  if(signal?.aborted)throw new Error('generation_cancelled');
  const seed=deriveArrangementSeed(request.seed,i);
  try{
   const candidate=await proposeRegionRegeneration(provider,{...request,seed},signal);
   if(signal?.aborted)throw new Error('generation_cancelled');
   candidates.push(candidate);
  }catch(error){
   if(signal?.aborted||(error instanceof Error&&error.message==='generation_cancelled'))
    throw new Error('generation_cancelled');
   failures.push({seed,reason:safeVariantReason(error)});
  }
 }
 return {candidates,failures};
}
