import {useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createSession,commitSession,undoSession,redoSession} from '@ai-composer/music-core';
import type {EditSession,MidiNote,MusicProject,NoteOperation} from '@ai-composer/music-core';
const initial:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'主旋律',locked:false,notes:[]}]};
const ROW=24,CELL=60,TOP_PITCH=83,BOTTOM_PITCH=60,STEP=120;
type Gesture={noteId:string;kind:'move'|'resize';x:number;y:number;note:MidiNote};
export function App(){
 const [session,setSession]=useState<EditSession>(()=>createSession(initial));
 const [selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState('');
 const gesture=useRef<Gesture|null>(null);
 const [draft,setDraft]=useState<{noteId:string;startTick:number;durationTicks:number;pitch:number}|null>(null);
 const project=session.project,track=project.tracks[0],notes=track?.notes??[];
 function run(op:NoteOperation){const result=commitSession(session,{baseRevision:project.revision,operations:[op]});if(result.ok){setSession(result.session);setError('');}else setError(result.reason);}
 function addAt(clientX:number,clientY:number,target:HTMLElement){
  const rect=target.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  const startTick=Math.max(0,Math.floor(x/(CELL/4))*STEP),pitch=TOP_PITCH-Math.floor(y/ROW);
  if(pitch<BOTTOM_PITCH||pitch>TOP_PITCH)return;
  const noteId=crypto.randomUUID();
  run({type:'add_note',trackId:'melody',note:{noteId,pitch,startTick,durationTicks:480,velocity:90}});setSelected(noteId);
 }
 function onPointerDown(e:ReactPointerEvent<HTMLDivElement>,note:MidiNote,kind:'move'|'resize'){
  e.stopPropagation();setSelected(note.noteId);gesture.current={noteId:note.noteId,kind,x:e.clientX,y:e.clientY,note};e.currentTarget.setPointerCapture(e.pointerId);
 }
 function onPointerMove(e:ReactPointerEvent<HTMLDivElement>){
  const g=gesture.current;if(!g)return;
  const steps=Math.round((e.clientX-g.x)/(CELL/4)),rows=Math.round((e.clientY-g.y)/ROW);
  const startTick=Math.max(0,g.note.startTick+steps*STEP);
  const durationTicks=Math.max(STEP,g.note.durationTicks+steps*STEP);
  setDraft({noteId:g.noteId,startTick:g.kind==='move'?startTick:g.note.startTick,durationTicks:g.kind==='resize'?durationTicks:g.note.durationTicks,pitch:g.kind==='move'?Math.max(BOTTOM_PITCH,Math.min(TOP_PITCH,g.note.pitch-rows)):g.note.pitch});
 }
 function onPointerUp(){
  const g=gesture.current;gesture.current=null;
  if(!g){return;}const d=draft;setDraft(null);
  if(!d||d.noteId!==g.noteId)return;
  const changes=g.kind==='resize'?{durationTicks:d.durationTicks}:{startTick:d.startTick,pitch:d.pitch};
  if(Object.entries(changes).every(([k,v])=>g.note[k as keyof MidiNote]===v))return;
  run({type:'update_note',trackId:'melody',noteId:g.noteId,changes});
 }
 const active=notes.find(n=>n.noteId===selected);
 return <main>
  <header><h1>AI Composer Agent</h1><p>钢琴卷帘 · 手工编辑原型 · AI 作曲尚未接入</p></header>
  <section className="toolbar">
   <button onClick={()=>{const id=crypto.randomUUID();run({type:'add_note',trackId:'melody',note:{noteId:id,pitch:72,startTick:notes.length*480,durationTicks:480,velocity:90}});setSelected(id);}}>+ 添加音符</button>
   <button disabled={!session.past.length} onClick={()=>{setSession(s=>undoSession(s));setDraft(null);}}>撤销</button>
   <button disabled={!session.future.length} onClick={()=>{setSession(s=>redoSession(s));setDraft(null);}}>重做</button>
   <button disabled={!active} onClick={()=>{if(active){run({type:'delete_note',trackId:'melody',noteId:active.noteId});setSelected(null);}}}>删除所选</button>
   <span>revision {project.revision} · {notes.length} notes</span>
  </section>
  <section className="roll">
   <div className="keys">{Array.from({length:24},(_,i)=><div key={i} className="key">{TOP_PITCH-i}</div>)}</div>
   <div className="grid" onDoubleClick={e=>{if(e.target===e.currentTarget)addAt(e.clientX,e.clientY,e.currentTarget);}}>
    {Array.from({length:24},(_,i)=><div className="lane" key={i} />)}
    {notes.map(n=>{const display=draft?.noteId===n.noteId?{...n,...draft}:n;return <div key={n.noteId} className={'note'+(selected===n.noteId?' selected':'')}
     style={{left:display.startTick/480*CELL,top:(TOP_PITCH-display.pitch)*ROW,width:Math.max(6,display.durationTicks/480*CELL-2)}}
     title={`pitch ${n.pitch}, start ${n.startTick}, duration ${n.durationTicks}`}
     onPointerDown={e=>onPointerDown(e,n,'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={()=>{gesture.current=null;setDraft(null);}}>
     <span className="resize" onPointerDown={e=>onPointerDown(e,n,'resize')}/>
    </div>;})}
   </div>
  </section>
  <p className="hint">双击空白钢琴卷帘新增音符；拖动音符移动音高/时间；拖动右边缘改变时值。网格吸附为 1/16 音符。</p>
  {active&&<div className="details">所选：音高 {active.pitch} · 起点 {active.startTick} tick · 时长 {active.durationTicks} tick · 力度 {active.velocity}</div>}
  {error&&<p role="alert" className="error">{error}</p>}
  <p className="hint">当前无播放、Agent 或 MIDI 导入导出。撤销/重做采用内存快照；刷新页面不会保留编辑历史。</p>
 </main>;
}
