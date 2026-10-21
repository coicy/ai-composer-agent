import type {CompositionProvider,CompositionRequest,ProviderContext} from '@ai-composer/composition';
/** Local API adapter. The returned note data is independently validated in the browser. */
export function createRemoteProvider(project:CompositionRequest['project']):CompositionProvider {
 return {id:'openai-remote',async generate(context:ProviderContext,signal?:AbortSignal):Promise<unknown>{
  let response:Response;
  try{
   response=await fetch('/api/compose',{method:'POST',headers:{'content-type':'application/json'},signal,
    body:JSON.stringify({project,trackId:context.trackId,startTick:context.startTick,endTick:context.endTick,mode:context.mode,editConstraint:context.editConstraint,targetNoteIds:context.targetNoteIds,instruction:context.instruction})});
  }catch{
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
