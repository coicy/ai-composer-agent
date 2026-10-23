import {applyChangeSet} from '@ai-composer/music-core';
import {drawMusicalInspiration} from '@ai-composer/composition';
import type {InspirationAxis,InspirationLevel} from '@ai-composer/composition';
import type {MusicProject} from '@ai-composer/music-core';
import {invokeReferenceTool} from './reference-catalog.js';
import {checkCandidate,explainSpec,parseMusicSpec} from './composition-constraints.js';
import type {CandidateNote} from './composition-constraints.js';

type Json=Record<string,unknown>;
const allowedBriefKeys=new Set([
 'sessionId','trackId','startTick','endTick','tonic','mode','meter','groove',
 'allowChromatic','strictGroove','usage','sourceStyle','pitched','instruction','referenceLimit',
 'inspirationSeed','inspirationLevel','inspirationFocus'
]);
const allowedDrawKeys=new Set([
 'sessionId','trackId','startTick','endTick','tonic','mode','meter','groove',
 'seed','level','focus'
]);
const allowedAssessKeys=new Set([
 'sessionId','trackId','baseRevision','startTick','endTick',
 'tonic','mode','meter','groove','allowChromatic','strictGroove','notes'
]);
function validateKeys(input:Json,allowed:Set<string>):void{
 if(Object.keys(input).some(x=>!allowed.has(x)))throw Error('unexpected_composition_field');
}
function boundedString(x:unknown,kind:string):string{
 if(typeof x!=='string'||x.length<1||x.length>2000)throw Error('invalid_'+kind);
 return x;
}
function positiveRevision(x:unknown):number{
 if(typeof x!=='number'||!Number.isSafeInteger(x)||x<0)throw Error('invalid_revision');
 return x;
}
function referenceSearch(raw:Json,meter:string){
 const query:Json={meter,limit:raw.referenceLimit===undefined?3:raw.referenceLimit};
 if(raw.usage!==undefined){
  if(!['town','battle','dungeon','narrative'].includes(String(raw.usage)))throw Error('invalid_usage');
  query.usage=raw.usage;
 }
 if(raw.sourceStyle!==undefined)query.sourceStyle=boundedString(raw.sourceStyle,'source_style');
 if(raw.pitched!==undefined){
  if(typeof raw.pitched!=='boolean')throw Error('invalid_pitched');
  query.pitched=raw.pitched;
 }
 if(query.limit!==undefined&&(typeof query.limit!=='number'||!Number.isSafeInteger(query.limit)||
  query.limit<1||query.limit>5))throw Error('invalid_reference_limit');
 return invokeReferenceTool('music.search_references',query) as {
  matchCount:number;results:{id:string;title:string;meter:unknown;tempo:unknown;
   sourceStyle:string|null;usage:string|null;license:string;credit:string;
   sourceGrooveClaim:{value:string;status:'source_declared';sourceEvidenceUrl:string}|null;
   rightsEvidenceUrl:string;sourceUrl:string;verifiedMode:string|null;
   verifiedGroove:string|null;}[]
 };
}

function inspirationFor(raw:Json,project:MusicProject,trackId:string,prefix:'draw'|'brief'){
 const seed=raw[prefix==='draw'?'seed':'inspirationSeed'];
 const level=raw[prefix==='draw'?'level':'inspirationLevel']??'balanced';
 const focus=raw[prefix==='draw'?'focus':'inspirationFocus'];
 if(seed===undefined)throw Error('inspiration_seed_required');
 const spec=parseMusicSpec(raw,project.ppq);
 return drawMusicalInspiration({
  seed:seed as number,level:level as InspirationLevel,ppq:project.ppq,
  meter:spec.meter,mode:spec.mode,groove:spec.groove,
  startTick:spec.startTick,endTick:spec.endTick,
  ...(focus!==undefined?{focus:focus as InspirationAxis[]}:{}),
  editableOtherTracks:project.tracks.filter(t=>t.trackId!==trackId&&!t.locked).length
 });
}

