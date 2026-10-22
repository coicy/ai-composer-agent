import type {MidiNote,MusicProject} from '@ai-composer/music-core';
import type {ArrangementRole} from './arrange.js';

/** Target selection, not model-owned editing rights. */
export interface ArrangementEditingIntent {
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
 /** Preserve every original note's ID, onset, duration and velocity; generated notes may change pitch only. */
 readonly editConstraint?:'pitch_only';
 /** Keep this many earliest target notes at the same pitch (pitch-only mode). */
 readonly protectedPrefixCount?:number;
 /** Independently protected note IDs within the scoped target. Only valid in pitch-only mode. */
 readonly protectedNoteIds?:readonly string[];
 /** Maximum absolute semitone jump between adjacent non-overlapping notes. */
 readonly maxLeapSemitones?:number;
}
export interface ProtectedPartContext {
 readonly trackIndex:number;
 readonly notes:readonly MidiNote[];
}
export interface ArrangementEditingContext extends ArrangementEditingIntent {
 readonly before:readonly MidiNote[];
 readonly original:readonly MidiNote[];
 readonly after:readonly MidiNote[];
 readonly protectedParts:readonly ProtectedPartContext[];
}
const ROLES:readonly ArrangementRole[]=['harmony','bass','accompaniment'];
const MAX_NEIGHBORS=8,MAX_ORIGINAL=32,MAX_PARTS=6,MAX_PART_NOTES=16;
const end=(n:MidiNote)=>n.startTick+n.durationTicks;
const byTime=(a:MidiNote,b:MidiNote)=>a.startTick-b.startTick||a.pitch-b.pitch||a.noteId.localeCompare(b.noteId);
const clone=(notes:readonly MidiNote[])=>notes.map(n=>({...n}));
const distance=(n:MidiNote,start:number,finish:number)=>
 end(n)<=start?start-end(n):n.startTick>=finish?n.startTick-finish:0;
/** All context is derived from the authoritative MusicProject, never from client-supplied arrays. */
export function createArrangementEditingContext(
 project:MusicProject,sourceTrackId:string,intent:ArrangementEditingIntent,startTick:number,endTick:number
):ArrangementEditingContext{
 if(!intent||!ROLES.includes(intent.targetRole))throw new Error('invalid_arrangement_role');
 if(intent.editConstraint!==undefined&&intent.editConstraint!=='pitch_only')throw new Error('invalid_edit_constraint');
 if(intent.protectedPrefixCount!==undefined&&
  (!Number.isSafeInteger(intent.protectedPrefixCount)||intent.protectedPrefixCount<0||intent.protectedPrefixCount>16))
  throw new Error('invalid_protected_prefix');
 if(intent.protectedNoteIds!==undefined&&(!Array.isArray(intent.protectedNoteIds)||
  intent.protectedNoteIds.length<1||intent.protectedNoteIds.length>32||
  intent.protectedNoteIds.some(id=>typeof id!=='string'||!id||id.length>180)||
  new Set(intent.protectedNoteIds).size!==intent.protectedNoteIds.length))
  throw new Error('invalid_protected_notes');
 if(intent.maxLeapSemitones!==undefined&&
  (!Number.isSafeInteger(intent.maxLeapSemitones)||intent.maxLeapSemitones<1||intent.maxLeapSemitones>24))
  throw new Error('invalid_leap_constraint');
 if(intent.editConstraint!=='pitch_only'&&
  (intent.protectedPrefixCount!==undefined||intent.protectedNoteIds!==undefined||intent.maxLeapSemitones!==undefined))
  throw new Error('feedback_requires_pitch_only');
 if(typeof intent.targetTrackId!=='string'||!intent.targetTrackId)throw new Error('target_track_not_found');
 if(sourceTrackId===intent.targetTrackId)throw new Error('source_track_is_target');
 const target=project.tracks.find(t=>t.trackId===intent.targetTrackId);
 if(!target)throw new Error('target_track_not_found');
 if(target.locked)throw new Error('track_locked');
 const original=target.notes.filter(n=>n.startTick<endTick&&end(n)>startTick);
 if(original.some(n=>n.locked))throw new Error('locked_note_in_range');
 if(intent.editConstraint==='pitch_only'&&original.length===0)throw new Error('pitch_only_requires_notes');
 if(intent.editConstraint==='pitch_only'&&original.length>MAX_ORIGINAL)throw new Error('pitch_only_region_too_dense');
 if(intent.protectedPrefixCount!==undefined&&intent.protectedPrefixCount>=original.length)
  throw new Error('invalid_protected_prefix');
 const actualIds=new Set(original.map(n=>n.noteId));
 if(intent.protectedNoteIds?.some(id=>!actualIds.has(id)))throw new Error('protected_note_outside_scope');
 const prefixIds=[...original].sort(byTime).slice(0,intent.protectedPrefixCount??0).map(n=>n.noteId);
 const guarded=new Set([...prefixIds,...(intent.protectedNoteIds??[])]);
 if(intent.editConstraint==='pitch_only'&&guarded.size>=original.length)
  throw new Error('all_target_notes_protected');
 // ID-only selection cannot distinguish two exactly coincident MIDI events for anonymous model output.
 // Require a duplicate-note group to be entirely protected or entirely editable.
 for(const note of original){
  const twins=original.filter(n=>n.pitch===note.pitch&&n.startTick===note.startTick&&
   n.durationTicks===note.durationTicks&&n.velocity===note.velocity);
  if(twins.some(n=>guarded.has(n.noteId))&&twins.some(n=>!guarded.has(n.noteId)))
   throw new Error('ambiguous_protected_note');
 }
 if(original.some(n=>n.startTick<startTick||end(n)>endTick))throw new Error('cross_boundary_note');
 const before=target.notes.filter(n=>end(n)<=startTick)
  .sort((a,b)=>end(b)-end(a)||byTime(a,b)).slice(0,MAX_NEIGHBORS).sort(byTime);
 const after=target.notes.filter(n=>n.startTick>=endTick).sort(byTime).slice(0,MAX_NEIGHBORS);
 const protectedParts:ProtectedPartContext[]=[];
 for(const [trackIndex,track] of project.tracks.entries()){
  if(track.trackId===sourceTrackId||track.trackId===intent.targetTrackId)continue;
  if(protectedParts.length>=MAX_PARTS)break;
  const notes=[...track.notes].sort((a,b)=>
   distance(a,startTick,endTick)-distance(b,startTick,endTick)||byTime(a,b)).slice(0,MAX_PART_NOTES).sort(byTime);
  if(notes.length)protectedParts.push({trackIndex,notes:clone(notes)});
 }
 return {targetTrackId:intent.targetTrackId,targetRole:intent.targetRole,editConstraint:intent.editConstraint,
  protectedPrefixCount:intent.protectedPrefixCount,protectedNoteIds:intent.protectedNoteIds?.slice(),maxLeapSemitones:intent.maxLeapSemitones,
  before:clone(before),original:clone([...original].sort(byTime).slice(0,MAX_ORIGINAL)),
  after:clone(after),protectedParts};
}
