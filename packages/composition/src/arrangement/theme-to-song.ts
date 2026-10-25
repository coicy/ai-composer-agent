import {applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {MusicProject,ChangeSet,NoteOperation,MidiNote} from '@ai-composer/music-core';
import type {CompositionProvider,ValidatedComposition} from '../contracts/provider.js';
import {proposeWithProvider} from '../contracts/validate.js';
import type {ArrangementProvider} from './arrange.js';
import {orchestrateSongArrangement} from './song-orchestrator.js';
import type {SongArrangementDraft} from './song-orchestrator.js';
import {buildRuinsDevelopmentPlan,extractMotifIdentity} from '../planning/motif-development.js';

export interface ThemeToSongRequest {
 readonly project:MusicProject;
 readonly melodyTrackId:string;
 readonly creativeBrief:string;
 readonly maxAttemptsPerWindow?:number;
 readonly seed?:number;
}
export interface ThemeToSongDraft {
 readonly version:'theme-to-song-v1';
 readonly theme:ValidatedComposition;
 readonly melodyWindows:readonly ValidatedComposition[];
 readonly arrangement:SongArrangementDraft;
 readonly combinedChanges:ChangeSet;
 readonly committed:false;
}
/** General-LLM multi-stage composition. All edits remain previews; no approval or persistence. */
export async function composeRuinsThemeToSong(
 melodyProvider:CompositionProvider,arranger:ArrangementProvider,
 request:ThemeToSongRequest,signal?:AbortSignal
):Promise<ThemeToSongDraft>{
 const {project,melodyTrackId,creativeBrief}=request;
 if(!validateProject(project))throw Error('invalid_theme_project');
 if(typeof creativeBrief!=='string'||!creativeBrief.trim()||creativeBrief.length>900)
  throw Error('invalid_theme_brief');
 if(request.seed!==undefined&&(!Number.isSafeInteger(request.seed)||request.seed<0||request.seed>0xffffffff))
  throw Error('invalid_theme_seed');
 const track=project.tracks.find(t=>t.trackId===melodyTrackId);
 if(!track||track.locked||track.notes.length)throw Error('theme_track_must_be_empty_and_editable');
 const bar=project.ppq*4;
 if(!Number.isSafeInteger(bar)||bar<1)throw Error('invalid_theme_timebase');
 const proposed:ValidatedComposition[]=[];
 let staged=project;
 const allOps:NoteOperation[]=[];
 let theme:ValidatedComposition|undefined;
 let seedNotes:readonly MidiNote[]=[];
 const phases=['introduce','rhythmic_augmentation','fragmentation','harmonic_recontextualization','register_transfer','thematic_return'] as const;
 for(let i=0;i<phases.length;i++){
  if(signal?.aborted)throw Error('generation_cancelled');
  const start=i*4*bar,end=start+4*bar;
  const guidance=phases[i];
  const description=i===0?
   'Write a sparse, original, recognizable 3-8 note opening motif; allow silence and space. Do not copy reference MIDI.':
   'Develop the original motif using '+guidance+'. Retain recognisable interval contour or a motif fragment; favor purposeful transformations over extra notes.';
  const composition=await proposeWithProvider(melodyProvider,{
   project:staged,trackId:melodyTrackId,startTick:start,endTick:end,mode:'append',maxNotes:32,
   instruction:creativeBrief+'\nSection '+(i+1)+'/6 ('+guidance+'). '+description+
    (i===0?'':'\nOpening motif (original, for internal development only): '+JSON.stringify(seedNotes.map(n=>({pitch:n.pitch,startTick:n.startTick,durationTicks:n.durationTicks}))))
  },signal);
  if(i===0){
   if(composition.notes.length<3||composition.notes.length>16)throw Error('theme_requires_3_to_16_notes');
   theme=composition;
   seedNotes=composition.notes;
  }
  const next=applyChangeSet(staged,composition.changes);
  if(!next.ok)throw Error('theme_staging_rejected:'+next.reason);
  staged=next.project;
  proposed.push(composition);
  allOps.push(...composition.changes.operations);
 }
 if(!theme)throw Error('missing_theme');
 const motif=extractMotifIdentity('original-A',melodyTrackId,seedNotes);
 const plan=buildRuinsDevelopmentPlan(motif,project.ppq);
 const arrangement=await orchestrateSongArrangement(arranger,{
  project:staged,sourceTrackId:melodyTrackId,developmentPlan:plan,instruction:creativeBrief,
  maxAttemptsPerWindow:request.maxAttemptsPerWindow,seed:request.seed
 },signal);
 // Generated role-track IDs and note IDs are checked by a *single* dry-run against
 // the original revision. No staging revision escapes to the returned changeset.
 const allChanges:ChangeSet={baseRevision:project.revision,
  operations:[...allOps,...arrangement.changes.operations]};
 const validation=applyChangeSet(project,allChanges);
 if(!validation.ok)throw Error('full_song_candidate_rejected:'+validation.reason);
 return {version:'theme-to-song-v1',theme,melodyWindows:proposed,arrangement,
  combinedChanges:allChanges,committed:false};
}
