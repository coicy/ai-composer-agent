import {applyChangeSet} from '@ai-composer/music-core';
import type {MidiNote,MusicProject} from '@ai-composer/music-core';
import type {RegionRegenerationCandidate} from './regenerate-region.js';

/** Read-only factual metrics. No inferred aesthetic quality score or automatic ranking. */
export interface RegionCandidateComparison {
 readonly originalNoteCount:number;
 readonly proposedNoteCount:number;
 readonly addedNoteCount:number;
 readonly removedNoteCount:number;
 readonly changedPitchCount:number;
 readonly preservedNoteCount:number;
 /** Only stable original note IDs can be paired; null for full replacement. */
 readonly meanAbsPitchShift:number|null;
 readonly maxAbsPitchShift:number|null;
 /** Only adjacent non-overlapping onsets entirely within the selected window are compared. */
 readonly maxSequentialLeapBefore:number|null;
 readonly maxSequentialLeapAfter:number|null;
}
const within=(n:MidiNote,start:number,end:number)=>
 n.startTick>=start&&n.startTick+n.durationTicks<=end;
function maxSequentialLeap(notes:readonly MidiNote[]):number|null{
 const sorted=[...notes].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch||a.noteId.localeCompare(b.noteId));
 let maximum:number|null=null;
 for(let i=1;i<sorted.length;i++){
  const before=sorted[i-1]!,after=sorted[i]!;
  if(before.startTick+before.durationTicks>after.startTick)continue;
  const jump=Math.abs(after.pitch-before.pitch);
  maximum=maximum===null?jump:Math.max(maximum,jump);
 }
 return maximum;
}
export function compareRegionCandidate(
 project:MusicProject,candidate:RegionRegenerationCandidate
):RegionCandidateComparison{
 if(candidate.changes.baseRevision!==project.revision)throw new Error('comparison_stale_project');
 if(!Number.isSafeInteger(candidate.startTick)||!Number.isSafeInteger(candidate.endTick)||
  candidate.startTick<0||candidate.endTick<=candidate.startTick)
  throw new Error('invalid_comparison_scope');
 if(candidate.changes.operations.some(op=>!('trackId' in op)||op.trackId!==candidate.targetTrackId))
  throw new Error('invalid_comparison_scope');
 const current=project.tracks.find(t=>t.trackId===candidate.targetTrackId);
 if(!current)throw new Error('comparison_target_not_found');
 const result=applyChangeSet(project,candidate.changes);
 if(!result.ok)throw new Error(`comparison_candidate_rejected:${result.reason}`);
 const updated=result.project.tracks.find(t=>t.trackId===candidate.targetTrackId);
 if(!updated)throw new Error('comparison_target_not_found');
 const original=current.notes.filter(n=>within(n,candidate.startTick,candidate.endTick));
 const proposed=updated.notes.filter(n=>within(n,candidate.startTick,candidate.endTick));
 const oldById=new Map(original.map(n=>[n.noteId,n]));
 const newById=new Map(proposed.map(n=>[n.noteId,n]));
 const shared=original.filter(n=>newById.has(n.noteId));
 const shifts=shared.map(n=>Math.abs(newById.get(n.noteId)!.pitch-n.pitch)).filter(n=>n>0);
 const mean=shifts.length?Math.round(shifts.reduce((sum,n)=>sum+n,0)/shifts.length*10)/10:null;
 return {
  originalNoteCount:original.length,proposedNoteCount:proposed.length,
  addedNoteCount:proposed.filter(n=>!oldById.has(n.noteId)).length,
  removedNoteCount:original.filter(n=>!newById.has(n.noteId)).length,
  changedPitchCount:shifts.length,preservedNoteCount:shared.length,
  meanAbsPitchShift:mean,maxAbsPitchShift:shifts.length?Math.max(...shifts):null,
  maxSequentialLeapBefore:maxSequentialLeap(original),
  maxSequentialLeapAfter:maxSequentialLeap(proposed)
 };
}
