import {applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {MusicProject,MidiNote,NoteOperation,ChangeSet} from '@ai-composer/music-core';

/** A pitch-only, non-AI operation. MIDI timing/velocity and note identities remain unchanged. */
export interface TransposeCandidate {
 readonly label:string;
 readonly notes:readonly MidiNote[];
 readonly changes:ChangeSet;
}
export function proposeTranspose(project:MusicProject,trackId:string,noteIds:readonly string[],semitones:number):TransposeCandidate{
 if(!validateProject(project))throw new Error('invalid_project');
 if(!Number.isSafeInteger(semitones)||semitones===0||semitones< -24||semitones>24)throw new Error('invalid_transposition');
 if(!Array.isArray(noteIds)||noteIds.length===0||noteIds.length>256||noteIds.some(id=>typeof id!=='string'||!id)||new Set(noteIds).size!==noteIds.length)throw new Error('invalid_note_selection');
 const track=project.tracks.find(t=>t.trackId===trackId);
 if(!track)throw new Error('track_not_found');
 if(track.locked)throw new Error('track_locked');
 const target=track.notes.filter(n=>noteIds.includes(n.noteId));
 if(target.length!==noteIds.length)throw new Error('selected_note_not_found');
 if(target.some(n=>n.locked))throw new Error('locked_note_in_range');
 if(target.some(n=>n.pitch+semitones<0||n.pitch+semitones>127))throw new Error('pitch_out_of_range');
 const notes=target.map(n=>({...n,pitch:n.pitch+semitones}));
 const operations:NoteOperation[]=notes.map(n=>({type:'update_note',trackId,noteId:n.noteId,changes:{pitch:n.pitch}}));
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const result=applyChangeSet(project,changes);
 if(!result.ok)throw new Error(`candidate_rejected:${result.reason}`);
 return {label:`Transpose ${semitones>0?'+':''}${semitones} semitones`,notes,changes};
}
