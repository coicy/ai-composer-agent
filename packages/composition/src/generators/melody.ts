import type {MusicProject,ChangeSet,MidiNote,NoteOperation} from '@ai-composer/music-core';
export type MelodyStyle='steps'|'leaps'|'motif';
export interface MelodyRequest {readonly project:MusicProject;readonly trackId:string;readonly startBar:number;readonly bars:number;readonly style:MelodyStyle;readonly seed:number;}
export interface MelodyCandidate {readonly label:string;readonly changes:ChangeSet;readonly notes:readonly MidiNote[];}
const scales=[0,2,4,5,7,9,11];
function random(seed:number){let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
export function composeMelody(request:MelodyRequest):MelodyCandidate{
 const {project,trackId,startBar,bars,style}=request;
 if(!Number.isSafeInteger(startBar)||startBar<0||!Number.isSafeInteger(bars)||bars<1||bars>16||!Number.isSafeInteger(request.seed))throw new Error('invalid_generation_parameters');
 const track=project.tracks.find(t=>t.trackId===trackId);
 if(!track)throw new Error('track_not_found');
 if(track.locked)throw new Error('track_locked');
 const barTicks=project.ppq*4,start=startBar*barTicks,end=start+bars*barTicks;
 const existing=track.notes.filter(n=>n.startTick<end&&n.startTick+n.durationTicks>start);
 if(existing.some(n=>n.locked))throw new Error('locked_note_in_range');
 if(existing.some(n=>n.startTick<start||n.startTick+n.durationTicks>end))throw new Error('cross_boundary_note');
 const rng=random(request.seed),notes:MidiNote[]=[];
 const step=project.ppq/2;
 if(!Number.isSafeInteger(step))throw new Error('unsupported_ppq');
 let degree=style==='leaps'?4:0;
 const motif=[0,2,4,2,1,3,2,0];
 for(let i=0;i<bars*8;i++){
  if(style==='motif')degree=motif[i%motif.length]!;
  else if(style==='leaps')degree=Math.max(0,Math.min(7,degree+(rng()>.5?2:-2)));
  else degree=Math.max(0,Math.min(7,degree+(rng()>.5?1:-1)));
  const pitch=60+scales[degree%7]!+(degree>=7?12:0);
  notes.push({noteId:`generated-${request.seed}-${trackId}-${startBar}-${style}-${i}`,pitch,startTick:start+i*step,durationTicks:step,velocity:75+Math.floor(rng()*24)});
 }
 const operations:NoteOperation[]=[...existing.map(n=>({type:'delete_note' as const,trackId,noteId:n.noteId})),...notes.map(note=>({type:'add_note' as const,trackId,note}))];
 return {label:`${style} · Seed ${request.seed}`,notes,changes:{baseRevision:project.revision,operations}};
}
