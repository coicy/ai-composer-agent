import {useRef,useState,useEffect} from 'react';
import {playProject} from '@ai-composer/audio-engine';
import {exportMidi,importMidi} from '@ai-composer/midi-io';
import {composeMelody,continueMelody,proposeWithProvider} from '@ai-composer/composition';
import {createRemoteProvider} from '../features/agent/remote.js';
import type {MelodyCandidate,MelodyStyle} from '@ai-composer/composition';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createSession,commitSession,undoSession,redoSession} from '@ai-composer/music-core';
import type {EditSession,MidiNote,MusicProject,NoteOperation} from '@ai-composer/music-core';
const initial:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'主旋律',locked:false,notes:[]}]};
const ROW=24,CELL=60,TOP_PITCH=83,BOTTOM_PITCH=60,STEP=120;
type Gesture={noteId:string;kind:'move'|'resize';x:number;y:number;note:MidiNote};
export function App(){
 const [session,setSession]=useState<EditSession>(()=>createSession(initial));
 const [selected,setSelected]=useState<string|null>(null);
 const [activeTrack,setActiveTrack]=useState('melody');
 const picker=useRef<HTMLInputElement|null>(null);
 const [error,setError]=useState('');
 const [candidate,setCandidate]=useState<MelodyCandidate|null>(null);
 const [style,setStyle]=useState<MelodyStyle>('motif');
 const [seed,setSeed]=useState(19501);
 const [bars,setBars]=useState(4);
 const [aiBars,setAiBars]=useState(4);
 const [startBar,setStartBar]=useState(1);
 const [aiMode,setAiMode]=useState<'append'|'replace'>('append');
 const [instruction,setInstruction]=useState('写一段带奇幻冒险感、动机清晰的旋律，适合游戏主题音乐');
 const [modelPending,setModelPending]=useState(false);
 const activeRequest=useRef<AbortController|null>(null);
 const gesture=useRef<Gesture|null>(null);
 const playback=useRef<{stop():void}|null>(null);
 const [playing,setPlaying]=useState(false);
 useEffect(()=>()=>{playback.current?.stop();activeRequest.current?.abort();},[]);
 function stop(){playback.current?.stop();playback.current=null;setPlaying(false);}
 async function play(){stop();try{const handle=await playProject(session.project);playback.current=handle;setPlaying(true);setError('');}catch(e){setError(e instanceof Error?e.message:'audio_error');}}
 const [draft,setDraft]=useState<{noteId:string;startTick:number;durationTicks:number;pitch:number}|null>(null);
 const project=session.project,track=project.tracks.find(t=>t.trackId===activeTrack)??project.tracks[0],notes=track?.notes??[];
 const trackId=track?.trackId??'melody';
 async function loadMidi(file:File){try{stop();const imported=importMidi(new Uint8Array(await file.arrayBuffer()));setSession(createSession(imported));setCandidate(null);activeRequest.current?.abort();setActiveTrack(imported.tracks[0]!.trackId);setSelected(null);setError('');}catch(e){setError(e instanceof Error?e.message:'import_failed');}}
 function downloadMidi(){try{const bytes=exportMidi(project);const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);const url=URL.createObjectURL(new Blob([copy.buffer],{type:'audio/midi'}));const a=document.createElement('a');a.href=url;a.download='composition.mid';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'export_failed');}}
 function propose(){try{setCandidate(composeMelody({project:session.project,trackId,startBar:0,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'generation_failed');}}
 function proposeContinuation(){try{setCandidate(continueMelody({project:session.project,trackId,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'continuation_failed');}}

 async function proposeAI(){
  if(!Number.isSafeInteger(aiBars)||aiBars<1||aiBars>4){setError('AI 小节数应在 1–4 之间');return;}
  if(aiMode==='replace'&&(!Number.isSafeInteger(startBar)||startBar<1||startBar>64)){setError('起始小节应在 1–64 之间');return;}
  activeRequest.current?.abort();
  const controller=new AbortController();activeRequest.current=controller;
  setModelPending(true);setCandidate(null);setError('');
  const snapshot=session.project;
  const current=snapshot.tracks.find(t=>t.trackId===trackId);
  const lastEnd=current?.notes.reduce((max,n)=>Math.max(max,n.startTick+n.durationTicks),0)??0;
  const measure=snapshot.ppq*4;
  const startTick=aiMode==='replace'?(startBar-1)*measure:Math.ceil(lastEnd/measure)*measure;
  const endTick=startTick+aiBars*measure;
  try{
   const result=await proposeWithProvider(createRemoteProvider(snapshot),{project:snapshot,trackId,startTick,endTick,instruction,mode:aiMode,maxNotes:64},controller.signal);
   if(!controller.signal.aborted){setCandidate(result);setError('');}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'generation_failed');}
  finally{if(activeRequest.current===controller){activeRequest.current=null;setModelPending(false);}}
 }
 function approve(){if(!candidate)return;const result=commitSession(session,candidate.changes);if(result.ok){setSession(result.session);setCandidate(null);setError('');}else{setCandidate(null);setError(result.reason);}}
 function run(op:NoteOperation){const result=commitSession(session,{baseRevision:project.revision,operations:[op]});if(result.ok){setSession(result.session);setCandidate(null);setError('');}else setError(result.reason);}
 function addAt(clientX:number,clientY:number,target:HTMLElement){
  const rect=target.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  const startTick=Math.max(0,Math.floor(x/(CELL/4))*STEP),pitch=TOP_PITCH-Math.floor(y/ROW);
  if(pitch<BOTTOM_PITCH||pitch>TOP_PITCH)return;
  const noteId=crypto.randomUUID();
  run({type:'add_note',trackId,note:{noteId,pitch,startTick,durationTicks:480,velocity:90}});setSelected(noteId);
 }
 function onPointerDown(e:ReactPointerEvent<HTMLElement>,note:MidiNote,kind:'move'|'resize'){
  e.stopPropagation();setSelected(note.noteId);gesture.current={noteId:note.noteId,kind,x:e.clientX,y:e.clientY,note};(e.currentTarget.closest('.note') as HTMLElement).setPointerCapture(e.pointerId);
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
  run({type:'update_note',trackId,noteId:g.noteId,changes});
 }
 const active=notes.find(n=>n.noteId===selected);
 const removedIds=new Set(candidate?.changes.baseRevision===project.revision?candidate.changes.operations.filter(o=>o.type==='delete_note'&&o.trackId===trackId).map(o=>o.type==='delete_note'?o.noteId:''):[]);
 const highlightStart=(startBar-1)*project.ppq*4;
 const highlightEnd=highlightStart+aiBars*project.ppq*4;
 const maxEnd=Math.max(16*project.ppq*4,...notes.map(n=>n.startTick+n.durationTicks),...(candidate?.notes.map(n=>n.startTick+n.durationTicks)??[]));
 const gridWidth=Math.max(1600,Math.ceil(maxEnd/project.ppq*CELL)+CELL*4,aiMode==='replace'&&Number.isSafeInteger(highlightEnd)&&highlightEnd>=0?highlightEnd/project.ppq*CELL+CELL*2:0);
 return <main>
  <header><h1>AI Composer Agent</h1><p>钢琴卷帘 · 手工编辑与自主旋律生成原型</p></header>
  <section className="toolbar">
   <select aria-label="当前轨道" value={trackId} onChange={e=>{activeRequest.current?.abort();setCandidate(null);setActiveTrack(e.target.value);setSelected(null);}}>{project.tracks.map(t=><option key={t.trackId} value={t.trackId}>{t.name}</option>)}</select>
   <button onClick={()=>{const id=crypto.randomUUID();run({type:"add_track",track:{trackId:id,name:`Track ${project.tracks.length+1}`,locked:false,notes:[]}});setActiveTrack(id);setSelected(null);}}>+ 轨道</button>
   <input ref={picker} type="file" accept=".mid,.midi,audio/midi" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void loadMidi(f);e.target.value="";}}/>
   <button onClick={()=>picker.current?.click()}>导入 MIDI</button><button onClick={downloadMidi}>导出 MIDI</button>
   <button onClick={()=>{const id=crypto.randomUUID();run({type:'add_note',trackId,note:{noteId:id,pitch:72,startTick:notes.length*480,durationTicks:480,velocity:90}});setSelected(id);}}>+ 添加音符</button>
   <button onClick={()=>{if(playing)stop();else void play();}}>{playing?'■ 停止':'▶ 试听'}</button>
   <button disabled={!session.past.length} onClick={()=>{setSession(s=>undoSession(s));setDraft(null);setCandidate(null);}}>撤销</button>
   <button disabled={!session.future.length} onClick={()=>{setSession(s=>redoSession(s));setDraft(null);setCandidate(null);}}>重做</button>
   <button disabled={!active} onClick={()=>{if(active){run({type:'delete_note',trackId,noteId:active.noteId});setSelected(null);}}}>删除所选</button>
   <span>revision {project.revision} · {notes.length} notes</span>
  </section>
  <section className="generator"><strong>旋律候选生成（规则算法，非 LLM）</strong><label>风格 <select value={style} onChange={e=>setStyle(e.target.value as MelodyStyle)}><option value="motif">Motif</option><option value="steps">Steps</option><option value="leaps">Leaps</option></select></label><label>小节 <input type="number" min="1" max="16" value={bars} onChange={e=>setBars(Number(e.target.value))}/></label><label>Seed <input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label><button onClick={propose}>从零生成 / 重写前段</button><button onClick={proposeContinuation}>基于现有旋律续写</button>{candidate&&<><span>预览 {candidate.label}：新增 {candidate.changes.operations.filter(o=>o.type==='add_note').length} / 删除 {candidate.changes.operations.filter(o=>o.type==='delete_note').length} 音符（未提交）{candidate.changes.baseRevision!==project.revision?' · 已过期，请重新生成':''}</span><button disabled={candidate.changes.baseRevision!==project.revision} onClick={approve}>确认应用</button><button onClick={()=>setCandidate(null)}>取消</button></>}</section>
  <section className="agent-request">
   <label htmlFor="agent-prompt"><strong>自然语言作曲 Agent（模型服务）</strong></label>
   <textarea id="agent-prompt" value={instruction} maxLength={2000} onChange={e=>setInstruction(e.target.value)} rows={2} placeholder="描述旋律情绪、风格、动机或节奏"/>
   <label>模式 <select aria-label="AI 操作模式" value={aiMode} onChange={e=>{setAiMode(e.target.value as 'append'|'replace');setCandidate(null);}}>
    <option value="append">轨道末尾续写</option><option value="replace">重写指定小节</option>
   </select></label>
   {aiMode==='replace'&&<label>起始小节 <input aria-label="重写起始小节" type="number" min="1" max="64" value={startBar} onChange={e=>{setStartBar(Number(e.target.value));setCandidate(null);}}/></label>}
   <label>生成小节数 <input aria-label="AI 小节数" type="number" min="1" max="4" value={aiBars} onChange={e=>{setAiBars(Number(e.target.value));setCandidate(null);}}/></label>
   <button disabled={modelPending||!instruction.trim()} onClick={()=>void proposeAI()}>{modelPending?'生成中…':aiMode==='replace'?'AI 重写预览':'AI 续写预览'}</button>
   {modelPending&&<button onClick={()=>{activeRequest.current?.abort();setModelPending(false);}}>取消请求</button>}
   <span>{aiMode==='replace'?'仅替换完全位于选区内且未锁定的音符；跨边界音符将阻止重写。':'在当前轨道最后一个音符之后追加，不修改已有音符。'} 生成结果须先预览再确认。</span>
  </section>
  <section className="roll">
   <div className="keys">{Array.from({length:24},(_,i)=><div key={i} className="key">{TOP_PITCH-i}</div>)}</div>
   <div className="grid" style={{minWidth:gridWidth}} onDoubleClick={e=>{if(e.target===e.currentTarget)addAt(e.clientX,e.clientY,e.currentTarget);}}>
    {aiMode==='replace'&&Number.isSafeInteger(startBar)&&startBar>=1&&startBar<=64&&Number.isSafeInteger(aiBars)&&aiBars>=1&&aiBars<=4&&<div className="selection-range" style={{left:highlightStart/project.ppq*CELL,width:(highlightEnd-highlightStart)/project.ppq*CELL}}/>}
    {Array.from({length:24},(_,i)=><div className="lane" key={i} />)}
    {candidate?.changes.baseRevision===project.revision&&candidate.changes.operations.some(o=>o.type==='add_note'&&o.trackId===trackId)&&candidate.notes.map(n=><div key={'ghost-'+n.noteId} className="ghost-note" style={{left:n.startTick/project.ppq*CELL,top:(TOP_PITCH-n.pitch)*ROW,width:Math.max(6,n.durationTicks/project.ppq*CELL-2)}} />)}
    {notes.map(n=>{const display=draft?.noteId===n.noteId?{...n,...draft}:n;return <div key={n.noteId} className={'note'+(selected===n.noteId?' selected':'')+(removedIds.has(n.noteId)?' pending-delete':'')}
     style={{left:display.startTick/project.ppq*CELL,top:(TOP_PITCH-display.pitch)*ROW,width:Math.max(6,display.durationTicks/project.ppq*CELL-2)}}
     title={`pitch ${n.pitch}, start ${n.startTick}, duration ${n.durationTicks}`}
     onPointerDown={e=>onPointerDown(e,n,'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={()=>{gesture.current=null;setDraft(null);}}>
     <span className="resize" onPointerDown={e=>onPointerDown(e,n,'resize')}/>
    </div>;})}
   </div>
  </section>
  <p className="hint">双击空白钢琴卷帘新增音符；拖动音符移动音高/时间；拖动右边缘改变时值。网格吸附为 1/16 音符。</p>
  {active&&<div className="details">所选：音高 {active.pitch} · 起点 {active.startTick} tick · 时长 {active.durationTicks} tick · 力度 {active.velocity}</div>}
  {error&&<p role="alert" className="error">{error}</p>}
  <p className="hint">试听使用 Web Audio 三角波与固定 120 BPM，尚无音色、循环和 Tempo Map。可选择 AI 续写或选区重写；重写操作先显示蓝色新增音符与红色待删除音符，需启动本地 agent-api 并配置密钥；MIDI 导出暂为固定 120 BPM，导入替换现有工程。撤销/重做采用内存快照；刷新页面不会保留编辑历史。</p>
 </main>;
}
