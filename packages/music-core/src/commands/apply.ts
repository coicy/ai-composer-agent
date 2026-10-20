import type { ApplyResult, ChangeSet, MidiNote, MusicProject, MusicTrack } from '../model/types.js';
import {validateNote,validateProject} from '../validation/notes.js';
export function applyChangeSet(project:MusicProject,changeSet:ChangeSet):ApplyResult{
 if(!validateProject(project))return {ok:false,reason:'invalid_project'};
 if(changeSet.baseRevision!==project.revision)return {ok:false,reason:'stale_revision'};
 if(changeSet.operations.length===0)return {ok:false,reason:'empty_changeset'};
 const tracks:MusicTrack[]=project.tracks.map(t=>({...t,notes:[...t.notes]}));
 for(const op of changeSet.operations){
  const idx=tracks.findIndex(t=>t.trackId===op.trackId);
  const t=tracks[idx];
  if(!t)return {ok:false,reason:'track_not_found'};
  if(t.locked)return {ok:false,reason:'track_locked'};
  const notes:MidiNote[]=[...t.notes];
  if(op.type==='add_note'){
   if(notes.some(n=>n.noteId===op.note.noteId)||!validateNote(op.note))return {ok:false,reason:'invalid_or_duplicate_note'};
   notes.push({...op.note});
  }else{
   const ni=notes.findIndex(n=>n.noteId===op.noteId);
   const current=notes[ni];
   if(!current)return {ok:false,reason:'note_not_found'};
   if(op.type==='delete_note') notes.splice(ni,1);
   else {
    if(Object.keys(op.changes).length===0||Object.keys(op.changes).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))return {ok:false,reason:'invalid_changes'};
    const updated={...current,...op.changes};
    if(!validateNote(updated))return {ok:false,reason:'invalid_note'};
    notes[ni]=updated;
   }
  }
  tracks[idx]={...t,notes};
 }
 return {ok:true,project:{...project,revision:project.revision+1,tracks}};
}
