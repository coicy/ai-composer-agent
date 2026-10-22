import type {MidiNote,MusicProject,GenerationRecord} from '../model/types.js';
const integer=(n:number)=>Number.isSafeInteger(n);
export function validateNote(n:MidiNote):boolean {
 return typeof n.noteId==='string'&&n.noteId.length>0&&integer(n.pitch)&&n.pitch>=0&&n.pitch<=127&&integer(n.startTick)&&n.startTick>=0&&integer(n.durationTicks)&&n.durationTicks>0&&integer(n.velocity)&&n.velocity>=1&&n.velocity<=127&&(n.locked===undefined||typeof n.locked==='boolean');
}
export function validateGenerationRecord(record:GenerationRecord):boolean {
 if(!record||typeof record!=='object'||typeof record.recordId!=='string'||record.recordId.length<1||record.recordId.length>180||
  !['scoped','three_track'].includes(record.kind)||typeof record.sourceTrackId!=='string'||!record.sourceTrackId||
  !Array.isArray(record.targetTrackIds)||record.targetTrackIds.length!==(record.kind==='scoped'?1:3)||
  record.targetTrackIds.some(id=>typeof id!=='string'||!id)||
  new Set(record.targetTrackIds).size!==record.targetTrackIds.length||
  !integer(record.startTick)||record.startTick<0||!integer(record.endTick)||record.endTick<=record.startTick||
  typeof record.providerId!=='string'||!record.providerId||record.providerId.length>120||
  typeof record.instruction!=='string'||record.instruction.length>2000||
  (record.editConstraint!==undefined&&(record.kind!=='scoped'||record.editConstraint!=='pitch_only'))||
  (record.protectedPrefixCount!==undefined&&(!integer(record.protectedPrefixCount)||
   record.protectedPrefixCount<0||record.protectedPrefixCount>16))||
  (record.protectedNoteIds!==undefined&&(!Array.isArray(record.protectedNoteIds)||
   record.protectedNoteIds.length<1||record.protectedNoteIds.length>32||
   record.protectedNoteIds.some(id=>typeof id!=='string'||!id||id.length>180)||
   new Set(record.protectedNoteIds).size!==record.protectedNoteIds.length))||
  (record.maxLeapSemitones!==undefined&&(!integer(record.maxLeapSemitones)||
   record.maxLeapSemitones<1||record.maxLeapSemitones>24))||
  (record.editConstraint!=='pitch_only'&&
   (record.protectedPrefixCount!==undefined||record.protectedNoteIds!==undefined||record.maxLeapSemitones!==undefined))||
  (record.seed!==undefined&&(!integer(record.seed)||record.seed<0||record.seed>0xffffffff)))return false;
 if(record.seedsByRole!==undefined){
  const seeds=record.seedsByRole;
  if(!seeds||typeof seeds!=='object'||Array.isArray(seeds)||
   Object.keys(seeds).length!==3||
   !['harmony','bass','accompaniment'].every(k=>{const n=seeds[k];return typeof n==='number'&&integer(n)&&n>=0&&n<=0xffffffff;}))
   return false;
 }
 if(record.planJson!==undefined){
  if(typeof record.planJson!=='string'||record.planJson.length>16000)return false;
  try{const p=JSON.parse(record.planJson) as unknown;if(!p||typeof p!=='object'||Array.isArray(p))return false;}
  catch{return false;}
 }
 return true;
}
export function validateProject(p:MusicProject):boolean {
 return !!p&&typeof p.projectId==='string'&&p.projectId.length>0&&integer(p.revision)&&p.revision>=0&&integer(p.ppq)&&p.ppq>0&&Array.isArray(p.tracks)&&new Set(p.tracks.map(t=>t.trackId)).size===p.tracks.length&&p.tracks.every(t=>typeof t.trackId==='string'&&t.trackId.length>0&&typeof t.name==='string'&&typeof t.locked==='boolean'&&Array.isArray(t.notes)&&new Set(t.notes.map((n:MidiNote)=>n.noteId)).size===t.notes.length&&t.notes.every(validateNote))&&
 (p.generationHistory===undefined||(Array.isArray(p.generationHistory)&&p.generationHistory.length<=128&&
  new Set(p.generationHistory.map((r:GenerationRecord)=>r?.recordId)).size===p.generationHistory.length&&
  p.generationHistory.every((r:GenerationRecord)=>validateGenerationRecord(r)&&p.tracks.some(t=>t.trackId===r.sourceTrackId)&&r.targetTrackIds.every((id:string)=>p.tracks.some(t=>t.trackId===id)))));
}
