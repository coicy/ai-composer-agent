import {validateFeedbackInterpretation} from '@ai-composer/composition';
import type {FeedbackInterpretation} from '@ai-composer/composition';
/** Interpretive output is never authoritative; the UI requires explicit review. */
export async function requestRemoteFeedback(feedback:string,noteCount:number,signal?:AbortSignal):Promise<FeedbackInterpretation>{
 let response:Response;
 try{
  response=await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json'},
   signal,body:JSON.stringify({feedback,noteCount})});
 }catch{
  if(signal?.aborted)throw new Error('generation_cancelled');
  throw new Error('agent_api_unreachable');
 }
 if(!response.ok){
  const body=await response.json().catch(()=>({error:'feedback_failed'})) as {error?:unknown};
  throw new Error(typeof body.error==='string'?body.error:'feedback_failed');
 }
 const raw=await response.json() as unknown;
 return validateFeedbackInterpretation(raw,noteCount);
}
