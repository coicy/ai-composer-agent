import type {DrumRequest,DrumProvider,DrumCandidate} from './drum-candidate.js';
import {proposeDrumCandidate} from './drum-candidate.js';
export interface DrumRetryResult{
 readonly selected:DrumCandidate;
 readonly attempts:number;
 readonly allEvidence:readonly DrumCandidate['evidence'][];
 readonly status:'signature_observed'|'signature_not_observed'|'unverifiable';
}
/** Bounded review-only retry: prompt the provider with *specific* missing kick ticks. */
export async function proposeDrumWithRetry(provider:DrumProvider,request:DrumRequest,
 maxAttempts=3,signal?:AbortSignal):Promise<DrumRetryResult>{
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error('invalid_drum_retry_count');
 let current=request;
 const audits:DrumCandidate['evidence'][]=[];
 let selected:DrumCandidate|undefined;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  if(signal?.aborted)throw Error('generation_cancelled');
  const next=await proposeDrumCandidate(provider,current,signal);
  selected=next;audits.push(next.evidence);
  if(next.evidence.status!=='not_observed')break;
  if(attempt<maxAttempts-1){
   const missing=next.evidence.missingBeats.join(', ');
   current={...request,instruction:`${request.instruction}\nCorrection: add GM kick 35/36 at absolute ticks [${missing}] without changing the requested meter and phrase boundaries.`};
   if(current.instruction.length>2000)throw Error('drum_retry_instruction_too_long');
  }
 }
 if(!selected)throw Error('no_drum_candidate');
 return {selected,attempts:audits.length,allEvidence:audits,
  status:selected.evidence.status==='observed'?'signature_observed':
   selected.evidence.status==='not_observed'?'signature_not_observed':'unverifiable'};
}
