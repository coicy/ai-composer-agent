import type {MusicProject,ChangeSet,MidiNote,NoteOperation} from '@ai-composer/music-core';
import type {MelodyCandidate,MelodyStyle} from './melody.js';
export interface ContinueRequest {readonly project:MusicProject;readonly trackId:string;readonly bars:number;readonly style:MelodyStyle;readonly seed:number;}
const scale=[0,2,4,5,7,9,11];
function degreeFor(pitch:number){let best=0,dist=Infinity;for(let d=0;d<14;d++){const candidate=60+scale[d%7]!+12*Math.floor(d/7);const diff=Math.abs(pitch-candidate);if(diff<dist){dist=diff;best=d;}}return best;}
export function continueMelody(request:ContinueRequest):MelodyCandidate {
 const {project,trackId,bars,style,seed}=request;
 if(!Number.isSafeInteger(bars)||bars<1||bars>16||!Number.isSafeInteger(seed)||!Number.isSafeInteger(project.ppq)||project.ppq<=0||project.ppq%2!==0)throw new Error('invalid_continuation_parameters');
 const track=project.tracks.find(t=>t.trackId===trackId);
 if(!track)throw new Error('track_not_found');
 if(track.locked)throw new Error('track_locked');
 const ends=track.notes.map(n=>n.startTick+n.durationTicks);
 if(ends.length===0)throw new Error('no_context_notes');
 const lastEnd=Math.max(...ends),barTicks=project.ppq*4;
 const start=Math.ceil(lastEnd/barTicks)*barTicks;
 const history=[...track.notes].filter(n=>n.startTick<start).sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
 const latest=history.at(-1)!;
 const motif=history.slice(-Math.min(8,history.length)).map(n=>degreeFor(n.pitch));
 let degree=degreeFor(latest.pitch),state=seed>>>0;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const step=project.ppq/2,notes:MidiNote[]=[];
 for(let i=0;i<bars*8;i++){
  if(style==='motif')degree=motif[i%motif.length]!;
  else degree=Math.max(0,Math.min(13,degree+(rand()>.5?1:-1)*(style==='leaps'?2:1)));
  const pitch=60+scale[degree%7]!+12*Math.floor(degree/7);
  notes.push({noteId:`continued-${seed}-${trackId}-${start}-${style}-${i}`,pitch,startTick:start+i*step,durationTicks:step,velocity:75+Math.floor(rand()*24)});
 }
 const operations:NoteOperation[]=notes.map(note=>({type:'add_note',trackId,note}));
 const changes:ChangeSet={baseRevision:project.revision,operations};
 return {label:`continue ${style} · bar ${start/barTicks+1}`,notes,changes};
}
