import {validateNote} from '@ai-composer/music-core';
import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import {ARRANGEMENT_ROLES,prepareArrangementContext} from './arrange.js';
import type {ArrangementProvider,ArrangementRole} from './arrange.js';
import {checkHarmonyPlan} from '../planning/harmony-plan.js';
import type {PlanFinding} from '../planning/harmony-plan.js';
import type {RegionRegenerationRequest} from './regenerate-region.js';

/** External MIDI text is untrusted. A scoped response must contain exactly one role and no IDs. */
const isObject=(v:unknown):v is Record<string,unknown>=>
 typeof v==='object'&&v!==null&&!Array.isArray(v);
export interface SingleRoleProposal{
 readonly role:ArrangementRole;
 readonly notes:readonly MidiNote[];
 readonly planFindings:readonly PlanFinding[];
 readonly plan:RegionRegenerationRequest['plan'];
}

export async function proposeSingleRole(
 provider:ArrangementProvider,request:RegionRegenerationRequest,signal?:AbortSignal
):Promise<SingleRoleProposal>{
 const {project,sourceTrackId,targetTrackId,targetRole,startTick,endTick}=request;
 const context=prepareArrangementContext({
  ...request,editing:{targetTrackId,targetRole,editConstraint:request.editConstraint,
   protectedPrefixCount:request.protectedPrefixCount,protectedNoteIds:request.protectedNoteIds,maxLeapSemitones:request.maxLeapSemitones}
 });
 // Includes input bounds, source existence, target locks, crossing notes, and plan validation.
 const raw=await provider.generate(context,signal);
 if(signal?.aborted)throw new Error('generation_cancelled');
 if(!isObject(raw)||Object.keys(raw).some(k=>k!=='role'&&k!=='notes')||
  raw.role!==targetRole||!Array.isArray(raw.notes))throw new Error('invalid_single_role_output');
 const data=raw.notes as unknown[];
 if(data.length<1||data.length>64)throw new Error('invalid_arrangement_note_count');
 const notes:MidiNote[]=data.map((item,index)=>{
  if(!isObject(item)||Object.keys(item).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k))||
   typeof item.pitch!=='number'||typeof item.startTick!=='number'||
   typeof item.durationTicks!=='number'||typeof item.velocity!=='number')
   throw new Error('invalid_arrangement_note');
  const note:MidiNote={
   noteId:`regenerate-${project.revision}-${sourceTrackId}-${startTick}-${targetRole}-${index}`,
   pitch:item.pitch,startTick:item.startTick,durationTicks:item.durationTicks,velocity:item.velocity
  };
  if(!validateNote(note))throw new Error('invalid_arrangement_note');
  if(note.startTick<startTick||note.startTick+note.durationTicks>endTick)
   throw new Error('arrangement_note_outside_scope');
  return note;
 });
 const empty:MusicTrack[]=ARRANGEMENT_ROLES.map(role=>({
  trackId:`plan-preview-${role}`,name:role,locked:false,notes:role===targetRole?notes:[]
 }));
 const planFindings=context.plan?checkHarmonyPlan(context.plan,empty,startTick,endTick,project.ppq,targetRole):[];
 return {role:targetRole,notes,planFindings,plan:context.plan};
}
