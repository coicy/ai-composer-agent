import {applyChangeSet,validateNote,validateProject,ticksPerBar,resolveMeter} from '@ai-composer/music-core';
import {analyzeTonality,suggestChords} from '../analysis/tonality.js';
import type {TonalProfile,ChordSuggestion} from '../analysis/tonality.js';
import {evaluateArrangement} from '../evaluation/arrangement.js';
import {evaluateTechniqueEvidence} from '../evaluation/electronic-technique-evidence.js';
import type {TechniqueEvidence} from '../evaluation/electronic-technique-evidence.js';
import {validateHarmonyPlan,checkHarmonyPlan} from '../planning/harmony-plan.js';
import {recommendElectronicTechniques} from '../planning/electronic-techniques.js';
import {buildElectronicCompositionBlueprint,locateBlueprintSection} from '../planning/electronic-blueprint.js';
import type {PlannedSongSection} from '../planning/electronic-blueprint.js';
import type {ElectronicStyle,TechniqueId,TechniquePlan,TechniqueRequest} from '../planning/electronic-techniques.js';
import type {HarmonyPlan,PlanFinding} from '../planning/harmony-plan.js';
import type {ArrangementAssessment} from '../evaluation/arrangement.js';
import {createArrangementEditingContext} from './editing-context.js';
import type {ArrangementEditingContext,ArrangementEditingIntent} from './editing-context.js';
import type {ChangeSet,MidiNote,MusicProject,MusicTrack,NoteOperation} from '@ai-composer/music-core';

