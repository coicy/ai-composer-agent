import {Midi} from '@tonejs/midi';
import {effectiveTempos,effectiveMeters,validateProject} from '@ai-composer/music-core';
import type {MusicProject,MusicTrack,MidiNote,TrackInstrument} from '@ai-composer/music-core';

const MAX_BYTES=8_000_000,MAX_TRACKS=128,MAX_NOTES=200_000;
/**
 * Standard MIDI stores tempo/meter meta-events and program/channel state.
 * Track locks, user approval and effect/preset data are NOT encoded in MIDI.
 */
export function exportMidi(project:MusicProject):Uint8Array{
 if(!validateProject(project))throw new Error('invalid_project');
 if(project.tracks.length>MAX_TRACKS)throw new Error('too_many_tracks');
 const midi=new Midi();
 const scale=midi.header.ppq/project.ppq;
 midi.header.tempos=effectiveTempos(project).map(t=>({ticks:Math.round(t.tick*scale),bpm:t.bpm}));
 midi.header.timeSignatures=effectiveMeters(project).map(m=>({
  ticks:Math.round(m.tick*scale),timeSignature:[m.numerator,m.denominator]
 }));
 midi.header.update();
 let melodicIndex=0;
 for(const item of project.tracks){
  const track=midi.addTrack();
  track.name=item.name;
  if(item.instrument){
   track.channel=item.instrument.channel;
   track.instrument.number=item.instrument.program;
  }else{
   // Avoid the GM percussion channel 10 (index 9) for legacy melodic tracks.
   track.channel=melodicIndex%15;
   if(track.channel>=9)track.channel++;
   melodicIndex++;
  }
  for(const note of item.notes)track.addNote({
   midi:note.pitch,ticks:Math.round(note.startTick*scale),
   durationTicks:Math.max(1,Math.round(note.durationTicks*scale)),
   velocity:note.velocity/127
  });
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
   notes.push({
    noteId:crypto.randomUUID(),pitch:n.midi,
    startTick:Math.round(n.ticks),
    durationTicks:Math.max(1,Math.round(n.durationTicks)),
    velocity:Math.max(1,Math.min(127,Math.round(n.velocity*127)))
   });
  }
  const channel=source.channel;
  // MIDI channel numbers in Tonejs/Midi are zero-based, drums use index 9.
  const instrument:TrackInstrument={
   kind:channel===9?'drums':'melodic',
   program:source.instrument.number,
   channel
  };
  tracks.push({
   trackId:crypto.randomUUID(),name:source.name||'Track '+(tracks.length+1),
   locked:false,instrument,notes
  });
 }
 const tempos=midi.header.tempos.map(t=>({tick:Math.round(t.ticks),bpm:t.bpm}));
 const meters=midi.header.timeSignatures.map(t=>({
  tick:Math.round(t.ticks),numerator:t.timeSignature[0]!,denominator:t.timeSignature[1]!
 }));
 // Many SMFs omit initial values; synthesize only the standard defaults, while
 // keeping explicit subsequent changes.
 const tempoMap=tempos.length===0?[{tick:0,bpm:120}]:
  tempos[0]!.tick===0?tempos:[{tick:0,bpm:120},...tempos];
 const meterMap=meters.length===0?[{tick:0,numerator:4,denominator:4}]:
  meters[0]!.tick===0?meters:[{tick:0,numerator:4,denominator:4},...meters];
 const project:MusicProject={
  projectId:crypto.randomUUID(),revision:0,ppq:midi.header.ppq,tempoMap,meterMap,
  tracks:tracks.length?tracks:[{trackId:crypto.randomUUID(),name:'Track 1',locked:false,notes:[]}]
 };
 if(!validateProject(project))throw new Error('invalid_midi_data');
 return project;
}
