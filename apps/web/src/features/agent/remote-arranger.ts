import type {ArrangementProvider,ArrangementContext,ArrangementRequest} from '@ai-composer/composition';
/** Adapter only transports untrusted proposed notes. Client validates with proposeArrangement. */
export function createRemoteArranger(project:ArrangementRequest['project']):ArrangementProvider{
 return {id:'openai-arranger-remote',async generate(context:ArrangementContext,signal?:AbortSignal):Promise<unknown>{
  let response:Response;
  try{response=await fetch('/api/arrange',{
   method:'POST',headers:{'content-type':'application/json'},signal,
   body:JSON.stringify({project,sourceTrackId:context.sourceTrackId,startTick:context.startTick,endTick:context.endTick,instruction:context.instruction,plan:context.plan,seed:context.seed,
    ...(context.editing?{editing:{targetTrackId:context.editing.targetTrackId,targetRole:context.editing.targetRole,
     ...(context.editing.editConstraint?{editConstraint:context.editing.editConstraint}:{})}}:{})})
  });}catch{
   if(signal?.aborted)throw new Error('generation_cancelled');
   throw new Error('agent_api_unreachable');
  }
  if(!response.ok){
   const body=await response.json().catch(()=>({error:'generation_failed'})) as {error?:unknown};
   throw new Error(typeof body.error==='string'?body.error:'generation_failed');
  }
  return await response.json() as unknown;
 }};
}
