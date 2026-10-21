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
