import {applyChangeSet,validateNote,validateProject} from '@ai-composer/music-core';
import type {ChangeSet,MidiNote,MusicProject,MusicTrack,NoteOperation} from '@ai-composer/music-core';

export const ARRANGEMENT_ROLES=['harmony','bass','accompaniment'] as const;
export type ArrangementRole=typeof ARRANGEMENT_ROLES[number];
export interface ArrangementRequest {
 readonly project:MusicProject;
 readonly sourceTrackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
}
export interface ArrangementContext {
 readonly sourceTrackId:string;
 readonly ppq:number;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
 readonly sourceNotes:readonly MidiNote[];
 readonly neighborNotes:readonly MidiNote[];
}
export interface ArrangementProvider {
 readonly id:string;
 generate(context:ArrangementContext,signal?:AbortSignal):Promise<unknown>;
}
export interface ArrangementCandidate {
 readonly providerId:string;
 readonly label:string;
 readonly sourceTrackId:string;
 readonly tracks:readonly MusicTrack[];
 readonly changes:ChangeSet;
}
const NAMES:Record<ArrangementRole,string>={harmony:'AI 和声',bass:'AI 低音',accompaniment:'AI 伴奏'};
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
function parseArranged(raw:unknown,project:MusicProject,sourceTrackId:string,startTick:number,endTick:number):MusicTrack[]{
 if(!isObject(raw)||Object.keys(raw).some(k=>k!=='tracks')||!Array.isArray(raw.tracks)||raw.tracks.length!==ARRANGEMENT_ROLES.length)throw new Error('invalid_arrangement_output');
 const byRole=new Map<ArrangementRole,MusicTrack>();
 let total=0;
 for(const entry of raw.tracks as unknown[]){
  if(!isObject(entry)||Object.keys(entry).some(k=>k!=='role'&&k!=='notes')||!ARRANGEMENT_ROLES.includes(entry.role as ArrangementRole)||!Array.isArray(entry.notes))throw new Error('invalid_arrangement_track');
  const role=entry.role as ArrangementRole;
  if(byRole.has(role))throw new Error('duplicate_arrangement_role');
  if(entry.notes.length<1||entry.notes.length>64)throw new Error('invalid_arrangement_note_count');
  total+=entry.notes.length;
  if(total>128)throw new Error('too_many_arrangement_notes');
  const notes:MidiNote[]=[];
  for(const [index,rawNote] of (entry.notes as unknown[]).entries()){
   if(!isObject(rawNote)||Object.keys(rawNote).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))throw new Error('invalid_arrangement_note');
   const {pitch,startTick:tick,durationTicks,velocity}=rawNote;
   if(typeof pitch!=='number'||typeof tick!=='number'||typeof durationTicks!=='number'||typeof velocity!=='number')throw new Error('invalid_arrangement_note');
   const note:MidiNote={noteId:`arrange-${project.revision}-${sourceTrackId}-${startTick}-${role}-${index}`,pitch,startTick:tick,durationTicks,velocity};
   if(!validateNote(note))throw new Error('invalid_arrangement_note');
   if(note.startTick<startTick||note.startTick+note.durationTicks>endTick)throw new Error('arrangement_note_outside_scope');
   notes.push(note);
  }
  const trackId=`arrange-${project.revision}-${sourceTrackId}-${startTick}-${role}`;
  if(project.tracks.some(t=>t.trackId===trackId))throw new Error('arrangement_track_collision');
  byRole.set(role,{trackId,name:NAMES[role],locked:false,notes});
 }
 if(byRole.size!==ARRANGEMENT_ROLES.length)throw new Error('missing_arrangement_role');
 return ARRANGEMENT_ROLES.map(role=>byRole.get(role)!);
}
export async function proposeArrangement(provider:ArrangementProvider,request:ArrangementRequest,signal?:AbortSignal):Promise<ArrangementCandidate>{
 const {project,sourceTrackId,startTick,endTick,instruction}=request;
 if(!validateProject(project))throw new Error('invalid_project');
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick-startTick>project.ppq*4*4)throw new Error('invalid_arrangement_scope');
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>2000)throw new Error('invalid_instruction');
 const source=project.tracks.find(t=>t.trackId===sourceTrackId);
 if(!source)throw new Error('source_track_not_found');
 // Source notes are read-only, even if the source track itself is locked.
 const selected=source.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick);
 if(!selected.length)throw new Error('empty_source_range');
 if(selected.length>64)throw new Error('source_range_too_dense');
 const neighborNotes=source.notes.filter(n=>!(n.startTick<endTick&&n.startTick+n.durationTicks>startTick))
  .sort((a,b)=>Math.abs(a.startTick-startTick)-Math.abs(b.startTick-startTick)).slice(0,16);
 const context:ArrangementContext={sourceTrackId,ppq:project.ppq,startTick,endTick,instruction,
  sourceNotes:selected.map(n=>({...n})),neighborNotes:neighborNotes.map(n=>({...n}))};
 const raw=await provider.generate(context,signal);
 if(signal?.aborted)throw new Error('generation_cancelled');
 const tracks=parseArranged(raw,project,sourceTrackId,startTick,endTick);
 const operations:NoteOperation[]=tracks.map(track=>({type:'add_track',track}));
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 // The proposal does not write the project. Approval must still pass a revision check.
 return {providerId:provider.id,label:`${provider.id} · 三轨编配候选`,sourceTrackId,tracks,changes};
}
