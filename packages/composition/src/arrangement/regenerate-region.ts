import {applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {ChangeSet,MidiNote,MusicProject,NoteOperation} from '@ai-composer/music-core';
import {ARRANGEMENT_ROLES,proposeArrangement} from './arrange.js';
import type {ArrangementProvider,ArrangementRequest,ArrangementRole} from './arrange.js';

/** Unlike initial arrangement, this updates only one existing track and one time window. */
export interface RegionRegenerationRequest extends ArrangementRequest {
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
}
export interface RegionRegenerationCandidate {
 readonly label:string;
 readonly providerId:string;
 readonly plan?:ArrangementRequest['plan'];
 readonly sourceTrackId:string;
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
 readonly seed?:number;
 readonly startTick:number;
 readonly endTick:number;
 readonly notes:readonly MidiNote[];
 readonly removedNotes:readonly MidiNote[];
 readonly changes:ChangeSet;
}
export async function proposeRegionRegeneration(
 provider:ArrangementProvider,request:RegionRegenerationRequest,signal?:AbortSignal
):Promise<RegionRegenerationCandidate>{
 const {project,sourceTrackId,targetTrackId,targetRole,startTick,endTick}=request;
 if(!validateProject(project))throw new Error('invalid_project');
 if(!ARRANGEMENT_ROLES.includes(targetRole))throw new Error('invalid_arrangement_role');
 if(sourceTrackId===targetTrackId)throw new Error('source_track_is_target');
 const target=project.tracks.find(t=>t.trackId===targetTrackId);
 if(!target)throw new Error('target_track_not_found');
 if(target.locked)throw new Error('track_locked');
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick)
  throw new Error('invalid_arrangement_scope');
 const overlap=target.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick);
 if(overlap.some(n=>n.locked))throw new Error('locked_note_in_range');
 if(overlap.some(n=>n.startTick<startTick||n.startTick+n.durationTicks>endTick))
  throw new Error('cross_boundary_note');
 // Perform the complete source, scope, plan and generated-MIDI checks before any edits.
 const generated=await proposeArrangement(provider,request,signal);
 const roleIndex=ARRANGEMENT_ROLES.indexOf(targetRole);
 const notes=generated.tracks[roleIndex]!.notes;
 const oldIds=new Set(target.notes.map(n=>n.noteId));
 if(notes.some(n=>oldIds.has(n.noteId)))throw new Error('generated_note_id_collision');
 const operations:NoteOperation[]=[
  ...overlap.map(n=>({type:'delete_note' as const,trackId:targetTrackId,noteId:n.noteId})),
  ...notes.map(note=>({type:'add_note' as const,trackId:targetTrackId,note}))
 ];
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 return {
  label:`局部重编 · ${targetRole} · Seed ${request.seed??'未指定'}`,
  providerId:generated.providerId,plan:generated.plan,
  sourceTrackId,targetTrackId,targetRole,seed:request.seed,
  startTick,endTick,notes,removedNotes:overlap,changes
 };
}
