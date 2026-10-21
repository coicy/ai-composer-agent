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
  const keys=Object.keys(item);
  if(keys.some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))throw new Error('unexpected_provider_field');
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
 if(!validateProject(project))throw new Error('invalid_project');
 const track=project.tracks.find(t=>t.trackId===trackId);
 if(!track)throw new Error('track_not_found');
 if(track.locked)throw new Error('track_locked');
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick-startTick>project.ppq*4*16)throw new Error('invalid_scope');
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>2000)throw new Error('invalid_instruction');
 const existing=track.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick);
 if(existing.length)throw new Error('scope_not_empty');
 const context:ProviderContext={trackId,startTick,endTick,ppq:project.ppq,existingNotes:track.notes.map(n=>({...n})),instruction};
 const raw=await provider.generate(context,signal);
 if(signal?.aborted)throw new Error('generation_cancelled');
 const notes=parseNotes(raw,Math.min(MAX_NOTES,request.maxNotes??MAX_NOTES)).map((n,i)=>({...n,noteId:`proposal-${project.revision}-${trackId}-${startTick}-${i}`}));
 if(notes.some(n=>n.startTick<startTick||n.startTick+n.durationTicks>endTick))throw new Error('note_outside_scope');
 if(new Set(notes.map(n=>n.noteId)).size!==notes.length||notes.some(n=>track.notes.some(e=>e.noteId===n.noteId)))throw new Error('duplicate_note_id');
 const operations:NoteOperation[]=notes.map(note=>({type:'add_note',trackId,note}));
 const changes={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 return {providerId:provider.id,label:`${provider.id} candidate`,notes,changes};
}
