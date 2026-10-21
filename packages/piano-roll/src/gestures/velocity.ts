import type {MidiNote,NoteOperation} from '@ai-composer/music-core';
/** Batch velocity edit; delegates final track-lock and revision checks to Music Core. */
export function makeVelocityOperations(trackId:string,notes:readonly MidiNote[],ids:readonly string[],velocity:number):NoteOperation[]{
 if(!trackId||!Number.isSafeInteger(velocity)||velocity<1||velocity>127)throw new Error('invalid_velocity');
 if(!Array.isArray(ids)||ids.length===0||new Set(ids).size!==ids.length)throw new Error('invalid_note_selection');
 const idsSet=new Set(ids);
 const chosen=notes.filter(n=>idsSet.has(n.noteId));
 if(chosen.length!==idsSet.size)throw new Error('selected_note_not_found');
 if(chosen.some(n=>n.locked))throw new Error('locked_note_in_range');
 return chosen.filter(n=>n.velocity!==velocity).map(n=>({type:'update_note',trackId,noteId:n.noteId,changes:{velocity}}));
}
