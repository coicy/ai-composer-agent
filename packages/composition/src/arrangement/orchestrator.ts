import type {ArrangementCandidate,ArrangementProvider,ArrangementRequest} from './arrange.js';
import {proposeArrangement} from './arrange.js';
import type {MotifDevelopmentPlan,MotifIdentity} from '../planning/motif-development.js';
import {validateMotifDevelopmentPlan} from '../planning/motif-development.js';

export interface MotifMemoryEntry {
 readonly motifId:string;
 readonly sourceTrackId:string;
 readonly noteIds:readonly string[];
 readonly identity:MotifIdentity;
 readonly completedWindows:readonly {startTick:number;endTick:number;status:'observed'|'not_observed'|'not_evaluable'}[];
}
export interface ArrangementRun {
 readonly status:'observed'|'not_observed'|'not_evaluable'|'not_requested';
 readonly candidate:ArrangementCandidate;
 readonly attempts:number;
 readonly history:readonly {attempt:number;status:'observed'|'not_observed'|'not_evaluable'|'not_requested';noteCount:number}[];
 readonly memory:readonly MotifMemoryEntry[];
 readonly committed:false;
}
export interface OrchestrationRequest extends ArrangementRequest {
 readonly maxAttempts?:number;
 readonly developmentPlan?:MotifDevelopmentPlan;
}
const countNotes=(c:ArrangementCandidate)=>c.tracks.reduce((n,t)=>n+t.notes.length,0);
const evidenceStatus=(c:ArrangementCandidate)=>c.developmentEvidence?.state??'not_requested';
/**
 * Review-only orchestrator for ONE existing legal arrangement window.
 * Retry only when an objective motif contour is NOT observed. Never overwrite a
 * project, manufacture a missing melody, retry aesthetics, or accept unverifiable evidence.
 */
export async function orchestrateArrangement(
 provider:ArrangementProvider,request:OrchestrationRequest,signal?:AbortSignal
):Promise<ArrangementRun>{
 const max=request.maxAttempts??3;
 if(!Number.isSafeInteger(max)||max<1||max>3)throw Error('invalid_orchestration_budget');
 const plan=request.developmentPlan;
 if(plan)validateMotifDevelopmentPlan(plan);
 const memory:MotifMemoryEntry[]=plan?plan.motifs.map(m=>{
  const track=request.project.tracks.find(t=>t.trackId===m.sourceTrackId);
  if(!track||m.noteIds.some(id=>!track.notes.some(n=>n.noteId===id)))
   throw Error('orchestrator_motif_source_missing');
  return {motifId:m.id,sourceTrackId:m.sourceTrackId,noteIds:[...m.noteIds],identity:m,completedWindows:[]};
 }):[];
 const attempts:{attempt:number;status:ArrangementRun['status'];noteCount:number}[]=[];
 let best:ArrangementCandidate|undefined;
 let instruction=request.instruction;
 for(let index=0;index<max;index++){
  if(signal?.aborted)throw Error('generation_cancelled');
  const candidate=await proposeArrangement(provider,{...request,instruction},signal);
  const state=evidenceStatus(candidate);
  attempts.push({attempt:index+1,status:state,noteCount:countNotes(candidate)});
  if(!best||rank(state)>rank(evidenceStatus(best)))best=candidate;
  if(state!=='not_observed')break;
  if(index+1<max){
   // Do not silently alter the harmony, timebase, source, or user's constraints.
   instruction=request.instruction+'\nRevision: the selected motif contour was not observed in the generated part. Preserve the specified directed intervals and section identity; vary only permitted notes in this scoped candidate.';
   if(instruction.length>2000)throw Error('orchestration_instruction_too_long');
  }
 }
 if(!best)throw Error('no_arrangement_candidate');
 const status=evidenceStatus(best);
 const guidance=plan?.windows.find(w=>request.startTick>=w.startTick&&request.endTick<=w.endTick);
 const updated=memory.map(m=>guidance?.motifId===m.motifId?{
  ...m,completedWindows:[...m.completedWindows,{startTick:request.startTick,endTick:request.endTick,status:status==='not_requested'?'not_evaluable':status}]
 }:m);
 return {status,candidate:best,attempts:attempts.length,history:attempts,memory:updated,committed:false};
}
function rank(s:ArrangementRun['status']):number{
 return s==='observed'?3:s==='not_evaluable'?2:s==='not_requested'?1:0;
}
