import type {MidiNote,NoteOperation} from '@ai-composer/music-core';
/** Pure command construction; callers submit all operations in one Music Core transaction. */
export function makeMoveOperations(trackId:string,allNotes:readonly MidiNote[],ids:readonly string[],deltaTick:number,deltaPitch:number):NoteOperation[]{
 if(!trackId||!Number.isSafeInteger(deltaTick)||!Number.isSafeInteger(deltaPitch))throw new Error('invalid_move');
 if(!Array.isArray(ids)||ids.length===0||new Set(ids).size!==ids.length)throw new Error('invalid_note_selection');
 const set=new Set(ids);
 const selected=allNotes.filter(n=>set.has(n.noteId));
 if(selected.length!==set.size)throw new Error('selected_note_not_found');
 if(selected.some(n=>n.locked))throw new Error('locked_note_in_range');
 if(selected.some(n=>n.pitch+deltaPitch<0||n.pitch+deltaPitch>127||n.startTick+deltaTick<0||!Number.isSafeInteger(n.startTick+deltaTick)))throw new Error('move_out_of_range');
 return selected.filter(n=>deltaTick!==0||deltaPitch!==0).map(n=>({type:'update_note',trackId,noteId:n.noteId,changes:{startTick:n.startTick+deltaTick,pitch:n.pitch+deltaPitch}}));
}
