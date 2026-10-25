import {applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {ChangeSet,MusicProject,NoteOperation} from '@ai-composer/music-core';
import type {ArrangementProvider} from './arrange.js';
import {orchestrateArrangement} from './orchestrator.js';
import type {ArrangementRun,MotifMemoryEntry} from './orchestrator.js';
import type {MotifDevelopmentPlan} from '../planning/motif-development.js';
import {validateMotifDevelopmentPlan} from '../planning/motif-development.js';

export interface SongArrangementRequest {
 readonly project:MusicProject;
 readonly sourceTrackId:string;
 readonly developmentPlan:MotifDevelopmentPlan;
 readonly instruction:string;
 readonly maxAttemptsPerWindow?:number;
 readonly seed?:number;
}
/** Candidate is never committed; each part is a separately generated 4-bar range. */
export interface SongArrangementDraft {
 readonly version:'song-arrangement-draft-v1';
 readonly windows:readonly ArrangementRun[];
 readonly motifMemory:readonly MotifMemoryEntry[];
 readonly changes:ChangeSet;
 readonly status:'review_required'|'has_missing_techniques';
 readonly committed:false;
}
/** Stages a complete song but never changes the authorized source project or user revision.
 * Requires an existing source phrase in every development window; creating a new melody
 * is a separate, not-yet-integrated agent stage.
 */
export async function orchestrateSongArrangement(
 provider:ArrangementProvider,request:SongArrangementRequest,signal?:AbortSignal
):Promise<SongArrangementDraft>{
 const {project,developmentPlan:plan,sourceTrackId}=request;
 if(!validateProject(project))throw Error('invalid_song_project');
 validateMotifDevelopmentPlan(plan);
 if(plan.ppq!==project.ppq)throw Error('song_ppq_mismatch');
 if(typeof request.instruction!=='string'||!request.instruction.trim()||request.instruction.length>1200)
  throw Error('invalid_song_instruction');
 if(request.seed!==undefined&&(!Number.isSafeInteger(request.seed)||request.seed<0||request.seed>0xffffffff))
  throw Error('invalid_song_seed');
 const source=project.tracks.find(t=>t.trackId===sourceTrackId);
 if(!source)throw Error('song_source_track_missing');
 // Fail before calling LLM if this job cannot be fulfilled under the legacy source-driven API.
 if(plan.windows.some(w=>w.endTick-w.startTick>project.ppq*16||
  !source.notes.some(n=>n.startTick<w.endTick&&n.startTick+n.durationTicks>w.startTick)))
  throw Error('song_window_missing_source_or_exceeds_four_bars');
 const windows:ArrangementRun[]=[];
 const operations:NoteOperation[]=[];
 const memory=new Map<string,MotifMemoryEntry>();
 for(const w of plan.windows){
  if(signal?.aborted)throw Error('generation_cancelled');
  const run=await orchestrateArrangement(provider,{
   project,sourceTrackId,startTick:w.startTick,endTick:w.endTick,
   instruction:request.instruction+'\nSection: '+w.instruction,
   ...(request.seed===undefined?{}:{seed:request.seed}),
   developmentPlan:plan,maxAttempts:request.maxAttemptsPerWindow
  },signal);
  windows.push(run);
  operations.push(...run.candidate.changes.operations);
  for(const m of run.memory){
   const previous=memory.get(m.motifId);
   memory.set(m.motifId,{...m,completedWindows:[...(previous?.completedWindows??[]),...m.completedWindows]});
  }
 }
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const check=applyChangeSet(project,changes);
 if(!check.ok)throw Error('song_draft_rejected:'+check.reason);
 return {version:'song-arrangement-draft-v1',windows,motifMemory:[...memory.values()],
  changes,status:windows.some(x=>x.status==='not_observed')?'has_missing_techniques':'review_required',
  committed:false};
}
