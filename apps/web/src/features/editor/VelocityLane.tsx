import {useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {MidiNote} from '@ai-composer/music-core';

const HEIGHT=112;
interface DragState {readonly ids:readonly string[];readonly velocity:number;}
interface Props {
 readonly notes:readonly MidiNote[];
 readonly selectedIds:readonly string[];
 readonly activeId:string|null;
 readonly ppq:number;
 readonly pixelsPerQuarter:number;
 readonly width:number;
 readonly scrollLeft:number;
 readonly onChange:(ids:readonly string[],velocity:number)=>void;
}
function velocityAtY(y:number):number{
 return Math.max(1,Math.min(127,Math.round((1-Math.max(0,Math.min(HEIGHT,y))/HEIGHT)*126)+1));
}
export function VelocityLane({notes,selectedIds,activeId,ppq,pixelsPerQuarter,width,scrollLeft,onChange}:Props){
 const drag=useRef<DragState|null>(null);
 const [draft,setDraft]=useState<DragState|null>(null);
 function readValue(e:ReactPointerEvent<HTMLDivElement>){
  const rect=e.currentTarget.getBoundingClientRect();
  return velocityAtY(e.clientY-rect.top);
 }
 function pointerDown(e:ReactPointerEvent<HTMLDivElement>){
  const target=(e.target as HTMLElement).closest<HTMLElement>('[data-note-id]');
  const id=target?.dataset.noteId;
  if(!id||e.button!==0)return;
  const chosen=notes.find(n=>n.noteId===id);
  if(!chosen)return;
  e.preventDefault();
  const ids=selectedIds.includes(id)?[...selectedIds]:[id];
  const value={ids,velocity:readValue(e)};
  drag.current=value;setDraft(value);
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function pointerMove(e:ReactPointerEvent<HTMLDivElement>){
  if(!drag.current)return;
  const value={ids:drag.current.ids,velocity:readValue(e)};
  drag.current=value;setDraft(value);
 }
 function pointerUp(e:ReactPointerEvent<HTMLDivElement>){
  const current=drag.current;if(!current)return;
  const next={...current,velocity:readValue(e)};
  drag.current=null;setDraft(null);
  onChange(next.ids,next.velocity);
 }
 function pointerCancel(){drag.current=null;setDraft(null);}
 return <section className="velocity-lane" aria-label="Velocity 力度编辑区">
  <div className="velocity-heading"><strong>Velocity</strong><span>拖动力度柱顶端，修改选中音符力度（1–127）</span></div>
  <div className="velocity-view">
   <div className="velocity-axis"><span>127</span><span>64</span><span>1</span></div>
   <div className="velocity-window">
    <div className="velocity-plot" style={{width,height:HEIGHT,transform:`translateX(-${scrollLeft}px)`}}
     onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}>
     {notes.map(n=>{
      const affected=!!draft?.ids.includes(n.noteId);
      const velocity=affected?draft.velocity:n.velocity;
      return <div key={n.noteId} className={'velocity-bar'+(selectedIds.includes(n.noteId)||activeId===n.noteId?' is-selected':'')}
       data-note-id={n.noteId} role="slider" aria-label={`音符力度 ${n.pitch} @ ${n.startTick}`}
       aria-valuemin={1} aria-valuemax={127} aria-valuenow={velocity}
       title={`Note ${n.pitch}, velocity ${velocity}`}
       style={{left:n.startTick/ppq*pixelsPerQuarter,width:Math.max(9,Math.min(15,pixelsPerQuarter/4-2)),height:Math.max(2,velocity/127*HEIGHT)}}/>;
     })}
    </div>
   </div>
  </div>
 </section>;
}
