import type {ApplyResult,ChangeSet,MidiNote,MusicProject,MusicTrack} from '../model/types.js';
import {validateGenerationRecord,validateNote,validateProject} from '../validation/notes.js';
export function applyChangeSet(project:MusicProject,changeSet:ChangeSet):ApplyResult{
 if(!validateProject(project))return {ok:false,reason:'invalid_project'};
 if(!changeSet||changeSet.baseRevision!==project.revision)return {ok:false,reason:'stale_revision'};
 if(!Array.isArray(changeSet.operations)||changeSet.operations.length===0)return {ok:false,reason:'empty_changeset'};
 const tracks:MusicTrack[]=project.tracks.map(t=>({...t,notes:[...t.notes]}));
 for(const op of changeSet.operations){
  if(op.type==='add_track'){
   const t=op.track;
   if(!t||!t.trackId||tracks.some(x=>x.trackId===t.trackId)||!validateProject({projectId:'validation',revision:0,ppq:project.ppq,tracks:[t]}))return {ok:false,reason:'invalid_or_duplicate_track'};
   tracks.push({...t,notes:t.notes.map((n:MidiNote)=>({...n}))});continue;
  }
  const idx=tracks.findIndex(t=>t.trackId===op.trackId);
  const t=tracks[idx];if(!t)return {ok:false,reason:'track_not_found'};
  if(t.locked)return {ok:false,reason:'track_locked'};
  const notes:MidiNote[]=[...t.notes];
  if(op.type==='add_note'){
   if(notes.some(n=>n.noteId===op.note.noteId)||!validateNote(op.note))return {ok:false,reason:'invalid_or_duplicate_note'};
   notes.push({...op.note});
  }else{
   const ni=notes.findIndex(n=>n.noteId===op.noteId),current=notes[ni];
   if(!current)return {ok:false,reason:'note_not_found'};
   if(current.locked)return {ok:false,reason:'note_locked'};
   if(op.type==='delete_note')notes.splice(ni,1);
   else if(op.type==='update_note'){
    if(!op.changes||Object.keys(op.changes).length===0||Object.keys(op.changes).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))return {ok:false,reason:'invalid_changes'};
    const updated={...current,...op.changes};if(!validateNote(updated))return {ok:false,reason:'invalid_note'};
    notes[ni]=updated;
   }else return {ok:false,reason:'unknown_operation'};
  }
  tracks[idx]={...t,notes};
 }
 const record=changeSet.generationRecord;
 if(record&&(!validateGenerationRecord(record)||!tracks.some(t=>t.trackId===record.sourceTrackId)||
  record.targetTrackIds.some(id=>!tracks.some(t=>t.trackId===id))||
  (project.generationHistory??[]).length>=128||
  (project.generationHistory??[]).some(r=>r.recordId===record.recordId)))
  return {ok:false,reason:'invalid_generation_record'};
 const history=record?[...(project.generationHistory??[]),{...record,targetTrackIds:[...record.targetTrackIds]}]:project.generationHistory;
 return {ok:true,project:{...project,revision:project.revision+1,tracks,...(history?{generationHistory:history}:{})}};
}