import type {MidiNote,MusicProject} from '../model/types.js';
const integer=(n:number)=>Number.isSafeInteger(n);
export function validateNote(n:MidiNote):boolean {
 return typeof n.noteId==='string'&&n.noteId.length>0&&integer(n.pitch)&&n.pitch>=0&&n.pitch<=127&&integer(n.startTick)&&n.startTick>=0&&integer(n.durationTicks)&&n.durationTicks>0&&integer(n.velocity)&&n.velocity>=1&&n.velocity<=127&&(n.locked===undefined||typeof n.locked==='boolean');
}
export function validateProject(p:MusicProject):boolean {
 return typeof p.projectId==='string'&&p.projectId.length>0&&integer(p.revision)&&p.revision>=0&&integer(p.ppq)&&p.ppq>0&&Array.isArray(p.tracks)&&new Set(p.tracks.map(t=>t.trackId)).size===p.tracks.length&&p.tracks.every(t=>typeof t.trackId==='string'&&t.trackId.length>0&&typeof t.name==='string'&&typeof t.locked==='boolean'&&Array.isArray(t.notes)&&new Set(t.notes.map(n=>n.noteId)).size===t.notes.length&&t.notes.every(validateNote));
}
