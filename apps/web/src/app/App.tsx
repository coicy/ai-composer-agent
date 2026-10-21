import {useRef,useState,useEffect} from 'react';
import {playProject} from '@ai-composer/audio-engine';
import {rectangleBetween,selectNotesInRect,timeRangeOfSelectedNotes,tickToX,xToQuantizedTick,pitchToY,yToPitch,makeMoveOperations,makeVelocityOperations} from '@ai-composer/piano-roll';
import type {GridPoint,GridRect} from '@ai-composer/piano-roll';
import {exportMidi,importMidi} from '@ai-composer/midi-io';
import {composeMelody,continueMelody,proposeWithProvider,proposeTranspose} from '@ai-composer/composition';
import {createRemoteProvider} from '../features/agent/remote.js';
import type {MelodyCandidate,MelodyStyle} from '@ai-composer/composition';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createSession,commitSession,undoSession,redoSession} from '@ai-composer/music-core';
import type {EditSession,MidiNote,MusicProject,NoteOperation} from '@ai-composer/music-core';
const initial:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'主旋律',locked:false,notes:[]}]};
const ROW=24,TOP_PITCH=127,BOTTOM_PITCH=0;
type Gesture={noteId:string;kind:'move'|'resize';x:number;y:number;note:MidiNote;targets:readonly MidiNote[]};
export function App(){
 const [session,setSession]=useState<EditSession>(()=>createSession(initial));
 const [selected,setSelected]=useState<string|null>(null);
 const [selectedNoteIds,setSelectedNoteIds]=useState<string[]>([]);
 const [tool,setTool]=useState<'edit'|'select'>('edit');
 const [cell,setCell]=useState(60);
 const CELL=cell;
 const rollRef=useRef<HTMLDivElement|null>(null);
 const marqueeStart=useRef<GridPoint|null>(null);
 const [marquee,setMarquee]=useState<GridRect|null>(null);
 const [activeTrack,setActiveTrack]=useState('melody');
 const picker=useRef<HTMLInputElement|null>(null);
 const [error,setError]=useState('');
 const [candidate,setCandidate]=useState<MelodyCandidate|null>(null);
 const [style,setStyle]=useState<MelodyStyle>('motif');
 const [seed,setSeed]=useState(19501);
 const [bars,setBars]=useState(4);
 const [aiBars,setAiBars]=useState(4);
 const [startBar,setStartBar]=useState(1);
 const [aiMode,setAiMode]=useState<'append'|'replace'|'selected'>('append');
 const [pitchOnly,setPitchOnly]=useState(false);
 const [instruction,setInstruction]=useState('写一段带奇幻冒险感、动机清晰的旋律，适合游戏主题音乐');
 const [modelPending,setModelPending]=useState(false);
 const activeRequest=useRef<AbortController|null>(null);
 const gesture=useRef<Gesture|null>(null);
 const playback=useRef<{stop():void}|null>(null);
 const [playing,setPlaying]=useState(false);
 useEffect(()=>()=>{playback.current?.stop();activeRequest.current?.abort();},[]);
 useEffect(()=>{if(rollRef.current)rollRef.current.scrollTop=(127-72)*ROW-240;},[]);
 function stop(){playback.current?.stop();playback.current=null;setPlaying(false);}
 async function play(){stop();try{const handle=await playProject(session.project);playback.current=handle;setPlaying(true);setError('');}catch(e){setError(e instanceof Error?e.message:'audio_error');}}
 const [draft,setDraft]=useState<Record<string,MidiNote>>({});
 const draftOps=useRef<NoteOperation[]>([]);
 const project=session.project,track=project.tracks.find(t=>t.trackId===activeTrack)??project.tracks[0],notes=track?.notes??[];
 const trackId=track?.trackId??'melody';
 const STEP=Math.max(1,Math.round(project.ppq/4));
 const viewport={ppq:project.ppq,pixelsPerQuarter:CELL,rowHeight:ROW,topPitch:TOP_PITCH};
 const xOf=(tick:number)=>tickToX(tick,viewport);
 const yOf=(pitch:number)=>pitchToY(pitch,viewport);
 async function loadMidi(file:File){try{stop();const imported=importMidi(new Uint8Array(await file.arrayBuffer()));setSession(createSession(imported));setCandidate(null);activeRequest.current?.abort();setActiveTrack(imported.tracks[0]!.trackId);setSelected(null);setSelectedNoteIds([]);setMarquee(null);setError('');}catch(e){setError(e instanceof Error?e.message:'import_failed');}}
 function downloadMidi(){try{const bytes=exportMidi(project);const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);const url=URL.createObjectURL(new Blob([copy.buffer],{type:'audio/midi'}));const a=document.createElement('a');a.href=url;a.download='composition.mid';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'export_failed');}}
 function propose(){try{setCandidate(composeMelody({project:session.project,trackId,startBar:0,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'generation_failed');}}
 function proposeContinuation(){try{setCandidate(continueMelody({project:session.project,trackId,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'continuation_failed');}}

 async function proposeAI(){
  if(aiMode!=='selected'&&(!Number.isSafeInteger(aiBars)||aiBars<1||aiBars>4)){setError('AI 小节数应在 1–4 之间');return;}
  if(aiMode==='replace'&&(!Number.isSafeInteger(startBar)||startBar<1||startBar>64)){setError('起始小节应在 1–64 之间');return;}
  const snapshot=session.project;
  const current=snapshot.tracks.find(t=>t.trackId===trackId);
  let selectionRange:ReturnType<typeof timeRangeOfSelectedNotes>=null;
  if(aiMode==='selected'){
   if(selectedNoteIds.length===0){setError('请先使用框选工具选择需要重写的音符');return;}
   if(selectedNoteIds.length>64){setError('一次最多重写 64 个已选音符');return;}
   try{selectionRange=timeRangeOfSelectedNotes(current?.notes??[],selectedNoteIds);}
   catch{setError('选区已经发生变化，请重新框选');return;}
  }
  const measure=snapshot.ppq*4;
  const lastEnd=current?.notes.reduce((max,n)=>Math.max(max,n.startTick+n.durationTicks),0)??0;
  const startTick=selectionRange?.startTick??(aiMode==='replace'?(startBar-1)*measure:Math.ceil(lastEnd/measure)*measure);
  const endTick=selectionRange?.endTick??startTick+aiBars*measure;
  if(endTick-startTick>4*measure){setError('本阶段 AI 最多重写连续 4 小节的音符');return;}
  activeRequest.current?.abort();
  const controller=new AbortController();activeRequest.current=controller;
  setModelPending(true);setCandidate(null);setError('');
  try{
   const result=await proposeWithProvider(createRemoteProvider(snapshot),{
    project:snapshot,trackId,startTick,endTick,instruction,mode:aiMode==='append'?'append':'replace',
    targetNoteIds:aiMode==='selected'?[...selectedNoteIds]:undefined,
    editConstraint:aiMode==='selected'&&pitchOnly?'pitch_only':undefined,maxNotes:64
   },controller.signal);
   if(!controller.signal.aborted){setCandidate(result);setError('');}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'generation_failed');}
  finally{if(activeRequest.current===controller){activeRequest.current=null;setModelPending(false);}}
 }
 function previewTranspose(semitones:12|-12){
  activeRequest.current?.abort();setModelPending(false);
  try{
   setCandidate(proposeTranspose(session.project,trackId,selectedNoteIds,semitones));
   setError('');
  }catch(e){setCandidate(null);setError(e instanceof Error?e.message:'transpose_failed');}
 }
 function approve(){if(!candidate)return;const result=commitSession(session,candidate.changes);if(result.ok){setSession(result.session);setCandidate(null);setSelectedNoteIds([]);setError('');}else{setCandidate(null);setError(result.reason);}}
 function runOperations(operations:NoteOperation[],keepSelection=false){
  if(!operations.length)return;
  const result=commitSession(session,{baseRevision:project.revision,operations});
  if(result.ok){setSession(result.session);setCandidate(null);if(!keepSelection)setSelectedNoteIds([]);setError('');}
  else setError(result.reason);
 }
 function run(op:NoteOperation){runOperations([op]);}
 function setVelocity(raw:number){
  if(!Number.isSafeInteger(raw)||raw<1||raw>127){setError('力度需要在 1 到 127 之间');return;}
  const ids=selectedNoteIds.length?selectedNoteIds:(selected?[selected]:[]);
  let ops:NoteOperation[];
  try{ops=makeVelocityOperations(trackId,notes,ids,raw);}catch(e){setError(e instanceof Error?e.message:'invalid_velocity');return;}
  runOperations(ops,true);
 }
 function addAt(clientX:number,clientY:number,target:HTMLElement){
  const rect=target.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  const startTick=xToQuantizedTick(x,viewport),pitch=yToPitch(y,viewport);
  if(pitch<BOTTOM_PITCH||pitch>TOP_PITCH)return;
  const noteId=crypto.randomUUID();
  run({type:'add_note',trackId,note:{noteId,pitch,startTick,durationTicks:480,velocity:90}});setSelected(noteId);
 }
 function onPointerDown(e:ReactPointerEvent<HTMLElement>,note:MidiNote,kind:'move'|'resize'){
  if(tool==='select')return;
  e.stopPropagation();
  const batch=kind==='move'&&selectedNoteIds.includes(note.noteId);
  const targets=batch?notes.filter(n=>selectedNoteIds.includes(n.noteId)):[note];
  setSelected(note.noteId);
  if(!batch)setSelectedNoteIds([]);
  gesture.current={noteId:note.noteId,kind,x:e.clientX,y:e.clientY,note,targets};
  draftOps.current=[];
  (e.currentTarget.closest('.note') as HTMLElement).setPointerCapture(e.pointerId);
 }
 function onPointerMove(e:ReactPointerEvent<HTMLDivElement>){
  const g=gesture.current;if(!g)return;
  const steps=Math.round((e.clientX-g.x)/(CELL/4)),rows=Math.round((e.clientY-g.y)/ROW);
  const deltaTick=steps*STEP,deltaPitch=-rows;
  try{
   if(g.kind==='move'){
    const ops=makeMoveOperations(trackId,notes,g.targets.map(n=>n.noteId),deltaTick,deltaPitch);
    draftOps.current=ops;
    setDraft(Object.fromEntries(g.targets.map(n=>[n.noteId,{...n,startTick:n.startTick+deltaTick,pitch:n.pitch+deltaPitch}])));
   }else{
    const durationTicks=Math.max(STEP,g.note.durationTicks+deltaTick);
    draftOps.current=durationTicks===g.note.durationTicks?[]:[{type:'update_note',trackId,noteId:g.noteId,changes:{durationTicks}}];
    setDraft({[g.noteId]:{...g.note,durationTicks}});
   }
   setError('');
  }catch(e){draftOps.current=[];setDraft({});setError(e instanceof Error?e.message:'invalid_drag');}
 }
 function onPointerUp(){
  if(!gesture.current)return;
  gesture.current=null;
  const operations=draftOps.current;
  draftOps.current=[];
  setDraft({});
  if(operations.length)runOperations(operations,true);
 }
 function cancelDrag(){gesture.current=null;draftOps.current=[];setDraft({});}
 function gridPoint(e:ReactPointerEvent<HTMLDivElement>):GridPoint{
  const rect=e.currentTarget.getBoundingClientRect();
  return {x:Math.max(0,e.clientX-rect.left),y:e.clientY-rect.top};
 }
 function beginMarquee(e:ReactPointerEvent<HTMLDivElement>){
  if(tool!=='select'||e.button!==0)return;
  e.preventDefault();
  const point=gridPoint(e);marqueeStart.current=point;setMarquee(rectangleBetween(point,point));
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function moveMarquee(e:ReactPointerEvent<HTMLDivElement>){
  if(!marqueeStart.current)return;
  setMarquee(rectangleBetween(marqueeStart.current,gridPoint(e)));
 }
 function finishMarquee(e:ReactPointerEvent<HTMLDivElement>){
  const start=marqueeStart.current;if(!start)return;
  const end=gridPoint(e);marqueeStart.current=null;setMarquee(null);
  const area=rectangleBetween(start,end);
  if(area.right-area.left<4||area.bottom-area.top<4)return;
  const ids=selectNotesInRect(notes,area,{ppq:project.ppq,pixelsPerQuarter:CELL,rowHeight:ROW,topPitch:TOP_PITCH});
  setSelectedNoteIds(ids);setSelected(ids[0]??null);setAiMode('selected');setCandidate(null);
 }
 function cancelMarquee(){marqueeStart.current=null;setMarquee(null);}
 const active=notes.find(n=>n.noteId===selected);
 const removedIds=new Set(candidate?.changes.baseRevision===project.revision?candidate.changes.operations.filter(o=>o.type==='delete_note'&&o.trackId===trackId).map(o=>o.type==='delete_note'?o.noteId:''):[]);
 const updatedIds=new Set(candidate?.changes.baseRevision===project.revision?candidate.changes.operations.filter(o=>o.type==='update_note'&&o.trackId===trackId).map(o=>o.type==='update_note'?o.noteId:''):[]);
 const selectedSet=new Set(selectedNoteIds);
 const validSelectionIds=selectedNoteIds.filter(id=>notes.some(n=>n.noteId===id));
 const selectionScope=aiMode==='selected'&&validSelectionIds.length>0?timeRangeOfSelectedNotes(notes,validSelectionIds):null;
 const highlightStart=selectionScope?.startTick??(startBar-1)*project.ppq*4;
 const highlightEnd=selectionScope?.endTick??highlightStart+aiBars*project.ppq*4;
 const maxEnd=Math.max(16*project.ppq*4,...notes.map(n=>n.startTick+n.durationTicks),...(candidate?.notes.map(n=>n.startTick+n.durationTicks)??[]));
 const gridWidth=Math.max(1600,Math.ceil(xOf(maxEnd))+CELL*4,aiMode!=='append'&&Number.isSafeInteger(highlightEnd)&&highlightEnd>=0?xOf(highlightEnd)+CELL*2:0);
 return <main>
  <header><h1>AI Composer Agent</h1><p>钢琴卷帘 · 手工编辑与自主旋律生成原型</p></header>
  <section className="toolbar">
   <select aria-label="当前轨道" value={trackId} onChange={e=>{activeRequest.current?.abort();setCandidate(null);setActiveTrack(e.target.value);setSelected(null);setSelectedNoteIds([]);cancelMarquee();}}>{project.tracks.map(t=><option key={t.trackId} value={t.trackId}>{t.name}</option>)}</select>
   <button aria-pressed={tool==='edit'} onClick={()=>{setTool('edit');cancelMarquee();}}>编辑音符</button>
   <button aria-pressed={tool==='select'} onClick={()=>{setTool('select');cancelMarquee();}}>框选音符</button>
   <label className="zoom-control">水平缩放 <select aria-label="水平缩放" value={CELL} onChange={e=>{setCell(Number(e.target.value));cancelMarquee();}}><option value={30}>50%</option><option value={60}>100%</option><option value={90}>150%</option><option value={120}>200%</option></select></label>
   {selectedNoteIds.length>0&&<span>{selectedNoteIds.length} 个已框选音符</span>}
   {selectedNoteIds.length>0&&<button onClick={()=>{setSelectedNoteIds([]);setAiMode('append');setCandidate(null);}}>清除框选</button>}
   {selectedNoteIds.length>0&&<button onClick={()=>previewTranspose(12)}>所选 +12 半音预览</button>}
   {selectedNoteIds.length>0&&<button onClick={()=>previewTranspose(-12)}>所选 -12 半音预览</button>}
   <button onClick={()=>{const id=crypto.randomUUID();run({type:"add_track",track:{trackId:id,name:`Track ${project.tracks.length+1}`,locked:false,notes:[]}});setActiveTrack(id);setSelected(null);setSelectedNoteIds([]);}}>+ 轨道</button>
   <input ref={picker} type="file" accept=".mid,.midi,audio/midi" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void loadMidi(f);e.target.value="";}}/>
   <button onClick={()=>picker.current?.click()}>导入 MIDI</button><button onClick={downloadMidi}>导出 MIDI</button>
   <button onClick={()=>{const id=crypto.randomUUID();run({type:'add_note',trackId,note:{noteId:id,pitch:72,startTick:notes.length*480,durationTicks:480,velocity:90}});setSelected(id);}}>+ 添加音符</button>
   <button onClick={()=>{if(playing)stop();else void play();}}>{playing?'■ 停止':'▶ 试听'}</button>
   <button disabled={!session.past.length} onClick={()=>{setSession(s=>undoSession(s));setDraft({});setCandidate(null);setSelectedNoteIds([]);}}>撤销</button>
   <button disabled={!session.future.length} onClick={()=>{setSession(s=>redoSession(s));setDraft({});setCandidate(null);setSelectedNoteIds([]);}}>重做</button>
   <button disabled={!active} onClick={()=>{if(active){run({type:'delete_note',trackId,noteId:active.noteId});setSelected(null);}}}>删除所选</button>
   <span>revision {project.revision} · {notes.length} notes</span>
  </section>
  <section className="generator"><strong>旋律候选生成（规则算法，非 LLM）</strong><label>风格 <select value={style} onChange={e=>setStyle(e.target.value as MelodyStyle)}><option value="motif">Motif</option><option value="steps">Steps</option><option value="leaps">Leaps</option></select></label><label>小节 <input type="number" min="1" max="16" value={bars} onChange={e=>setBars(Number(e.target.value))}/></label><label>Seed <input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label><button onClick={propose}>从零生成 / 重写前段</button><button onClick={proposeContinuation}>基于现有旋律续写</button>{candidate&&<><span>预览 {candidate.label}：新增 {candidate.changes.operations.filter(o=>o.type==='add_note').length} / 删除 {candidate.changes.operations.filter(o=>o.type==='delete_note').length} / 更新 {candidate.changes.operations.filter(o=>o.type==='update_note').length} 音符（未提交）{candidate.changes.baseRevision!==project.revision?' · 已过期，请重新生成':''}</span><button disabled={candidate.changes.baseRevision!==project.revision} onClick={approve}>确认应用</button><button onClick={()=>setCandidate(null)}>取消</button></>}</section>
  <section className="agent-request">
   <label htmlFor="agent-prompt"><strong>自然语言作曲 Agent（模型服务）</strong></label>
   <textarea id="agent-prompt" value={instruction} maxLength={2000} onChange={e=>setInstruction(e.target.value)} rows={2} placeholder="描述旋律情绪、风格、动机或节奏"/>
   <label>模式 <select aria-label="AI 操作模式" value={aiMode} onChange={e=>{setAiMode(e.target.value as 'append'|'replace'|'selected');setCandidate(null);}}>
    <option value="append">轨道末尾续写</option><option value="replace">重写指定小节</option><option value="selected">仅重写框选音符</option>
   </select></label>
   {aiMode==='selected'&&<label className="constraint-toggle"><input type="checkbox" checked={pitchOnly} onChange={e=>{setPitchOnly(e.target.checked);setCandidate(null);}}/>只改音高（保留原节奏/力度/音符 ID）</label>}
   {aiMode==='replace'&&<label>起始小节 <input aria-label="重写起始小节" type="number" min="1" max="64" value={startBar} onChange={e=>{setStartBar(Number(e.target.value));setCandidate(null);}}/></label>}
   {aiMode!=='selected'&&<label>生成小节数 <input aria-label="AI 小节数" type="number" min="1" max="4" value={aiBars} onChange={e=>{setAiBars(Number(e.target.value));setCandidate(null);}}/></label>}
   <button disabled={modelPending||!instruction.trim()} onClick={()=>void proposeAI()}>{modelPending?'生成中…':aiMode==='append'?'AI 续写预览':'AI 重写预览'}</button>
   {modelPending&&<button onClick={()=>{activeRequest.current?.abort();setModelPending(false);}}>取消请求</button>}
   <span>{aiMode==='selected'?'框选音符后只替换选中的 Note ID；其他音符即使同时发声也会保留。':aiMode==='replace'?'整小节范围替换；锁定及跨边界音符阻止重写。':'在当前轨道最后一个音符之后追加，不修改已有音符。'} 生成结果须先预览再确认。</span>
  </section>
  <section className="roll" ref={rollRef}>
   <div className="keys">{Array.from({length:128},(_,i)=><div key={i} className={'key'+((TOP_PITCH-i)%12===0?' octave-key':'')}>{TOP_PITCH-i}</div>)}</div>
   <div className={'grid'+(tool==='select'?' select-tool':'')} style={{minWidth:gridWidth,height:128*ROW,backgroundSize:`${CELL/4}px ${ROW}px, 100% ${ROW}px`}}
    onPointerDown={beginMarquee} onPointerMove={moveMarquee} onPointerUp={finishMarquee} onPointerCancel={cancelMarquee}
    onDoubleClick={e=>{if(tool==='edit'&&e.target===e.currentTarget)addAt(e.clientX,e.clientY,e.currentTarget);}}>
    {aiMode!=='append'&&Number.isSafeInteger(highlightStart)&&highlightStart>=0&&Number.isSafeInteger(highlightEnd)&&highlightEnd>highlightStart&&<div className="selection-range" style={{left:xOf(highlightStart),width:xOf(highlightEnd-highlightStart)}}/>}
    {Array.from({length:128},(_,i)=><div className="lane" key={i} />)}
    {candidate?.changes.baseRevision===project.revision&&candidate.changes.operations.some(o=>(o.type==='add_note'||o.type==='update_note')&&o.trackId===trackId)&&candidate.notes.filter(n=>candidate.changes.operations.some(o=>(o.type==='add_note'&&o.note.noteId===n.noteId)||(o.type==='update_note'&&o.noteId===n.noteId))).map(n=><div key={'ghost-'+n.noteId} className="ghost-note" style={{left:xOf(n.startTick),top:yOf(n.pitch),width:Math.max(6,xOf(n.durationTicks)-2)}} />)}
    {marquee&&<div className="marquee-box" style={{left:marquee.left,top:marquee.top,width:marquee.right-marquee.left,height:marquee.bottom-marquee.top}}/>}
    {notes.map(n=>{const display=draft[n.noteId]??n;return <div key={n.noteId} className={'note'+(selected===n.noteId?' selected':'')+(removedIds.has(n.noteId)?' pending-delete':'')+(selectedSet.has(n.noteId)?' multi-selected':'')+(updatedIds.has(n.noteId)?' pending-update':'')}
     style={{left:xOf(display.startTick),top:yOf(display.pitch),width:Math.max(6,xOf(display.durationTicks)-2)}}
     title={`pitch ${n.pitch}, start ${n.startTick}, duration ${n.durationTicks}`}
     onPointerDown={e=>onPointerDown(e,n,'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancelDrag}>
     <span className="resize" onPointerDown={e=>onPointerDown(e,n,'resize')}/>
    </div>;})}
   </div>
  </section>
  <p className="hint">可垂直滚动查看 MIDI 0–127 全音域；缩放只改变显示比例，不修改工程 Tick。框选后切换回编辑模式，拖动其中任一音符可整体移动，操作作为单次撤销记录。</p>
  <p className="hint">编辑模式：双击空白新增音符，拖动音符修改音高/时间，拖动右边缘改变时值。框选模式：按住鼠标左键拖动矩形区域，再选择“仅重写框选音符”交给 Agent。</p>
  {active&&<div className="details">所选：音高 {active.pitch} · 起点 {active.startTick} tick · 时长 {active.durationTicks} tick · 力度 {active.velocity}
  <label className="velocity-control">力度 (1–127) <input type="number" min={1} max={127} key={`${active.noteId}:${active.velocity}`} defaultValue={active.velocity} onBlur={e=>{const number=Number(e.currentTarget.value);if(number!==active.velocity)setVelocity(number);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
  {selectedNoteIds.length>0&&<span>更改力度将一次性作用于 {selectedNoteIds.length} 个所选音符。</span>}</div>}
  {error&&<p role="alert" className="error">{error}</p>}
  <p className="hint">试听使用 Web Audio 三角波与固定 120 BPM，尚无音色、循环和 Tempo Map。可选择 AI 续写或选区重写；重写操作先显示蓝色新增音符与红色待删除音符，需启动本地 agent-api 并配置密钥；MIDI 导出暂为固定 120 BPM，导入替换现有工程。撤销/重做采用内存快照；刷新页面不会保留编辑历史。</p>
 </main>;
}