export const ARRANGEMENT_ROLES=['harmony','bass','accompaniment'] as const;
export type ArrangementRole=typeof ARRANGEMENT_ROLES[number];
export interface ArrangementRequest {
 readonly project:MusicProject;
 readonly sourceTrackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
 readonly plan?:HarmonyPlan;
 readonly seed?:number;
 /** Explicit electronic style enables strong, editable technique defaults. */
 readonly electronicStyle?:ElectronicStyle;
 readonly disabledTechniques?:readonly TechniqueId[];
 readonly forcedTechniques?:readonly TechniqueId[];
 readonly editing?:ArrangementEditingIntent;
}
export interface ArrangementContext {
 readonly sourceTrackId:string;
 readonly ppq:number;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
 readonly sourceNotes:readonly MidiNote[];
 readonly neighborNotes:readonly MidiNote[];
 readonly plan?:HarmonyPlan;
 readonly seed?:number;
 readonly techniquePlan?:TechniquePlan;
 readonly techniqueRequest?:TechniqueRequest;
 readonly sectionGuidance?:Pick<PlannedSongSection,'kind'|'motifId'|'motifAction'|'energy'|'instruction'|'startTick'|'endTick'>;
 readonly editing?:ArrangementEditingContext;
 /** Hypotheses from source MIDI; never hard constraints or ground truth. */
 readonly tonalProfile?:TonalProfile;
 readonly chordSuggestions?:readonly ChordSuggestion[];
}
export interface ArrangementProvider {
 readonly id:string;
 generate(context:ArrangementContext,signal?:AbortSignal):Promise<unknown>;
}
export interface ArrangementCandidate {
 readonly providerId:string;
 readonly label:string;
 readonly sourceTrackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly seed?:number;
 readonly tracks:readonly MusicTrack[];
 readonly assessment:ArrangementAssessment;
 readonly plan?:HarmonyPlan;
 readonly planFindings:readonly PlanFinding[];
 readonly techniquePlan?:TechniquePlan;
 readonly techniqueEvidence?:readonly TechniqueEvidence[];
 readonly changes:ChangeSet;
}
const NAMES:Record<ArrangementRole,string>={harmony:'AI 和声',bass:'AI 低音',accompaniment:'AI 伴奏'};
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
function parseArranged(raw:unknown,project:MusicProject,sourceTrackId:string,startTick:number,endTick:number):MusicTrack[]{
 if(!isObject(raw)||Object.keys(raw).some(k=>k!=='tracks')||!Array.isArray(raw.tracks)||raw.tracks.length!==ARRANGEMENT_ROLES.length)throw new Error('invalid_arrangement_output');
 const byRole=new Map<ArrangementRole,MusicTrack>();
 let total=0;
 for(const entry of raw.tracks as unknown[]){
  if(!isObject(entry)||Object.keys(entry).some(k=>k!=='role'&&k!=='notes')||!ARRANGEMENT_ROLES.includes(entry.role as ArrangementRole)||!Array.isArray(entry.notes))throw new Error('invalid_arrangement_track');
  const role=entry.role as ArrangementRole;
  if(byRole.has(role))throw new Error('duplicate_arrangement_role');
  if(entry.notes.length<1||entry.notes.length>64)throw new Error('invalid_arrangement_note_count');
  total+=entry.notes.length;
  if(total>128)throw new Error('too_many_arrangement_notes');
  const notes:MidiNote[]=[];
  for(const [index,rawNote] of (entry.notes as unknown[]).entries()){
   if(!isObject(rawNote)||Object.keys(rawNote).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))throw new Error('invalid_arrangement_note');
   const {pitch,startTick:tick,durationTicks,velocity}=rawNote;
   if(typeof pitch!=='number'||typeof tick!=='number'||typeof durationTicks!=='number'||typeof velocity!=='number')throw new Error('invalid_arrangement_note');
   const note:MidiNote={noteId:`arrange-${project.revision}-${sourceTrackId}-${startTick}-${role}-${index}`,pitch,startTick:tick,durationTicks,velocity};
   if(!validateNote(note))throw new Error('invalid_arrangement_note');
   if(note.startTick<startTick||note.startTick+note.durationTicks>endTick)throw new Error('arrangement_note_outside_scope');
   notes.push(note);
  }
  const trackId=`arrange-${project.revision}-${sourceTrackId}-${startTick}-${role}`;
  if(project.tracks.some(t=>t.trackId===trackId))throw new Error('arrangement_track_collision');
  byRole.set(role,{trackId,name:NAMES[role],locked:false,notes});
 }
 if(byRole.size!==ARRANGEMENT_ROLES.length)throw new Error('missing_arrangement_role');
 return ARRANGEMENT_ROLES.map(role=>byRole.get(role)!);
}
/** Shared preflight for whole-arrangement and one-role scoped proposals. */
export function prepareArrangementContext(request:ArrangementRequest):ArrangementContext{
 const {project,sourceTrackId,startTick,endTick,instruction}=request;
 if(!validateProject(project))throw new Error('invalid_project');
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||startTick<0||endTick<=startTick||endTick-startTick>ticksPerBar(project.ppq,resolveMeter(project))*4)throw new Error('invalid_arrangement_scope');
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>2000)throw new Error('invalid_instruction');
 if(request.seed!==undefined&&(!Number.isSafeInteger(request.seed)||request.seed<0||request.seed>0xffffffff))throw new Error('invalid_arrangement_seed');
 // Validate before sending user-supplied planning data to any provider.
 const barTicks=ticksPerBar(project.ppq,resolveMeter(project));
 if(request.plan!==undefined&&(resolveMeter(project).numerator!==4||resolveMeter(project).denominator!==4))
  throw new Error('legacy_harmony_plan_requires_4_4');
 const barCount=Math.ceil((endTick-startTick)/barTicks);
 const plan=request.plan===undefined?undefined:validateHarmonyPlan(request.plan,barCount);
 if(plan&&(startTick%barTicks!==0||endTick%barTicks!==0))throw new Error('plan_requires_whole_bars');
 const source=project.tracks.find(t=>t.trackId===sourceTrackId);
 if(!source)throw new Error('source_track_not_found');
 // Source notes are read-only, even if the source track itself is locked.
 const selected=source.notes.filter(n=>n.startTick<endTick&&n.startTick+n.durationTicks>startTick);
 if(!selected.length)throw new Error('empty_source_range');
 if(selected.length>64)throw new Error('source_range_too_dense');
 const neighborNotes=source.notes.filter(n=>!(n.startTick<endTick&&n.startTick+n.durationTicks>startTick))
  .sort((a,b)=>Math.abs(a.startTick-startTick)-Math.abs(b.startTick-startTick)).slice(0,16);
 const tonalProfile=analyzeTonality(selected,startTick,endTick);
 const chordSuggestions=suggestChords(selected,startTick,endTick,project.ppq);
 const editing=request.editing===undefined?undefined:
  createArrangementEditingContext(project,sourceTrackId,request.editing,startTick,endTick);
 if(request.electronicStyle===undefined&&
  (request.disabledTechniques!==undefined||request.forcedTechniques!==undefined))throw new Error('electronic_style_required');
 const techniqueRequest:TechniqueRequest|undefined=request.electronicStyle===undefined?undefined:
  {style:request.electronicStyle,seed:request.seed??19501,
   ...(request.disabledTechniques!==undefined?{disabled:request.disabledTechniques}:{}),
   ...(request.forcedTechniques!==undefined?{forced:request.forcedTechniques}:{})};
 const techniquePlan=techniqueRequest?recommendElectronicTechniques(techniqueRequest):undefined;
 let sectionGuidance:ArrangementContext['sectionGuidance'];
 if(techniqueRequest&&startTick%barTicks===0){
  const cycle=16*barTicks;
  const cycleStart=Math.floor(startTick/cycle)*cycle;
  const blueprint=buildElectronicCompositionBlueprint({
   project,style:techniqueRequest.style,seed:techniqueRequest.seed,startTick:cycleStart,bars:16
  });
  try{
   const section=locateBlueprintSection(blueprint,startTick,endTick);
   sectionGuidance={kind:section.kind,motifId:section.motifId,motifAction:section.motifAction,
    energy:section.energy,instruction:section.instruction,startTick:section.startTick,endTick:section.endTick};
  }catch(error){
   if(!(error instanceof Error)||error.message!=='blueprint_window_crosses_section')throw error;
   // Future segmentation may split this scope; never claim one section applies to two.
  }
 }
 const context:ArrangementContext={sourceTrackId,ppq:project.ppq,startTick,endTick,instruction,
  sourceNotes:selected.map(n=>({...n})),neighborNotes:neighborNotes.map(n=>({...n})),tonalProfile,chordSuggestions,plan,seed:request.seed,editing,techniquePlan,techniqueRequest,sectionGuidance};
 return context;
}

