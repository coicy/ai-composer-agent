import {applyChangeSet,validateNote,validateProject} from '@ai-composer/music-core';
import type {MidiNote,NoteOperation} from '@ai-composer/music-core';
import type {CompositionProvider,CompositionRequest,ProviderContext,ValidatedComposition} from './provider.js';

const MAX_NOTES=256;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
function parseNotes(value:unknown,limit:number):MidiNote[]{
 if(!object(value)||!Array.isArray(value.notes)||value.notes.length===0||value.notes.length>limit)throw new Error('invalid_provider_notes');
 const notes:MidiNote[]=[];
 for(const item of value.notes){
  if(!object(item))throw new Error('invalid_provider_note');
  if(Object.keys(item).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))throw new Error('unexpected_provider_field');
  const {pitch,startTick,durationTicks,velocity}=item;
  if(typeof pitch!=='number'||typeof startTick!=='number'||typeof durationTicks!=='number'||typeof velocity!=='number')throw new Error('invalid_provider_note');
  const note:MidiNote={noteId:`candidate-${notes.length}`,pitch,startTick,durationTicks,velocity};
  if(!validateNote(note))throw new Error('invalid_provider_note');
  notes.push(note);
 }
 return notes;
}
export async function proposeWithProvider(provider:CompositionProvider,request:CompositionRequest,signal?:AbortSignal):Promise<ValidatedComposition>{
 const {project,trackId,startTick,endTick,instruction}=request;
 const mode=request.mode??'append';
 const editConstraint=request.editConstraint;
 if(editConstraint!==undefined&&editConstraint!=='pitch_only')throw new Error('invalid_edit_constraint');
 if(editConstraint==='pitch_only'&&(mode!=='replace'||!request.targetNoteIds?.length))throw new Error('pitch_only_requires_selection');
 if(!validateProject(project))throw new Error('invalid_project');
 if(mode!=='append'&&mode!=='replace')throw new Error('invalid_mode');
 const track=project.tracks.find(t=>t.trackId===trackId);
 if(!track)throw new Error('track_not_found');
 if(track.locked)throw new Error('track_locked');
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick-startTick>project.ppq*4*16)throw new Error('invalid_scope');
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>2000)throw new Error('invalid_instruction');
 if(request.maxNotes!==undefined&&(!Number.isSafeInteger(request.maxNotes)||request.maxNotes<1||request.maxNotes>MAX_NOTES))throw new Error('invalid_note_limit');
 const overlapping=track.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick);
 const targetNoteIds=request.targetNoteIds;
 if(targetNoteIds!==undefined){
  if(mode!=='replace'||!Array.isArray(targetNoteIds)||targetNoteIds.length===0||targetNoteIds.length>MAX_NOTES||
   targetNoteIds.some(id=>typeof id!=='string'||!id)||new Set(targetNoteIds).size!==targetNoteIds.length)
   throw new Error('invalid_note_selection');
 }
 if(mode==='append'&&overlapping.length)throw new Error('scope_not_empty');
 const existing=targetNoteIds===undefined?overlapping:track.notes.filter(n=>targetNoteIds.includes(n.noteId));
 if(targetNoteIds!==undefined&&existing.length!==targetNoteIds.length)throw new Error('selected_note_not_found');
 if(mode==='replace'){
  if(existing.some(n=>n.startTick<startTick||n.startTick+n.durationTicks>endTick))throw new Error('cross_boundary_note');
  if(existing.some(n=>n.locked))throw new Error('locked_note_in_range');
 }
 const context:ProviderContext={trackId,startTick,endTick,ppq:project.ppq,mode,editConstraint,targetNoteIds:targetNoteIds===undefined?undefined:[...targetNoteIds],
  existingNotes:track.notes.map(n=>({...n})),targetNotes:existing.map(n=>({...n})),instruction};
 const raw=await provider.generate(context,signal);
 if(signal?.aborted)throw new Error('generation_cancelled');
 const notes=parseNotes(raw,request.maxNotes??MAX_NOTES).map((n,i)=>({...n,noteId:`proposal-${project.revision}-${trackId}-${startTick}-${i}`}));
 if(notes.some(n=>n.startTick<startTick||n.startTick+n.durationTicks>endTick))throw new Error('note_outside_scope');
 if(notes.some(n=>track.notes.some(e=>e.noteId===n.noteId)))throw new Error('duplicate_note_id');
 let operations:NoteOperation[];
 let previewNotes:MidiNote[]=notes;
 let removedNotes:MidiNote[]=existing;
 if(editConstraint==='pitch_only'){
  // Rhythm is a multiset of (startTick,durationTicks); chords may share the same slot.
  // Stable sort ensures deterministic pairing, keeping original IDs, velocity and timing.
  const order=(a:MidiNote,b:MidiNote)=>a.startTick-b.startTick||a.durationTicks-b.durationTicks||a.pitch-b.pitch||a.noteId.localeCompare(b.noteId);
  const original=[...existing].sort(order);
  const proposed=[...notes].sort(order);
  if(proposed.length!==original.length||proposed.some((n,i)=>n.startTick!==original[i]!.startTick||n.durationTicks!==original[i]!.durationTicks))
   throw new Error('rhythm_constraint_violated');
  operations=original.flatMap((n,i):NoteOperation[]=>n.pitch===proposed[i]!.pitch?[]:[{type:'update_note',trackId,noteId:n.noteId,changes:{pitch:proposed[i]!.pitch}}]);
  if(!operations.length)throw new Error('no_pitch_changes');
  previewNotes=original.map((n,i)=>({...n,pitch:proposed[i]!.pitch}));
  removedNotes=[];
 }else{
  operations=[...existing.map(n=>({type:'delete_note' as const,trackId,noteId:n.noteId})),...notes.map(note=>({type:'add_note' as const,trackId,note}))];
 }
 const changes={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 return {providerId:provider.id,label:`${provider.id} ${editConstraint??mode} candidate`,mode,notes:previewNotes,removedNotes,changes};
}
