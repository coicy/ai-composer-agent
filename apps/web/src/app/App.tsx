import {useRef,useState,useEffect} from 'react';
import {playProject} from '@ai-composer/audio-engine';
import {rectangleBetween,selectNotesInRect,timeRangeOfSelectedNotes,tickToX,xToQuantizedTick,pitchToY,yToPitch,makeMoveOperations,makeVelocityOperations} from '@ai-composer/piano-roll';
import type {GridPoint,GridRect} from '@ai-composer/piano-roll';
import {exportMidi,importMidi} from '@ai-composer/midi-io';
import {composeMelody,continueMelody,proposeWithProvider,proposeTranspose,proposeArrangement,proposeArrangementVariants,combineArrangementVariants,SeededArranger,proposeRegionRegeneration,proposeRegionVariants,findReusableHarmonyPlan,ARRANGEMENT_ROLES,DEFAULT_REGISTERS,validateHarmonyPlan,chordLabel,chordEventLabel,effectiveChordEvents} from '@ai-composer/composition';
import {createRemoteProvider} from '../features/agent/remote.js';
import {createRemoteArranger} from '../features/agent/remote-arranger.js';
import {ArrangementDiagnostics} from '../features/agent/ArrangementDiagnostics.js';
import {HarmonyPlanEditor} from '../features/agent/HarmonyPlanEditor.js';
import type {HarmonyPlanDraft} from '../features/agent/HarmonyPlanEditor.js';
import {timelineFromDegrees} from '../features/agent/HarmonyPlanEditor.js';
import {VelocityLane} from '../features/editor/VelocityLane.js';
import type {MelodyCandidate,MelodyStyle,ArrangementCandidate,ArrangementRole,ArrangementRequest,ArrangementPartChoices,RegionRegenerationCandidate,RegionRegenerationRequest} from '@ai-composer/composition';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {createSession,commitSession,undoSession,redoSession,applyChangeSet,validateProject} from '@ai-composer/music-core';
import type {EditSession,MidiNote,MusicProject,NoteOperation,GenerationRecord} from '@ai-composer/music-core';
const initial:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'主旋律',locked:false,notes:[]}]};
const ROW=24,TOP_PITCH=127,BOTTOM_PITCH=0;
type Gesture={noteId:string;kind:'move'|'resize';x:number;y:number;note:MidiNote;targets:readonly MidiNote[]};
export function App(){
 const [session,setSession]=useState<EditSession>(()=>createSession(initial));
 const [selected,setSelected]=useState<string|null>(null);
 const [selectedNoteIds,setSelectedNoteIds]=useState<string[]>([]);
 const [tool,setTool]=useState<'edit'|'select'>('edit');
 const [cell,setCell]=useState(60);
 const [rollScrollLeft,setRollScrollLeft]=useState(0);
 const CELL=cell;
 const rollRef=useRef<HTMLDivElement|null>(null);
 const marqueeStart=useRef<GridPoint|null>(null);
 const [marquee,setMarquee]=useState<GridRect|null>(null);
 const [activeTrack,setActiveTrack]=useState('melody');
 const picker=useRef<HTMLInputElement|null>(null);
 const [error,setError]=useState('');
 const [candidate,setCandidate]=useState<MelodyCandidate|null>(null);
 const [arrangement,setArrangement]=useState<ArrangementCandidate|null>(null);
 const [arrangementVariants,setArrangementVariants]=useState<readonly ArrangementCandidate[]>([]);
 const [variantRequest,setVariantRequest]=useState<ArrangementRequest|null>(null);
 const [variantSeed,setVariantSeed]=useState(19501);
 const [variantCount,setVariantCount]=useState(3);
 const [roleChoices,setRoleChoices]=useState<ArrangementPartChoices>({harmony:0,bass:0,accompaniment:0});
 const [arrangementView,setArrangementView]=useState<ArrangementRole>('harmony');
 const [arrangeStartBar,setArrangeStartBar]=useState(1);
 const [arrangeBars,setArrangeBars]=useState(4);
 const [harmonicPlan,setHarmonicPlan]=useState<HarmonyPlanDraft>({enabled:false,tonic:0,mode:'major',progression:'1,4,5,1',timelineEnabled:false,timeline:[],passingTones:'none',registers:DEFAULT_REGISTERS,enforcement:{scale:'hard',chords:'hard',registers:'hard',inversions:'hard'}});
 const [arrangePrompt,setArrangePrompt]=useState('基于主旋律创作具有奇幻冒险感的和声、低音与节奏性伴奏，保留主旋律的主题动机。');
 const [arrangePending,setArrangePending]=useState(false);
 // Scoped regeneration keeps its source independent of the actively displayed Piano Roll track.
 const [regionSource,setRegionSource]=useState('melody');
 const [regionTarget,setRegionTarget]=useState('');
 const [regionRole,setRegionRole]=useState<ArrangementRole>('harmony');
 const [regionStartBar,setRegionStartBar]=useState(1);
 const [regionBars,setRegionBars]=useState(1);
 const [regionSeed,setRegionSeed]=useState(19501);
 const [regionPitchOnly,setRegionPitchOnly]=useState(false);
 const [regionInstruction,setRegionInstruction]=useState('保留其他声部，给选定声部在指定小节写一个新的动机变化。');
 const [regionCandidate,setRegionCandidate]=useState<RegionRegenerationCandidate|null>(null);
 const [regionCandidates,setRegionCandidates]=useState<readonly RegionRegenerationCandidate[]>([]);
 const [regionVariantCount,setRegionVariantCount]=useState(3);
 const [reuseApprovedPlan,setReuseApprovedPlan]=useState(true);
 const [regionPending,setRegionPending]=useState(false);
 const regionRequest=useRef<AbortController|null>(null);
 const arrangeRequest=useRef<AbortController|null>(null);
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
 useEffect(()=>()=>{playback.current?.stop();activeRequest.current?.abort();arrangeRequest.current?.abort();regionRequest.current?.abort();},[]);
 useEffect(()=>{if(rollRef.current)rollRef.current.scrollTop=(127-72)*ROW-240;},[]);
 function stop(){playback.current?.stop();playback.current=null;setPlaying(false);}
 async function play(){stop();try{const handle=await playProject(session.project);playback.current=handle;setPlaying(true);setError('');}catch(e){setError(e instanceof Error?e.message:'audio_error');}}
 const [draft,setDraft]=useState<Record<string,MidiNote>>({});
 const draftOps=useRef<NoteOperation[]>([]);
 const project=session.project,track=project.tracks.find(t=>t.trackId===activeTrack)??project.tracks[0],notes=track?.notes??[];
 const trackId=track?.trackId??'melody';
 const regionSourceId=project.tracks.some(t=>t.trackId===regionSource)?regionSource:project.tracks[0]?.trackId??'';
 const regionTargets=project.tracks.filter(t=>t.trackId!==regionSourceId);
 const regionTargetId=regionTargets.some(t=>t.trackId===regionTarget)?regionTarget:regionTargets[0]?.trackId??'';
 const proposedStart=(regionStartBar-1)*project.ppq*4;
 const savedHarmonyPlan=Number.isSafeInteger(regionStartBar)&&Number.isSafeInteger(regionBars)&&regionStartBar>=1&&regionBars>=1&&regionBars<=4?
  findReusableHarmonyPlan(project,regionSourceId,regionTargetId,proposedStart,proposedStart+regionBars*project.ppq*4):null;
 useEffect(()=>{
  regionRequest.current?.abort();
  regionRequest.current=null;
  setRegionPending(false);
  setRegionCandidate(null);
  setRegionCandidates([]);
 },[project.revision]);
 const STEP=Math.max(1,Math.round(project.ppq/4));
 const viewport={ppq:project.ppq,pixelsPerQuarter:CELL,rowHeight:ROW,topPitch:TOP_PITCH};
 const xOf=(tick:number)=>tickToX(tick,viewport);
 const yOf=(pitch:number)=>pitchToY(pitch,viewport);
 async function loadMidi(file:File){
  try{
   stop();
   let imported:MusicProject;
   if(file.name.toLowerCase().endsWith('.json')){
    if(file.size>2*1024*1024)throw new Error('project_file_too_large');
    const parsed=JSON.parse(await file.text()) as {format?:unknown;project?:unknown};
    if(!parsed||parsed.format!=='ai-composer-project-v1'||!validateProject(parsed.project as MusicProject))
     throw new Error('invalid_project_file');
    imported=parsed.project as MusicProject;
   }else imported=importMidi(new Uint8Array(await file.arrayBuffer()));
   if(imported.tracks.length===0)throw new Error('invalid_project_file');
   setSession(createSession(imported));regionRequest.current?.abort();setRegionCandidate(null);setRegionCandidates([]);
   setRegionSource(imported.tracks[0]!.trackId);setRegionTarget('');
   setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);
   activeRequest.current?.abort();arrangeRequest.current?.abort();setActiveTrack(imported.tracks[0]!.trackId);
   setSelected(null);setSelectedNoteIds([]);setMarquee(null);setError('');
  }catch(e){setError(e instanceof Error?e.message:'import_failed');}
 }
 function downloadProject(){
  try{
   if(!validateProject(project))throw new Error('invalid_project');
   const data=JSON.stringify({format:'ai-composer-project-v1',project},null,2);
   const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='composition.aic.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:'export_failed');}
 }
 function downloadMidi(){try{const bytes=exportMidi(project);const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);const url=URL.createObjectURL(new Blob([copy.buffer],{type:'audio/midi'}));const a=document.createElement('a');a.href=url;a.download='composition.mid';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'export_failed');}}
 function propose(){try{setArrangement(null);setCandidate(composeMelody({project:session.project,trackId,startBar:0,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'generation_failed');}}
 function proposeContinuation(){try{setArrangement(null);setCandidate(continueMelody({project:session.project,trackId,bars,style,seed}));setError('');}catch(e){setCandidate(null);setError(e instanceof Error?e.message:'continuation_failed');}}

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
  setModelPending(true);setCandidate(null);setArrangement(null);setError('');
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
   setArrangement(null);setCandidate(proposeTranspose(session.project,trackId,selectedNoteIds,semitones));
   setError('');
  }catch(e){setCandidate(null);setError(e instanceof Error?e.message:'transpose_failed');}
 }
 async function proposeMultiTrack(useModel:boolean,multiple=false){
  if(!Number.isSafeInteger(arrangeStartBar)||arrangeStartBar<1||arrangeStartBar>64||
     !Number.isSafeInteger(arrangeBars)||arrangeBars<1||arrangeBars>4){
   setError('编配起始小节需为 1–64，长度需为 1–4 小节');return;
  }
  if(!Number.isSafeInteger(variantSeed)||variantSeed<0||variantSeed>0xffffffff){
   setError('随机种子必须是 0 至 4294967295 的整数');return;
  }
  if(multiple&&(!Number.isSafeInteger(variantCount)||variantCount<2||variantCount>4)){
   setError('候选方案数量为 2–4');return;
  }
  let plan;
  try{
   plan=harmonicPlan.enabled?validateHarmonyPlan({
    tonic:harmonicPlan.tonic,mode:harmonicPlan.mode,
    degrees:harmonicPlan.timelineEnabled?Array.from({length:arrangeBars},(_,i)=>
     harmonicPlan.timeline.find(e=>e.startBeat<=i*4&&i*4<e.startBeat+e.durationBeats)?.degree??1
    ):harmonicPlan.progression.split(',').map(x=>Number(x.trim())),
    ...(harmonicPlan.timelineEnabled?{timeline:harmonicPlan.timeline}:{}),
    passingTones:harmonicPlan.passingTones,
    registers:harmonicPlan.registers,enforcement:harmonicPlan.enforcement
   },arrangeBars):undefined;
  }catch(e){setError(e instanceof Error?e.message:'invalid_harmony_plan');setArrangement(null);setArrangementVariants([]);setVariantRequest(null);return;}
  arrangeRequest.current?.abort();
  const controller=new AbortController();arrangeRequest.current=controller;
  setArrangePending(true);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setCandidate(null);setError('');
  const snapshot=session.project;
  const request:ArrangementRequest={
   project:snapshot,sourceTrackId:trackId,
   startTick:(arrangeStartBar-1)*snapshot.ppq*4,
   endTick:(arrangeStartBar-1+arrangeBars)*snapshot.ppq*4,
   instruction:arrangePrompt,plan,seed:variantSeed
  };
  try{
   const provider=useModel?createRemoteArranger(snapshot):new SeededArranger();
   if(multiple){
    const results=await proposeArrangementVariants(provider,request,variantCount,controller.signal);
    if(!controller.signal.aborted&&arrangeRequest.current===controller){
     setArrangementVariants(results);setVariantRequest(request);
     setRoleChoices({harmony:0,bass:0,accompaniment:0});
     setArrangement(results[0]!);setArrangementView('harmony');setError('');
    }
   }else{
    const result=await proposeArrangement(provider,request,controller.signal);
    if(!controller.signal.aborted&&arrangeRequest.current===controller){
     setArrangement(result);setArrangementView('harmony');setError('');
    }
   }
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'arrangement_failed');}
  finally{if(arrangeRequest.current===controller){arrangeRequest.current=null;setArrangePending(false);}}
 }
 async function mixSelectedParts(){
  if(!variantRequest||arrangementVariants.length<2)return;
  if(variantRequest.project.revision!==session.project.revision){
   setError('工程版本已更新，需要重新生成候选');return;
  }
  try{
   const mixed=await combineArrangementVariants(variantRequest,arrangementVariants,roleChoices);
   if(variantRequest.project.revision!==session.project.revision){setError('工程版本已更新，需要重新生成候选');return;}
   setArrangement(mixed);setError('');
  }catch(e){setError(e instanceof Error?e.message:'mixed_arrangement_failed');}
 }
 function approveMultiTrack(){
  if(!arrangement)return;
  const pending=arrangement;
  const record:GenerationRecord={
   recordId:`gen-${project.revision}-${(project.generationHistory??[]).length}`,
   kind:'three_track',sourceTrackId:pending.sourceTrackId,
   targetTrackIds:pending.tracks.map(t=>t.trackId),
   startTick:pending.startTick,endTick:pending.endTick,seed:pending.seed,
   providerId:pending.providerId,instruction:arrangePrompt,
   ...('roleSeeds' in pending?{seedsByRole:pending.roleSeeds as Record<string,number>} :{}),
   ...(pending.plan?{planJson:JSON.stringify(pending.plan)}:{})
  };
  const result=commitSession(session,{...pending.changes,generationRecord:record});
  if(result.ok){
   stop();setSession(result.session);
   setActiveTrack(pending.tracks[0]!.trackId);
   setSelected(null);setSelectedNoteIds([]);
   setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setCandidate(null);setError('');
  }else{setArrangement(null);setError(result.reason);}
 }
 async function previewMultiTrackAudio(){
  if(!arrangement||arrangement.changes.baseRevision!==session.project.revision)return;
  stop();
  try{
   const preview={...session.project,tracks:[...session.project.tracks,...arrangement.tracks]};
   const handle=await playProject(preview);
   playback.current=handle;setPlaying(true);setError('');
  }catch(e){setError(e instanceof Error?e.message:'arrangement_preview_failed');}
 }
 function invalidateRegion(){
  regionRequest.current?.abort();
  regionRequest.current=null;
  setRegionPending(false);
  setRegionCandidate(null);
  setRegionCandidates([]);
 }
 async function proposeScopedRegion(useModel:boolean,multiple=false){
  if(!regionTargetId||regionTargetId===regionSourceId){setError('请先选择与参考旋律不同的目标轨道');return;}
  if(!Number.isSafeInteger(regionStartBar)||regionStartBar<1||regionStartBar>64||
     !Number.isSafeInteger(regionBars)||regionBars<1||regionBars>4){setError('局部重编范围必须是第 1–64 小节，长度 1–4 小节');return;}
  if(!Number.isSafeInteger(regionSeed)||regionSeed<0||regionSeed>0xffffffff){setError('局部重编种子必须是 0 至 4294967295 的整数');return;}
  if(!regionInstruction.trim()||regionInstruction.length>2000){setError('请填写不超过 2000 字的局部编配指令');return;}
  if(multiple&&(!Number.isSafeInteger(regionVariantCount)||regionVariantCount<2||regionVariantCount>4)){
   setError('局部候选数必须在 2–4 之间');return;
  }
  invalidateRegion();
  const controller=new AbortController();regionRequest.current=controller;
  setRegionPending(true);setRegionCandidate(null);setCandidate(null);
  setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setError('');
  const snapshot=session.project;
  const startTick=(regionStartBar-1)*snapshot.ppq*4;
  const request:RegionRegenerationRequest={
   project:snapshot,sourceTrackId:regionSourceId,targetTrackId:regionTargetId,targetRole:regionRole,
   startTick,endTick:startTick+regionBars*snapshot.ppq*4,
   instruction:regionInstruction,seed:regionSeed,
   ...(regionPitchOnly?{editConstraint:'pitch_only' as const}:{}),
   ...(reuseApprovedPlan&&savedHarmonyPlan?{plan:savedHarmonyPlan.plan}:{})
  };
  try{
   const provider=useModel?createRemoteArranger(snapshot):new SeededArranger();
   if(multiple){
    const variants=await proposeRegionVariants(provider,request,regionVariantCount,controller.signal);
    if(regionRequest.current!==controller||controller.signal.aborted)return;
    setRegionCandidates(variants);setRegionCandidate(variants[0]!);
   }else{
    const proposal=await proposeRegionRegeneration(provider,request,controller.signal);
    if(regionRequest.current!==controller||controller.signal.aborted)return;
    setRegionCandidates([]);setRegionCandidate(proposal);
   }
   setActiveTrack(regionTargetId);
   setSelected(null);setSelectedNoteIds([]);setError('');
  }catch(e){if(!controller.signal.aborted&&regionRequest.current===controller)setError(e instanceof Error?e.message:'scoped_regeneration_failed');}
  finally{if(regionRequest.current===controller){regionRequest.current=null;setRegionPending(false);}}
 }
 function approveScopedRegion(){
  const pending=regionCandidate;
  if(!pending)return;
  if(pending.changes.baseRevision!==project.revision){invalidateRegion();setError('工程已变化，需要重新生成局部候选');return;}
  const record:GenerationRecord={
   recordId:`gen-${project.revision}-${(project.generationHistory??[]).length}`,
   kind:'scoped',sourceTrackId:pending.sourceTrackId,targetTrackIds:[pending.targetTrackId],
   startTick:pending.startTick,endTick:pending.endTick,seed:pending.seed,
   providerId:pending.providerId,instruction:regionInstruction,
   ...(pending.plan?{planJson:JSON.stringify(pending.plan)}:{})
  };
  const applied=commitSession(session,{...pending.changes,generationRecord:record});
  if(applied.ok){stop();setSession(applied.session);invalidateRegion();setError('');}
  else{invalidateRegion();setError(applied.reason);}
 }
 async function auditionScopedRegion(){
  const pending=regionCandidate;
  if(!pending)return;
  const preview=applyChangeSet(project,pending.changes);
  if(!preview.ok){setError(preview.reason);return;}
  stop();
  try{playback.current=await playProject(preview.project);setPlaying(true);setError('');}
  catch(e){setError(e instanceof Error?e.message:'scoped_preview_failed');}
 }
 function approve(){if(!candidate)return;const result=commitSession(session,candidate.changes);if(result.ok){setSession(result.session);setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setSelectedNoteIds([]);setError('');}else{setCandidate(null);setError(result.reason);}}
 function runOperations(operations:NoteOperation[],keepSelection=false){
  if(!operations.length)return;
  const result=commitSession(session,{baseRevision:project.revision,operations});
  if(result.ok){setSession(result.session);setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);if(!keepSelection)setSelectedNoteIds([]);setError('');}
  else setError(result.reason);
 }
 function run(op:NoteOperation){runOperations([op]);}
 function commitVelocity(ids:readonly string[],raw:number){
  if(!Number.isSafeInteger(raw)||raw<1||raw>127){setError('力度需要在 1 到 127 之间');return;}
  let ops:NoteOperation[];
  try{ops=makeVelocityOperations(trackId,notes,ids,raw);}catch(e){setError(e instanceof Error?e.message:'invalid_velocity');return;}
  runOperations(ops,true);
 }
 function setVelocity(raw:number){
  const ids=selectedNoteIds.length?selectedNoteIds:(selected?[selected]:[]);
  commitVelocity(ids,raw);
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
 const regionRemovedIds=new Set(regionCandidate?.changes.baseRevision===project.revision&&regionCandidate.targetTrackId===trackId?
  regionCandidate.removedNotes.map(n=>n.noteId):[]);
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
   <select aria-label="当前轨道" value={trackId} onChange={e=>{activeRequest.current?.abort();arrangeRequest.current?.abort();setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setActiveTrack(e.target.value);setSelected(null);setSelectedNoteIds([]);cancelMarquee();}}>{project.tracks.map(t=><option key={t.trackId} value={t.trackId}>{t.name}</option>)}</select>
   <button aria-pressed={tool==='edit'} onClick={()=>{setTool('edit');cancelMarquee();}}>编辑音符</button>
   <button aria-pressed={tool==='select'} onClick={()=>{setTool('select');cancelMarquee();}}>框选音符</button>
   <label className="zoom-control">水平缩放 <select aria-label="水平缩放" value={CELL} onChange={e=>{setCell(Number(e.target.value));cancelMarquee();}}><option value={30}>50%</option><option value={60}>100%</option><option value={90}>150%</option><option value={120}>200%</option></select></label>
   {selectedNoteIds.length>0&&<span>{selectedNoteIds.length} 个已框选音符</span>}
   {selectedNoteIds.length>0&&<button onClick={()=>{setSelectedNoteIds([]);setAiMode('append');setCandidate(null);}}>清除框选</button>}
   {selectedNoteIds.length>0&&<button onClick={()=>previewTranspose(12)}>所选 +12 半音预览</button>}
   {selectedNoteIds.length>0&&<button onClick={()=>previewTranspose(-12)}>所选 -12 半音预览</button>}
   <button onClick={()=>{const id=crypto.randomUUID();run({type:"add_track",track:{trackId:id,name:`Track ${project.tracks.length+1}`,locked:false,notes:[]}});setActiveTrack(id);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setSelected(null);setSelectedNoteIds([]);}}>+ 轨道</button>
   <input ref={picker} type="file" accept=".mid,.midi,.json,audio/midi,application/json" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void loadMidi(f);e.target.value="";}}/>
   <button onClick={()=>picker.current?.click()}>导入 MIDI / 工程 JSON</button>
   <button onClick={downloadMidi}>导出 MIDI</button>
   <button onClick={downloadProject}>导出工程 JSON</button>
   <button onClick={()=>{const id=crypto.randomUUID();run({type:'add_note',trackId,note:{noteId:id,pitch:72,startTick:notes.length*480,durationTicks:480,velocity:90}});setSelected(id);}}>+ 添加音符</button>
   <button onClick={()=>{if(playing)stop();else void play();}}>{playing?'■ 停止':'▶ 试听'}</button>
   <button disabled={!session.past.length} onClick={()=>{setSession(s=>undoSession(s));setDraft({});setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setSelectedNoteIds([]);}}>撤销</button>
   <button disabled={!session.future.length} onClick={()=>{setSession(s=>redoSession(s));setDraft({});setCandidate(null);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);setSelectedNoteIds([]);}}>重做</button>
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
  <section className="arrangement-panel" aria-label="多轨 AI 编配">
   <strong>多轨 AI 编配 · 原始旋律只读</strong>
   <label>起始小节 <input type="number" aria-label="编配起始小节" min={1} max={64} value={arrangeStartBar} onChange={e=>{setArrangeStartBar(Number(e.target.value));setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}/></label>
   <label>编配小节 <input type="number" aria-label="编配小节数" min={1} max={4} value={arrangeBars} onChange={e=>{const next=Number(e.target.value);setArrangeBars(next);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);if(Number.isSafeInteger(next)&&next>=1&&next<=4)setHarmonicPlan(p=>{const progression=Array.from({length:next},(_,i)=>p.progression.split(',')[i]??['1','4','5','1'][i]!).join(',');
     return {...p,progression,timeline:p.timelineEnabled?timelineFromDegrees(progression,next):p.timeline};});}}/></label>
   <HarmonyPlanEditor value={harmonicPlan} barCount={arrangeBars} onChange={next=>{setHarmonicPlan(next);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}/>
   <textarea aria-label="编配要求" rows={2} maxLength={2000} value={arrangePrompt} onChange={e=>{setArrangePrompt(e.target.value);setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}/>   <div className="variant-controls" role="group" aria-label="编配随机种子与候选">
    <label>随机种子 <input type="number" aria-label="编配随机种子" min={0} max={4294967295} step={1} value={variantSeed}
     onChange={e=>{setVariantSeed(Number(e.target.value));setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}/></label>
    <label>方案数 <select aria-label="编配方案数" value={variantCount} onChange={e=>{setVariantCount(Number(e.target.value));setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}>
     <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
    </select></label>
    <button disabled={arrangePending||!arrangePrompt.trim()} onClick={()=>void proposeMultiTrack(false,true)}>按种子生成多方案（离线）</button>
    <button disabled={arrangePending||!arrangePrompt.trim()} onClick={()=>void proposeMultiTrack(true,true)}>AI 多方案比较</button>
    <span>离线模式同一工程与种子可精确复现；模型模式仅将种子作为变化参考，不保证逐音符一致。</span>
   </div>
   <button disabled={arrangePending} onClick={()=>void proposeMultiTrack(false)}>规则编配预览（离线）</button>
   <button disabled={arrangePending||!arrangePrompt.trim()} onClick={()=>void proposeMultiTrack(true)}>{arrangePending?'生成中…':'AI 多轨编配预览'}</button>
   {arrangePending&&<button onClick={()=>{arrangeRequest.current?.abort();setArrangePending(false);}}>取消请求</button>}
   <span className="arrangement-hint">以当前轨道为只读主旋律参考，在新轨道中生成和声、低音、伴奏；不会覆盖当前或其他已有轨道。</span>
   {arrangementVariants.length>0&&<section className="variant-bank" aria-label="编配候选对比">
    <strong>同一主旋律的 {arrangementVariants.length} 个编配候选（尚未保存）</strong>
    <div className="variant-cards">{arrangementVariants.map((variant,i)=>
     <button type="button" key={variant.seed} disabled={variant.changes.baseRevision!==project.revision}
      aria-pressed={arrangement===variant} onClick={()=>{setArrangement(variant);setError('');}}>
      方案 {i+1} · Seed {variant.seed}
      <span>音符 {variant.tracks.reduce((n,t)=>n+t.notes.length,0)} · 结构提醒 {variant.assessment.findings.length} · 规划偏离 {variant.planFindings.length}</span>
     </button>)}</div>
    <div className="role-mixer" role="group" aria-label="组合不同候选声部">
     {ARRANGEMENT_ROLES.map((role,i)=><label key={role}>{['和声','低音','伴奏'][i]}
      <select aria-label={`${['和声','低音','伴奏'][i]}选择方案`} value={roleChoices[role]}
       onChange={e=>setRoleChoices(p=>({...p,[role]:Number(e.target.value)}))}>
       {arrangementVariants.map((variant,index)=><option key={variant.seed} value={index}>方案 {index+1} · Seed {variant.seed}</option>)}
      </select></label>)}
     <button disabled={arrangementVariants.some(v=>v.changes.baseRevision!==project.revision)} onClick={()=>void mixSelectedParts()}>组合所选声部并重新验证</button>
    </div>
    <p>组合操作会重新校验三轨与和声规划；不会直接拼接旧的 ChangeSet。选择方案后可以使用下方试听与确认按钮。</p>
   </section>}
   {arrangement&&<div className="arrangement-review">
    <strong>候选：新增 3 个轨道，{arrangement.tracks.reduce((sum,t)=>sum+t.notes.length,0)} 个 MIDI 音符（尚未提交）</strong>
    {arrangement.tracks.map((t,i)=><span className="arrangement-track" key={t.trackId}>{t.name} · {t.notes.length} 音符</span>)}
    <ArrangementDiagnostics assessment={arrangement.assessment}/>
    {arrangement.plan&&<section className="plan-review" aria-label="和声规划执行报告">
     <strong>已应用规划 · {['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][arrangement.plan.tonic]} {arrangement.plan.mode==='major'?'大调':'自然小调'}</strong>
     <p>和弦：{arrangement.plan.timeline?effectiveChordEvents(arrangement.plan).map(e=>`第${e.startBeat+1}拍 ${chordEventLabel(arrangement.plan!,e)}`).join(' – '):arrangement.plan.degrees.map((_,i)=>chordLabel(arrangement.plan!,i)).join(' – ')}</p>
     <p>调内音 {arrangement.plan.enforcement.scale==='hard'?'硬约束':'风格偏好'} / 和弦音 {arrangement.plan.enforcement.chords==='hard'?'硬约束':'风格偏好'} / 音域 {arrangement.plan.enforcement.registers==='hard'?'硬约束':'风格偏好'} / 转位 {arrangement.plan.enforcement.inversions==='hard'?'硬约束':'风格偏好'} / 经过音 {arrangement.plan.passingTones==='stepwise'?'级进例外':'无例外'}</p>
     {arrangement.planFindings.length>0?<ul>{arrangement.planFindings.map(f=><li key={`${f.role}-${f.constraint}`}>{f.message}</li>)}</ul>:<p>没有检测到当前规划的软约束偏离；这不代表音乐质量已通过评测。</p>}
    </section>}
    <label>覆盖查看 <select aria-label="编配预览轨道" value={arrangementView} onChange={e=>setArrangementView(e.target.value as ArrangementRole)}>
     {ARRANGEMENT_ROLES.map((role,i)=><option key={role} value={role}>{arrangement.tracks[i]!.name}</option>)}
    </select></label>
    <button disabled={arrangement.changes.baseRevision!==project.revision} onClick={()=>void previewMultiTrackAudio()}>试听原曲与编配候选</button>
    <button disabled={arrangement.changes.baseRevision!==project.revision} onClick={approveMultiTrack}>确认新增 3 轨</button>
    <button onClick={()=>{setArrangement(null);setArrangementVariants([]);setVariantRequest(null);}}>取消编配</button>
    {arrangement.changes.baseRevision!==project.revision&&<span className="error">工程版本已变化，必须重新生成。</span>}
   </div>}
  </section>
  <section className="scoped-arrangement-panel" aria-label="局部重新编配">
   <strong>局部重新编配 · 保留其他声部与小节</strong>
   <p>AI 定向生成时只返回所选声部的 MIDI 音符，不再生成多余的三轨；其他声部仍作为只读参考。</p>
   <p>先在工程中创建或导入至少两条轨道，选择只读主旋律与需要改写的既有轨道。范围外的音符、其他轨道与锁定音符不会被改变。</p>
   <p>局部 AI 重编会参考目标声部前后音符，以及其他保留声部的音符，用于衔接与避免声部冲突；这些参考内容不会被授权修改。</p>
   <label>参考旋律 <select aria-label="局部重编参考轨道" value={regionSourceId} onChange={e=>{setRegionSource(e.target.value);setRegionTarget('');invalidateRegion();}}>
    {project.tracks.map(t=><option key={t.trackId} value={t.trackId}>{t.name}</option>)}
   </select></label>
   <label>目标轨道 <select aria-label="局部重编目标轨道" value={regionTargetId} disabled={regionTargets.length===0}
    onChange={e=>{const id=e.target.value;setRegionTarget(id);const name=project.tracks.find(t=>t.trackId===id)?.name??'';
     if(name.includes('低音'))setRegionRole('bass');else if(name.includes('伴奏'))setRegionRole('accompaniment');else if(name.includes('和声'))setRegionRole('harmony');
     invalidateRegion();}}>
    {regionTargets.length===0?<option value="">暂无目标轨道</option>:regionTargets.map(t=><option key={t.trackId} value={t.trackId}>{t.name}</option>)}
   </select></label>
   <label>声部 <select aria-label="局部重编目标声部" value={regionRole} onChange={e=>{setRegionRole(e.target.value as ArrangementRole);invalidateRegion();}}>
    <option value="harmony">和声</option><option value="bass">低音</option><option value="accompaniment">伴奏</option>
   </select></label>
   <label>起始小节 <input type="number" aria-label="局部重编起始小节" min={1} max={64} value={regionStartBar}
    onChange={e=>{setRegionStartBar(Number(e.target.value));invalidateRegion();}}/></label>
   <label>长度 <input type="number" aria-label="局部重编小节数" min={1} max={4} value={regionBars}
    onChange={e=>{setRegionBars(Number(e.target.value));invalidateRegion();}}/></label>
   <label>Seed <input type="number" aria-label="局部重编随机种子" min={0} max={4294967295} step={1} value={regionSeed}
    onChange={e=>{setRegionSeed(Number(e.target.value));invalidateRegion();}}/></label>
   <label><input type="checkbox" aria-label="局部重编仅改音高" checked={regionPitchOnly}
    onChange={e=>{setRegionPitchOnly(e.target.checked);invalidateRegion();}}/>
    保留当前片段的所有节奏、时值、力度和音符 ID，仅重新生成音高</label>
   <textarea aria-label="局部重编指令" rows={2} maxLength={2000} value={regionInstruction}
    onChange={e=>{setRegionInstruction(e.target.value);invalidateRegion();}}/>
   {savedHarmonyPlan?<label><input type="checkbox" checked={reuseApprovedPlan} onChange={e=>{setReuseApprovedPlan(e.target.checked);invalidateRegion();}}/>继承已批准和声规划（{savedHarmonyPlan.recordId}）</label>:
    <span className="scoped-no-plan">当前参考旋律及目标范围没有可复用的已批准规划。</span>}
   <label>候选数 <select aria-label="局部重编方案数" value={regionVariantCount}
    onChange={e=>{setRegionVariantCount(Number(e.target.value));invalidateRegion();}}>
    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
   </select></label>
   <div className="scoped-actions">
    <button disabled={regionPending||!regionTargetId||!regionInstruction.trim()} onClick={()=>void proposeScopedRegion(false,true)}>按种子生成局部多方案</button>
    <button disabled={regionPending||!regionTargetId||!regionInstruction.trim()} onClick={()=>void proposeScopedRegion(true,true)}>AI 局部多方案</button>
    <button disabled={regionPending||!regionTargetId||!regionInstruction.trim()} onClick={()=>void proposeScopedRegion(false)}>按种子局部重编（离线）</button>
    <button disabled={regionPending||!regionTargetId||!regionInstruction.trim()} onClick={()=>void proposeScopedRegion(true)}>AI 局部重编</button>
    {regionPending&&<button onClick={invalidateRegion}>取消局部请求</button>}
   </div>
   {regionCandidates.length>0&&<section className="scoped-variants" role="region" aria-label="局部重编方案比较">
    <strong>局部候选比较：{regionCandidates.length} 个方案（尚未提交）</strong>
    {regionCandidates.map((option,i)=><button type="button" key={option.seed} aria-pressed={regionCandidate===option}
     onClick={()=>{setRegionCandidate(option);setError('');}}>
     方案 {i+1} · Seed {option.seed} · {option.notes.length} 音符</button>)}
    <p>切换候选可逐个试听；确认仅替换当前选定的候选与目标小节。</p>
   </section>}
   {regionCandidate&&<div className="scoped-review" role="region" aria-label="局部重编候选">
    <strong>待确认：{regionCandidate.removedNotes.length} 个旧音符将替换为 {regionCandidate.notes.length} 个新音符，Seed {regionCandidate.seed}</strong>
    <p>只修改 {project.tracks.find(t=>t.trackId===regionCandidate.targetTrackId)?.name??'目标轨道'} 的第 {Math.floor(regionCandidate.startTick/(project.ppq*4))+1} 小节起指定范围。钢琴卷帘中蓝色为新音符，红色为待删除音符。</p>
    {regionCandidate.changes.baseRevision!==project.revision&&<p className="error">候选已过期，请重新生成。</p>}
    <button disabled={regionCandidate.changes.baseRevision!==project.revision} onClick={()=>void auditionScopedRegion()}>试听局部重编候选</button>
    <button disabled={regionCandidate.changes.baseRevision!==project.revision} onClick={approveScopedRegion}>确认局部替换</button>
    <button onClick={invalidateRegion}>取消局部候选</button>
   </div>}
  </section>
  <section className="roll" ref={rollRef} onScroll={e=>setRollScrollLeft(e.currentTarget.scrollLeft)}>
   <div className="keys">{Array.from({length:128},(_,i)=><div key={i} className={'key'+((TOP_PITCH-i)%12===0?' octave-key':'')}>{TOP_PITCH-i}</div>)}</div>
   <div className={'grid'+(tool==='select'?' select-tool':'')} style={{minWidth:gridWidth,height:128*ROW,backgroundSize:`${CELL/4}px ${ROW}px, 100% ${ROW}px`}}
    onPointerDown={beginMarquee} onPointerMove={moveMarquee} onPointerUp={finishMarquee} onPointerCancel={cancelMarquee}
    onDoubleClick={e=>{if(tool==='edit'&&e.target===e.currentTarget)addAt(e.clientX,e.clientY,e.currentTarget);}}>
    {aiMode!=='append'&&Number.isSafeInteger(highlightStart)&&highlightStart>=0&&Number.isSafeInteger(highlightEnd)&&highlightEnd>highlightStart&&<div className="selection-range" style={{left:xOf(highlightStart),width:xOf(highlightEnd-highlightStart)}}/>}
    {Array.from({length:128},(_,i)=><div className="lane" key={i} />)}
    {candidate?.changes.baseRevision===project.revision&&candidate.changes.operations.some(o=>(o.type==='add_note'||o.type==='update_note')&&o.trackId===trackId)&&candidate.notes.filter(n=>candidate.changes.operations.some(o=>(o.type==='add_note'&&o.note.noteId===n.noteId)||(o.type==='update_note'&&o.noteId===n.noteId))).map(n=><div key={'ghost-'+n.noteId} className="ghost-note" style={{left:xOf(n.startTick),top:yOf(n.pitch),width:Math.max(6,xOf(n.durationTicks)-2)}} />)}
    {arrangement&&arrangement.changes.baseRevision===project.revision&&arrangement.sourceTrackId===trackId&&
     arrangement.tracks[ARRANGEMENT_ROLES.indexOf(arrangementView)]?.notes.map(n=>
      <div key={'arrange-ghost-'+n.noteId} className={'arrangement-ghost '+arrangementView}
       style={{left:xOf(n.startTick),top:yOf(n.pitch),width:Math.max(6,xOf(n.durationTicks)-2)}}
       title={`${arrangementView} pitch ${n.pitch}, tick ${n.startTick}`}/>)}
    {regionCandidate&&regionCandidate.changes.baseRevision===project.revision&&regionCandidate.targetTrackId===trackId&&
     regionCandidate.notes.map(n=><div key={'region-ghost-'+n.noteId} className="region-ghost"
      title={`局部重编音符 pitch ${n.pitch}, tick ${n.startTick}`}
      style={{left:xOf(n.startTick),top:yOf(n.pitch),width:Math.max(6,xOf(n.durationTicks)-2)}}/>)}
    {marquee&&<div className="marquee-box" style={{left:marquee.left,top:marquee.top,width:marquee.right-marquee.left,height:marquee.bottom-marquee.top}}/>}
    {notes.map(n=>{const display=draft[n.noteId]??n;return <div key={n.noteId} className={'note'+(selected===n.noteId?' selected':'')+(removedIds.has(n.noteId)||regionRemovedIds.has(n.noteId)?' pending-delete':'')+(selectedSet.has(n.noteId)?' multi-selected':'')+(updatedIds.has(n.noteId)?' pending-update':'')}
     style={{left:xOf(display.startTick),top:yOf(display.pitch),width:Math.max(6,xOf(display.durationTicks)-2)}}
     title={`pitch ${n.pitch}, start ${n.startTick}, duration ${n.durationTicks}`}
     onPointerDown={e=>onPointerDown(e,n,'move')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancelDrag}>
     <span className="resize" onPointerDown={e=>onPointerDown(e,n,'resize')}/>
    </div>;})}
   </div>
  </section>
  <VelocityLane notes={notes} selectedIds={selectedNoteIds} activeId={selected} ppq={project.ppq}
   pixelsPerQuarter={CELL} width={gridWidth} scrollLeft={rollScrollLeft} onChange={commitVelocity}/>
  <p className="hint">可垂直滚动查看 MIDI 0–127 全音域；缩放只改变显示比例，不修改工程 Tick。框选后切换回编辑模式，拖动其中任一音符可整体移动，操作作为单次撤销记录。</p>
  <p className="hint">编辑模式：双击空白新增音符，拖动音符修改音高/时间，拖动右边缘改变时值。框选模式：按住鼠标左键拖动矩形区域，再选择“仅重写框选音符”交给 Agent。</p>
  {active&&<div className="details">所选：音高 {active.pitch} · 起点 {active.startTick} tick · 时长 {active.durationTicks} tick · 力度 {active.velocity}
  <label className="velocity-control">力度 (1–127) <input type="number" min={1} max={127} key={`${active.noteId}:${active.velocity}`} defaultValue={active.velocity} onBlur={e=>{const number=Number(e.currentTarget.value);if(number!==active.velocity)setVelocity(number);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
  {selectedNoteIds.length>0&&<span>更改力度将一次性作用于 {selectedNoteIds.length} 个所选音符。</span>}</div>}
  {error&&<p role="alert" className="error">{error}</p>}
  <p className="hint">试听使用 Web Audio 三角波与固定 120 BPM，尚无音色、循环和 Tempo Map。可选择 AI 续写或选区重写；重写操作先显示蓝色新增音符与红色待删除音符，需启动本地 agent-api 并配置密钥；MIDI 导出暂为固定 120 BPM，导入替换现有工程。撤销/重做采用内存快照；刷新页面不会保留编辑历史。</p>
 </main>;
}
