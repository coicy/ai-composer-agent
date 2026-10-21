import type {MidiNote} from '@ai-composer/music-core';

/** Coordinates are local to the scrollable note grid, never client viewport coordinates. */
export interface GridPoint {readonly x:number;readonly y:number;}
export interface GridRect {readonly left:number;readonly right:number;readonly top:number;readonly bottom:number;}
export interface PianoRollGeometry {readonly topPitch:number;readonly rowHeight:number;readonly pixelsPerQuarter:number;readonly ppq:number;}
export interface NoteTimeRange {readonly startTick:number;readonly endTick:number;}
export function rectangleBetween(a:GridPoint,b:GridPoint):GridRect {
 return {left:Math.max(0,Math.min(a.x,b.x)),right:Math.max(0,Math.max(a.x,b.x)),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
}
export function selectNotesInRect(notes:readonly MidiNote[],rect:GridRect,g:PianoRollGeometry):string[]{
 if(!Number.isFinite(g.ppq)||g.ppq<=0||!Number.isFinite(g.pixelsPerQuarter)||g.pixelsPerQuarter<=0||!Number.isFinite(g.rowHeight)||g.rowHeight<=0)throw new Error('invalid_piano_roll_geometry');
 return notes.filter(note=>{
  const left=note.startTick/g.ppq*g.pixelsPerQuarter;
  const right=(note.startTick+note.durationTicks)/g.ppq*g.pixelsPerQuarter;
  const top=(g.topPitch-note.pitch)*g.rowHeight;
  const bottom=top+g.rowHeight;
  return left<rect.right&&right>rect.left&&top<rect.bottom&&bottom>rect.top;
 }).map(n=>n.noteId);
}
export function timeRangeOfSelectedNotes(notes:readonly MidiNote[],ids:readonly string[]):NoteTimeRange|null {
 if(ids.length===0)return null;
 const selected=new Set(ids);
 const found=notes.filter(n=>selected.has(n.noteId));
 if(found.length!==selected.size)throw new Error('selected_note_not_found');
 return {startTick:Math.min(...found.map(n=>n.startTick)),endTick:Math.max(...found.map(n=>n.startTick+n.durationTicks))};
}