export const guidedTools=[
 {name:'music.draw_inspiration',
  description:'Draw versioned, seed-reproducible original musical idea cards for an authorized track. Read-only; LLM still composes notes. Never breaks hard MIDI constraints.',
  inputSchema:{type:'object',properties:{
   sessionId:{type:'string'},trackId:{type:'string'},
   seed:{type:'integer',minimum:0,maximum:4294967295},
   level:{type:'string',enum:['subtle','balanced','adventurous']},
   focus:{type:'array',minItems:1,maxItems:6,uniqueItems:true,items:{type:'string',
    enum:['rhythm','motif','harmony','texture','form','expression']}},
   startTick:{type:'integer'},endTick:{type:'integer'},tonic:{type:'integer',minimum:0,maximum:11},
   mode:{type:'string'},meter:{type:'string'},groove:{type:'string'}
  },required:['sessionId','trackId','seed','startTick','endTick','tonic','mode','meter','groove'],
  additionalProperties:false}},
 {name:'music.prepare_composition_brief',
  description:'Read a bounded MusicProject snapshot and locally licensed MIDI references, then assemble hard musical constraints, evidence-labeled references and a JSON candidate contract for an EXTERNAL general-purpose LLM. Never generates music or changes the project.',
  inputSchema:{type:'object',properties:{
   sessionId:{type:'string'},trackId:{type:'string'},
   startTick:{type:'integer'},endTick:{type:'integer'},tonic:{type:'integer',minimum:0,maximum:11},
   mode:{type:'string',enum:['ionian','aeolian','dorian','mixolydian','phrygian','lydian','locrian','major_pentatonic','minor_pentatonic']},
   meter:{type:'string'},groove:{type:'string',enum:['straight','swing','shuffle']},
   allowChromatic:{type:'boolean'},strictGroove:{type:'boolean'},usage:{type:'string',enum:['town','battle','dungeon','narrative']},
   sourceStyle:{type:'string'},pitched:{type:'boolean'},instruction:{type:'string'},
   referenceLimit:{type:'integer',minimum:1,maximum:5},
   inspirationSeed:{type:'integer',minimum:0,maximum:4294967295},
   inspirationLevel:{type:'string',enum:['subtle','balanced','adventurous']},
   inspirationFocus:{type:'array',minItems:1,maxItems:6,uniqueItems:true,items:{type:'string',
    enum:['rhythm','motif','harmony','texture','form','expression']}}
  },required:['sessionId','trackId','startTick','endTick','tonic','mode','meter','groove','instruction'],additionalProperties:false}},
 {name:'music.evaluate_composition_candidate',
  description:'Deterministically check external MIDI notes against user-stated tonic/mode, track scope, MIDI bounds and offbeat timing (no aesthetic claims), then dry-run valid notes via Music Core. Never applies them.',
  inputSchema:{type:'object',properties:{
   sessionId:{type:'string'},trackId:{type:'string'},baseRevision:{type:'integer'},
   startTick:{type:'integer'},endTick:{type:'integer'},tonic:{type:'integer',minimum:0,maximum:11},
   mode:{type:'string'},meter:{type:'string'},groove:{type:'string'},
   allowChromatic:{type:'boolean'},strictGroove:{type:'boolean'},
   notes:{type:'array',minItems:1,maxItems:64,items:{type:'object',properties:{
    pitch:{type:'integer'},startTick:{type:'integer'},durationTicks:{type:'integer'},velocity:{type:'integer'}
   },required:['pitch','startTick','durationTicks','velocity'],additionalProperties:false}}
  },required:['sessionId','trackId','baseRevision','startTick','endTick','tonic','mode','meter','groove','notes'],additionalProperties:false}}
] as const;

export function isGuidedTool(name:string):boolean{return guidedTools.some(tool=>tool.name===name);}

