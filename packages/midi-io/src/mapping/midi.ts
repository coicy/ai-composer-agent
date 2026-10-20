import {Midi} from '@tonejs/midi';
import {validateProject} from '@ai-composer/music-core';
import type {MusicProject,MusicTrack,MidiNote} from '@ai-composer/music-core';
const MAX_BYTES=8_000_000,MAX_TRACKS=128,MAX_NOTES=200_000;
export function exportMidi(project:MusicProject):Uint8Array{
 if(!validateProject(project))throw new Error('invalid_project');
 if(project.tracks.length>MAX_TRACKS)throw new Error('too_many_tracks');
 const midi=new Midi();const tickScale=midi.header.ppq/project.ppq;
 midi.header.setTempo(120);midi.header.update();
 for(const item of project.tracks){
  const track=midi.addTrack();track.name=item.name;
  for(const note of item.notes)track.addNote({midi:note.pitch,ticks:Math.round(note.startTick*tickScale),durationTicks:Math.max(1,Math.round(note.durationTicks*tickScale)),velocity:note.velocity/127});
 }
 return midi.toArray();
}
export function importMidi(bytes:Uint8Array):MusicProject{
 if(bytes.byteLength>MAX_BYTES)throw new Error('midi_too_large');
 const midi=new Midi(bytes);
 if(midi.tracks.length>MAX_TRACKS)throw new Error('too_many_tracks');
 const tracks:MusicTrack[]=[];
 let count=0;
 for(const source of midi.tracks){
  const notes:MidiNote[]=[];
  for(const n of source.notes){
   if(++count>MAX_NOTES)throw new Error('too_many_notes');
   notes.push({noteId:crypto.randomUUID(),pitch:n.midi,startTick:Math.round(n.ticks),durationTicks:Math.max(1,Math.round(n.durationTicks)),velocity:Math.max(1,Math.min(127,Math.round(n.velocity*127)))});
  }
  tracks.push({trackId:crypto.randomUUID(),name:source.name||`Track ${tracks.length+1}`,locked:false,notes});
 }
 const project:MusicProject={projectId:crypto.randomUUID(),revision:0,ppq:midi.header.ppq,tracks:tracks.length?tracks:[{trackId:crypto.randomUUID(),name:'Track 1',locked:false,notes:[]}]};
 if(!validateProject(project))throw new Error('invalid_midi_data');
 return project;
}