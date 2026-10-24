import {applyChangeSet,validateProject,validateNote} from '@ai-composer/music-core';
import type {MusicProject,MusicTrack,MidiNote,ChangeSet} from '@ai-composer/music-core';
import type {ElectronicStyle} from '../planning/electronic-techniques.js';
export interface DrumRequest {
 readonly project:MusicProject;readonly style:ElectronicStyle;
 readonly startTick:number;readonly endTick:number;readonly seed:number;
 readonly instruction:string; readonly sourceTrackId?:string;
}
export interface DrumContext {
 readonly style:ElectronicStyle;readonly startTick:number;readonly endTick:number;
 readonly ppq:number;readonly seed:number;readonly instruction:string;
 readonly requiredKickBeats:readonly number[];
 readonly sourceNotes:readonly MidiNote[];
}
export interface DrumProvider {readonly id:string;generateDrums(context:DrumContext,signal?:AbortSignal):Promise<unknown>;}
export interface DrumEvidence {readonly status:'observed'|'not_observed'|'not_evaluable';readonly kickCount:number;readonly expectedCount:number;readonly missingBeats:readonly number[];}
export interface DrumCandidate {readonly track:MusicTrack;readonly changes:ChangeSet;readonly evidence:DrumEvidence;readonly providerId:string;}
const floorStyles:readonly ElectronicStyle[]=['house','techno','trance'];
const isObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export function prepareDrumContext(r:DrumRequest):DrumContext{
 if(!validateProject(r.project)||!Number.isSafeInteger(r.seed)||r.seed<0||r.seed>0xffffffff||
  !Number.isSafeInteger(r.startTick)||!Number.isSafeInteger(r.endTick)||r.startTick<0||r.endTick<=r.startTick||
  r.endTick-r.startTick>r.project.ppq*16||typeof r.instruction!=='string'||!r.instruction.trim()||r.instruction.length>2000||
  !['house','techno','trance','synthwave','drum_and_bass','ambient','chiptune'].includes(r.style))
  throw Error('invalid_drum_request');
 const source=r.sourceTrackId===undefined?undefined:r.project.tracks.find(t=>t.trackId===r.sourceTrackId);
 if(r.sourceTrackId!==undefined&&!source)throw Error('drum_source_not_found');
 const requiredKickBeats:number[]=[];
 // Quarter-note beat placement is deliberate for explicitly selected 4/4 dance styles.
 const meter=r.project.meter??{numerator:4,denominator:4};
 if(floorStyles.includes(r.style)&&meter.numerator===4&&meter.denominator===4){
  for(let tick=r.startTick;tick<r.endTick;tick+=r.project.ppq)requiredKickBeats.push(tick);
 }
 return {style:r.style,startTick:r.startTick,endTick:r.endTick,ppq:r.project.ppq,seed:r.seed,instruction:r.instruction,
  requiredKickBeats,sourceNotes:source?source.notes.filter(n=>n.startTick<r.endTick&&n.startTick+n.durationTicks>r.startTick).map(n=>({...n})):[]};
}
export function checkDrumEvidence(context:DrumContext,notes:readonly MidiNote[]):DrumEvidence{
 const kicks=new Set(notes.filter(n=>n.pitch===35||n.pitch===36).map(n=>n.startTick));
 const missing=context.requiredKickBeats.filter(t=>!kicks.has(t));
 return {status:context.requiredKickBeats.length===0?'not_evaluable':missing.length?'not_observed':'observed',
  kickCount:kicks.size,expectedCount:context.requiredKickBeats.length,missingBeats:missing};
}
/** Independent, review-only drum lane. Provider returns notes; it cannot choose track metadata or permissions. */
export async function proposeDrumCandidate(provider:DrumProvider,r:DrumRequest,signal?:AbortSignal):Promise<DrumCandidate>{
 const context=prepareDrumContext(r);
 const raw=await provider.generateDrums(context,signal);
 if(signal?.aborted)throw Error('generation_cancelled');
 if(!isObj(raw)||Object.keys(raw).some(k=>k!=='notes')||!Array.isArray(raw.notes)||
  raw.notes.length<1||raw.notes.length>128)throw Error('invalid_drum_output');
 const permitted=new Set([35,36,38,40,42,44,46,49,51]);
 const notes:MidiNote[]=raw.notes.map((x:unknown,i:number)=>{
  if(!isObj(x)||Object.keys(x).some(k=>!['pitch','startTick','durationTicks','velocity'].includes(k)))throw Error('invalid_drum_note');
  const n={noteId:`drum-${r.project.revision}-${r.startTick}-${i}`,pitch:x.pitch,startTick:x.startTick,durationTicks:x.durationTicks,velocity:x.velocity} as MidiNote;
  if(!validateNote(n)||!permitted.has(n.pitch)||n.startTick<context.startTick||n.startTick+n.durationTicks>context.endTick)
   throw Error('invalid_drum_note');
  return n;
 });
 const trackId=`drum-${r.project.revision}-${r.startTick}`;
 if(r.project.tracks.some(t=>t.trackId===trackId))throw Error('drum_track_collision');
 const track:MusicTrack={trackId,name:'AI Drums',locked:false,isDrum:true,channel:9,notes};
 const changes:ChangeSet={baseRevision:r.project.revision,operations:[{type:'add_track',track}]};
 const dry=applyChangeSet(r.project,changes);
 if(!dry.ok)throw Error(`candidate_rejected:${dry.reason}`);
 return {track,changes,evidence:checkDrumEvidence(context,notes),providerId:provider.id};
}