export async function proposeArrangement(provider:ArrangementProvider,request:ArrangementRequest,signal?:AbortSignal):Promise<ArrangementCandidate>{
 const context=prepareArrangementContext(request);
 const {project,sourceTrackId,startTick,endTick}=request;
 const {plan}=context;
 const selected=context.sourceNotes;
 const raw=await provider.generate(context,signal);
 if(signal?.aborted)throw new Error('generation_cancelled');
 const parsed=parseArranged(raw,project,sourceTrackId,startTick,endTick);
 // Only explicit electronic-style sessions assign audible General MIDI role presets.
 // The LLM cannot choose arbitrary sound assets, synth code, instrument paths or plugins.
 const tracks=request.electronicStyle?
  parsed.map((track,index)=>({...track,program:index===0?89:index===1?38:81})):
  parsed;
 const planFindings=plan?checkHarmonyPlan(plan,tracks,startTick,endTick,project.ppq):[];
 const operations:NoteOperation[]=tracks.map(track=>({type:'add_track',track}));
 const changes:ChangeSet={baseRevision:project.revision,operations};
 const dryRun=applyChangeSet(project,changes);
 if(!dryRun.ok)throw new Error(`candidate_rejected:${dryRun.reason}`);
 // The proposal does not write the project. Approval must still pass a revision check.
 const assessment=evaluateArrangement(selected,tracks,startTick,endTick,project.ppq);
 return {providerId:provider.id,label:`${provider.id} · 三轨编配候选`,sourceTrackId,startTick,endTick,seed:request.seed,tracks,assessment,plan,planFindings,techniquePlan:context.techniquePlan,
  techniqueEvidence:context.techniquePlan?evaluateTechniqueEvidence(context.techniquePlan,tracks,project.ppq):undefined,changes};
}