export function invokeGuidedTool(name:string,raw:Json,project:MusicProject){
 if(name==='music.draw_inspiration'){
  validateKeys(raw,allowedDrawKeys);
  const trackId=boundedString(raw.trackId,'track');
  const track=project.tracks.find(t=>t.trackId===trackId);
  if(!track)throw Error('track_not_found');
  if(track.locked)throw Error('locked_track');
  return {
   projectId:project.projectId,baseRevision:project.revision,trackId,
   approved:false,applied:false,
   inspiration:inspirationFor(raw,project,trackId,'draw'),
   warning:'Idea cards only, not MIDI generation and not user approval. No MusicProject changes.'
  };
 }
 if(name==='music.prepare_composition_brief'){
  validateKeys(raw,allowedBriefKeys);
  const trackId=boundedString(raw.trackId,'track');
  const track=project.tracks.find(t=>t.trackId===trackId);
  if(!track)throw Error('track_not_found');
  if(track.locked)throw Error('locked_track');
  const spec=parseMusicSpec(raw,project.ppq);
  if(raw.inspirationSeed===undefined&&(raw.inspirationLevel!==undefined||raw.inspirationFocus!==undefined))
   throw Error('inspiration_seed_required');
  const instruction=boundedString(raw.instruction,'instruction');
  const data=referenceSearch(raw,spec.meter);
  const existingNotes=track.notes.filter(n=>n.startTick<spec.endTick&&
   n.startTick+n.durationTicks>spec.startTick).slice(0,64);
  return {
   projectId:project.projectId,trackId,baseRevision:project.revision,
   taskType:'external_llm_midi_candidate_brief',
   userInstruction:instruction,
   constraints:explainSpec(spec),
   ...(raw.inspirationSeed!==undefined?{
    inspiration:inspirationFor(raw,project,trackId,'brief')
   }:{}),
   existingNotes,
   referenceMatchCount:data.matchCount,
   references:data.results.map(r=>({
    id:r.id,title:r.title,sourceStyle:r.sourceStyle,usage:r.usage,meter:r.meter,
    sourceGrooveClaim:r.sourceGrooveClaim,
    tempo:r.tempo,license:r.license,credit:r.credit,
    rightsEvidenceUrl:r.rightsEvidenceUrl,sourceUrl:r.sourceUrl,
    modeProof:r.verifiedMode===null?'not_verified':'expert_reviewed',
    grooveProof:r.verifiedGroove===null?'not_verified':'expert_reviewed'
   })),
   generator:'external_general_purpose_llm_only',
   candidateSubmission:{
    tool:'music.evaluate_composition_candidate',
    expectedNotesFields:['pitch','startTick','durationTicks','velocity'],
    scope:{startTick:spec.startTick,endTick:spec.endTick},
    baseRevision:project.revision,maxNotes:64,
    instructions:[
     'Compose NEW MIDI note candidates yourself; no model is hosted by this server.',
     'Treat user musical constraints as instructions, referenced MIDI as illustrative observations only.',
     'Use requested pitch classes and bounded integer ticks; do not copy complete melodies from reference tracks.',
     'If strictGroove is enabled, include at least two eighth-note offbeats near the user-specified position; this is a timing check, not a style certificate.',
     'Call evaluate_composition_candidate with these constraints, then inspect warnings/errors.',
     'This is an unapproved preview; never claim the active browser project was modified.'
    ]
   },
   caveats:[
    'Source style labels and measured groove features are not independently verified style or mode labels.',
    'Swing and shuffle require accent/phrase listening judgment beyond numeric offbeat position.',
    'Current MusicProject snapshot lacks a persisted meter/tempo map; meter is a user-declared composition target, not checked against playback metadata.',
    'No browser session is connected, and no edits or approvals can occur via this tool.'
   ]
  };
 }
 if(name==='music.evaluate_composition_candidate'){
  validateKeys(raw,allowedAssessKeys);
  const trackId=boundedString(raw.trackId,'track');
  const track=project.tracks.find(t=>t.trackId===trackId);
  if(!track)throw Error('track_not_found');
  if(track.locked)throw Error('locked_track');
  const rev=positiveRevision(raw.baseRevision);
  if(rev!==project.revision)throw Error('stale_revision');
  const spec=parseMusicSpec(raw,project.ppq);
  const notes=raw.notes;
  if(!Array.isArray(notes)||notes.length<1||notes.length>64)throw Error('invalid_notes');
  const parsed:CandidateNote[]=notes.map(x=>{
   if(!x||typeof x!=='object'||Array.isArray(x))throw Error('invalid_notes');
   const obj=x as Json;
   if(Object.keys(obj).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k))||
    Object.keys(obj).length!==4)throw Error('unexpected_note_field');
   return obj as CandidateNote;
  });
  const analysis=checkCandidate(parsed,spec);
  let previewRevision:number|null=null;
  let reason:string|null=null;
  if(analysis.passed){
   const operations=parsed.map((n,i)=>({
    type:'add_note' as const,trackId,
    note:{...n,noteId:'guided-preview-'+i}
   }));
   const outcome=applyChangeSet(project,{baseRevision:project.revision,operations});
   if(outcome.ok)previewRevision=outcome.project.revision;
   else reason=outcome.reason;
  }
  return {
   projectId:project.projectId,trackId,baseRevision:rev,
   passed:analysis.passed&&previewRevision!==null,
   diagnostics:reason?[...analysis.diagnostics,{code:'music_core_rejected',severity:'error',
    detail:reason}]:analysis.diagnostics,
   modeEvidence:analysis.modeEvidence,grooveEvidence:analysis.grooveEvidence,
   constraints:analysis.constraints,notes:parsed,
   previewRevision,approved:false,applied:false,
   warning:'Dry-run only. A pitch-class match does NOT verify a musical mode, and an offbeat phase match does NOT prove groove feel. No browser changes applied.'
  };
 }
 throw Error('unknown_guided_tool');
}
