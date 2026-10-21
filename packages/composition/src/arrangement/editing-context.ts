import type {MidiNote,MusicProject} from '@ai-composer/music-core';
import type {ArrangementRole} from './arrange.js';

/** Target selection, not model-owned editing rights. */
export interface ArrangementEditingIntent {
 readonly targetTrackId:string;
 readonly targetRole:ArrangementRole;
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
 if(typeof intent.targetTrackId!=='string'||!intent.targetTrackId)throw new Error('target_track_not_found');
 if(sourceTrackId===intent.targetTrackId)throw new Error('source_track_is_target');
 const target=project.tracks.find(t=>t.trackId===intent.targetTrackId);
 if(!target)throw new Error('target_track_not_found');
 if(target.locked)throw new Error('track_locked');
 const original=target.notes.filter(n=>n.startTick<endTick&&end(n)>startTick);
 if(original.some(n=>n.locked))throw new Error('locked_note_in_range');
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
 return {targetTrackId:intent.targetTrackId,targetRole:intent.targetRole,
  before:clone(before),original:clone([...original].sort(byTime).slice(0,MAX_ORIGINAL)),
  after:clone(after),protectedParts};
}
