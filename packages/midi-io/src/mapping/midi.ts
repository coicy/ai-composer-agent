import {Midi} from '@tonejs/midi';
import {validateProject,resolveTempoBpm,resolveMeter} from '@ai-composer/music-core';
import type {MusicProject,MusicTrack,MidiNote,Meter} from '@ai-composer/music-core';
const MAX_BYTES=8_000_000,MAX_TRACKS=128,MAX_NOTES=200_000;
function getChannel(track:MusicTrack,index:number):number{
 if(track.isDrum)return 9;
 if(track.channel!==undefined)return track.channel;
 const channel=index%15;
 return channel>=9?channel+1:channel;
}
export function exportMidi(project:MusicProject):Uint8Array{
 if(!validateProject(project))throw new Error('invalid_project');
 if(project.tracks.length>MAX_TRACKS)throw new Error('too_many_tracks');
 const midi=new Midi();const tickScale=midi.header.ppq/project.ppq;
 midi.header.setTempo(resolveTempoBpm(project));
 const meter=resolveMeter(project);
 midi.header.timeSignatures=[{ticks:0,timeSignature:[meter.numerator,meter.denominator]}];
 midi.header.update();
 const usedPrograms=new Map<number,number>();
 for(const [index,item] of project.tracks.entries()){
  const channel=getChannel(item,index);
  const program=item.program??0;
  if(channel!==9){
   const existing=usedPrograms.get(channel);
   if(existing!==undefined&&existing!==program)throw new Error('midi_channel_program_conflict');
   usedPrograms.set(channel,program);
  }
  const track=midi.addTrack();track.name=item.name;track.channel=channel;
  track.instrument.number=program;
  for(const note of item.notes){
   track.addNote({
    midi:note.pitch,
    ticks:Math.round(note.startTick*tickScale),
    durationTicks:Math.max(1,Math.round(note.durationTicks*tickScale)),
    velocity:note.velocity/127
   });
  }
 }
 return midi.toArray();
}
export function importMidi(bytes:Uint8Array):MusicProject{
 if(bytes.byteLength>MAX_BYTES)throw new Error('midi_too_large');
 const midi=new Midi(bytes);
 if(midi.tracks.length>MAX_TRACKS)throw new Error('too_many_tracks');
 const tempos=midi.header.tempos;
 const meters=midi.header.timeSignatures;
 if(tempos.some(t=>t.ticks!==0)||tempos.length>1)throw new Error('unsupported_tempo_changes');
 if(meters.some(m=>m.ticks!==0)||meters.length>1)throw new Error('unsupported_meter_changes');
 const bpm=tempos[0]?.bpm??120;
 const rawMeter=meters[0]?.timeSignature??[4,4];
 const [numerator,denominator]=rawMeter;
 if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||
 numerator===undefined||denominator===undefined||
 numerator<1||numerator>12||![2,4,8,16].includes(denominator))
  throw new Error('unsupported_meter');
 const meter={numerator,denominator:denominator as Meter['denominator']};
 const tracks:MusicTrack[]=[];
 let count=0;
 for(const source of midi.tracks){
  const notes:MidiNote[]=[];
  for(const n of source.notes){
   if(++count>MAX_NOTES)throw new Error('too_many_notes');
   notes.push({
    noteId:crypto.randomUUID(),pitch:n.midi,startTick:Math.round(n.ticks),
    durationTicks:Math.max(1,Math.round(n.durationTicks)),
    velocity:Math.max(1,Math.min(127,Math.round(n.velocity*127)))
   });
  }
  tracks.push({
   trackId:crypto.randomUUID(),name:source.name||('Track '+(tracks.length+1)),locked:false,notes,
   program:source.instrument.number,channel:source.channel,isDrum:source.channel===9
  });
 }
 const project:MusicProject={
  projectId:crypto.randomUUID(),revision:0,ppq:midi.header.ppq,tempoBpm:bpm,
  meter,
  tracks:tracks.length?tracks:[{trackId:crypto.randomUUID(),name:'Track 1',locked:false,notes:[]}]
 };
 if(!validateProject(project))throw new Error('invalid_midi_data');
 return project;
}
