import {applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {ChangeSet,MidiNote,MusicProject,NoteOperation} from '@ai-composer/music-core';
import {ARRANGEMENT_ROLES} from './arrange.js';
import {proposeSingleRole} from './single-role.js';
import type {ArrangementProvider,ArrangementRequest,ArrangementRole} from './arrange.js';

/** Unlike initial arrangement, this updates only one existing track and one time window. */
export interface RegionRegenerationRequest extends ArrangementRequest {
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
 readonly editConstraint?:'pitch_only';
 readonly protectedPrefixCount?:number;
 readonly maxLeapSemitones?:number;
}
export interface RegionRegenerationCandidate {
 readonly label:string;
 readonly providerId:string;
 readonly plan?:ArrangementRequest['plan'];
 readonly sourceTrackId:string;
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
 readonly editConstraint?:'pitch_only';
 readonly protectedPrefixCount?:number;
 readonly maxLeapSemitones?:number;
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
 const {project,sourceTrackId,targetTrackId,targetRole,startTick,endTick,editConstraint,protectedPrefixCount,maxLeapSemitones}=request;
 if(!validateProject(project))throw new Error('invalid_project');
 if(!ARRANGEMENT_ROLES.includes(targetRole))throw new Error('invalid_arrangement_role');
 if(editConstraint!==undefined&&editConstraint!=='pitch_only')throw new Error('invalid_edit_constraint');
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
 const generated=await proposeSingleRole(provider,request,signal);
 let notes:readonly MidiNote[]=generated.notes;
 let operations:NoteOperation[];
 if(editConstraint==='pitch_only'){
  if(!overlap.length)throw new Error('pitch_only_requires_notes');
  if(overlap.length>32)throw new Error('pitch_only_region_too_dense');
  const key=(note:MidiNote)=>`${note.startTick}:${note.durationTicks}:${note.velocity}`;
  const byKey=(items:readonly MidiNote[])=>{
   const map=new Map<string,MidiNote[]>();
   for(const note of items){const k=key(note);const found=map.get(k)??[];found.push(note);map.set(k,found);}
   return map;
  };
  const old=byKey(overlap),incoming=byKey(generated.notes);
  if(old.size!==incoming.size||[...old].some(([k,v])=>incoming.get(k)?.length!==v.length))
   throw new Error('pitch_only_rhythm_mismatch');
  const replacement:MidiNote[]=[];
  const protectedIds=new Set([...overlap].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch||
   a.noteId.localeCompare(b.noteId)).slice(0,protectedPrefixCount??0).map(n=>n.noteId));
  operations=[];
  for(const [keyName,oldGroup] of old){
   const newGroup=incoming.get(keyName)!;
   oldGroup.sort((a,b)=>a.pitch-b.pitch||a.noteId.localeCompare(b.noteId));
   newGroup.sort((a,b)=>a.pitch-b.pitch);
   for(let i=0;i<oldGroup.length;i++){
    const prior=oldGroup[i]!,next=newGroup[i]!;
    if(protectedIds.has(prior.noteId)&&prior.pitch!==next.pitch)throw new Error('protected_note_changed');
    replacement.push({...prior,pitch:next.pitch});
    if(prior.pitch!==next.pitch)operations.push({type:'update_note',trackId:targetTrackId,noteId:prior.noteId,changes:{pitch:next.pitch}});
   }
  }
  if(maxLeapSemitones!==undefined){
   const before=target.notes.filter(n=>n.startTick+n.durationTicks<=startTick)
    .sort((a,b)=>(b.startTick+b.durationTicks)-(a.startTick+a.durationTicks)||a.pitch-b.pitch)[0];
   const after=target.notes.filter(n=>n.startTick>=endTick)
    .sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch)[0];
   const ordered=[...(before?[before]:[]),...replacement,...(after?[after]:[])]
    .sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch||a.noteId.localeCompare(b.noteId));
   for(let index=1;index<ordered.length;index++){
    const previous=ordered[index-1]!,current=ordered[index]!;
    if(previous.startTick+previous.durationTicks<=current.startTick&&
     Math.abs(previous.pitch-current.pitch)>maxLeapSemitones)
     throw new Error('leap_constraint_violation');
   }
  }
  if(operations.length===0)throw new Error('no_pitch_changes');
  notes=replacement;
 }else{
  const oldIds=new Set(target.notes.map(n=>n.noteId));
  if(notes.some(n=>oldIds.has(n.noteId)))throw new Error('generated_note_id_collision');
  operations=[
   ...overlap.map(n=>({type:'delete_note' as const,trackId:targetTrackId,noteId:n.noteId})),
   ...notes.map(note=>({type:'add_note' as const,trackId:targetTrackId,note}))
  ];
 }
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 return {
  label:`局部重编 · ${targetRole} · Seed ${request.seed??'未指定'}`,
  providerId:provider.id,plan:generated.plan,
  sourceTrackId,targetTrackId,targetRole,editConstraint,protectedPrefixCount,maxLeapSemitones,seed:request.seed,
  startTick,endTick,notes,removedNotes:overlap,changes
 };
}
