import {afterEach,describe,it,expect} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createAgentServer} from './server.js';
import type {MusicProject} from '@ai-composer/music-core';
import type {ProviderContext} from '@ai-composer/composition';
const project:MusicProject={projectId:'test',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]};
const body={project,trackId:'melody',startTick:0,endTick:1920,instruction:'write a melody'};
const fakeFactory=()=>({id:'fake',async generate(){return {notes:[{pitch:60,startTick:0,durationTicks:480,velocity:90}]};}});
describe('agent API',()=>{
 const servers:ReturnType<typeof createAgentServer>[]=[];
 afterEach(async()=>{for(const s of servers.splice(0))await new Promise<void>(resolve=>s.close(()=>resolve()));});
 async function launch(options:Parameters<typeof createAgentServer>[0]){
  const server=createAgentServer(options);servers.push(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 }
 it('returns a validated candidate, no project writes',async()=>{
  const url=await launch({apiKey:'fake',providerFactory:fakeFactory});
  const response=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:5173'},body:JSON.stringify(body)});
  expect(response.status).toBe(200);expect(await response.json()).toEqual({notes:[{pitch:60,startTick:0,durationTicks:480,velocity:90}]});
  expect(project.tracks[0]?.notes).toHaveLength(0);
 });
 it('enforces local origin and key requirement',async()=>{
  const url=await launch({});
  expect((await fetch(url+'/api/compose',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'})).status).toBe(403);
  expect((await fetch(url+'/api/compose',{method:'POST',body:'{}'})).status).toBe(503);
 });
 it('passes scoped replace and rejects boundary crossing',async()=>{
  let observed:ProviderContext|undefined;
  const fake=()=>({id:'fake',async generate(ctx:ProviderContext){observed=ctx;return {notes:[{pitch:72,startTick:0,durationTicks:480,velocity:90}]};}});
  const url=await launch({apiKey:'fake',providerFactory:fake});
  const old={noteId:'old',pitch:60,startTick:0,durationTicks:480,velocity:90};
  const p={...project,tracks:[{...project.tracks[0]!,notes:[old]}]};
  const res=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,mode:'replace',project:p})});
  expect(res.status).toBe(200);expect(observed?.targetNotes).toEqual([old]);expect(observed?.mode).toBe('replace');
  const crossing={...project,tracks:[{...project.tracks[0]!,notes:[{...old,startTick:1700,durationTicks:400}]}]};
  const bad=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,mode:'replace',project:crossing})});
  expect(bad.status).toBe(422);expect((await bad.json()).error).toBe('cross_boundary_note');
 });
 it('retains explicit selected note IDs through request validation',async()=>{
  let targets:readonly string[]|undefined;
  const factory=()=>({id:'fake',async generate(ctx:ProviderContext){targets=ctx.targetNoteIds;return {notes:[{pitch:70,startTick:0,durationTicks:480,velocity:88}]};}});
  const url=await launch({apiKey:'test',providerFactory:factory});
  const p={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'selected',pitch:60,startTick:0,durationTicks:480,velocity:80},{noteId:'other',pitch:62,startTick:0,durationTicks:480,velocity:90,locked:true}]}]};
  const response=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:p,mode:'replace',targetNoteIds:['selected']})});
  expect(response.status).toBe(200);expect(targets).toEqual(['selected']);
  const invalid=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:p,mode:'replace',targetNoteIds:['missing']})});
  expect(invalid.status).toBe(422);
 });
 it('safely enforces pitch-only constraint through HTTP route',async()=>{
  const p={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'a',pitch:60,startTick:0,durationTicks:480,velocity:81}]}]};
  const fake=()=>({id:'fake',async generate(){return {notes:[{pitch:67,startTick:0,durationTicks:480,velocity:70}]};}});
  const url=await launch({apiKey:'test',providerFactory:fake});
  const good=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:p,mode:'replace',targetNoteIds:['a'],editConstraint:'pitch_only'})});
  expect(good.status).toBe(200);expect((await good.json()).notes[0].pitch).toBe(67);
  const bad=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:p,mode:'append',targetNoteIds:['a'],editConstraint:'pitch_only'})});
  expect(bad.status).toBe(422);
 });
 it('returns three proposed tracks from a locked source without committing',async()=>{
  const melody={noteId:'source-note',pitch:64,startTick:0,durationTicks:480,velocity:92,locked:true};
  const locked={...project,tracks:[{...project.tracks[0]!,locked:true,notes:[melody]}]};
  let observedSource:readonly {noteId:string}[]=[];
  const arrangerFactory=()=>({id:'fake-arranger',async generate(ctx:{sourceNotes:readonly {noteId:string}[]}){
   observedSource=ctx.sourceNotes;
   return {tracks:[
    {role:'harmony',notes:[{pitch:67,startTick:0,durationTicks:480,velocity:70}]},
    {role:'bass',notes:[{pitch:40,startTick:0,durationTicks:480,velocity:80}]},
    {role:'accompaniment',notes:[{pitch:55,startTick:0,durationTicks:480,velocity:65}]}
   ]};
  }});
  const url=await launch({apiKey:'fake',arrangerFactory});
  const response=await fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:locked,sourceTrackId:'melody',startTick:0,endTick:1920,instruction:'create orchestration'})});
  expect(response.status).toBe(200);
  const body=(await response.json()) as {tracks:{role:string;notes:unknown[]}[]};
  expect(body.tracks.map(t=>t.role)).toEqual(['harmony','bass','accompaniment']);
  expect(observedSource).toEqual([melody]);
  expect(locked.tracks).toHaveLength(1);
 });
 it('rejects absent source and unsafe arrangement window',async()=>{
  const url=await launch({apiKey:'fake'});
  const send=async(payload:unknown)=>fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  expect((await send({project,sourceTrackId:'missing',startTick:0,endTick:1920,instruction:'arrange'})).status).toBe(422);
  expect((await send({project,sourceTrackId:'melody',startTick:0,endTick:9000,instruction:'arrange'})).status).toBe(422);
 });
 it('rejects malformed harmony plan at the HTTP boundary',async()=>{
  const url=await launch({apiKey:'fake'});
  const occupied={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'src',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]};
  const response=await fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   project:occupied,sourceTrackId:'melody',startTick:0,endTick:1920,instruction:'compose',
   plan:{tonic:12,mode:'major',degrees:[1],registers:{},enforcement:{}}
  })});
  expect(response.status).toBe(422);
  expect((await response.json()).error).toBe('invalid_plan_key');
 });
 it('reports a hard harmony planning violation without disclosing provider data',async()=>{
  const src={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'melody-note',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]};
  const plan={tonic:0,mode:'major',degrees:[1],registers:{harmony:{minPitch:55,maxPitch:88},bass:{minPitch:28,maxPitch:60},accompaniment:{minPitch:42,maxPitch:84}},enforcement:{scale:'hard',chords:'hard',registers:'hard'}};
  const factory=()=>({id:'mock',async generate(){return {tracks:[
   {role:'harmony',notes:[{pitch:61,startTick:0,durationTicks:480,velocity:85}]},
   {role:'bass',notes:[{pitch:36,startTick:0,durationTicks:480,velocity:85}]},
   {role:'accompaniment',notes:[{pitch:55,startTick:0,durationTicks:480,velocity:85}]}
  ]};}});
  const url=await launch({apiKey:'test',arrangerFactory:factory});
  const response=await fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:src,sourceTrackId:'melody',startTick:0,endTick:1920,instruction:'compose',plan})});
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({error:'plan_scale_violation:harmony'});
  expect(src.tracks).toHaveLength(1);
 });
 it('passes the numeric variation seed as model context and rejects invalid seeds at API boundary',async()=>{
  const src={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'src',pitch:60,startTick:0,durationTicks:480,velocity:80}]}]};
  let seenSeed:number|undefined;
  const factory=()=>({id:'mock',async generate(ctx:{seed?:number}){seenSeed=ctx.seed;return {tracks:[
   {role:'harmony',notes:[{pitch:64,startTick:0,durationTicks:480,velocity:80}]},
   {role:'bass',notes:[{pitch:36,startTick:0,durationTicks:480,velocity:80}]},
   {role:'accompaniment',notes:[{pitch:55,startTick:0,durationTicks:480,velocity:80}]}
  ]};}});
  const url=await launch({apiKey:'test',arrangerFactory:factory});
  const params={project:src,sourceTrackId:'melody',startTick:0,endTick:1920,instruction:'create',seed:12345};
  const send=async(body:unknown)=>fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  expect((await send(params)).status).toBe(200);
  expect(seenSeed).toBe(12345);
  const invalid=await send({...params,seed:-1});
  expect(invalid.status).toBe(422);
  expect((await invalid.json()).error).toBe('invalid_arrangement_seed');
 });
 it('reconstructs scoped read-only context from project and rejects forged context fields',async()=>{
  const melody={noteId:'melody-id',pitch:72,startTick:1920,durationTicks:480,velocity:90};
  const old={noteId:'target-id',pitch:64,startTick:1920,durationTicks:480,velocity:80};
  const bass={noteId:'protected-bass-id',pitch:36,startTick:1920,durationTicks:480,velocity:80};
  const source={...project,tracks:[
   {trackId:'melody',name:'Melody',locked:true,notes:[melody]},
   {trackId:'harmony',name:'Harmony',locked:false,notes:[old]},
   {trackId:'bass',name:'Bass',locked:true,notes:[bass]}
  ]};
  let editing:unknown;
  let calls=0;
  const arrangerFactory=()=>({id:'mock',async generate(ctx:{editing?:unknown}){
   calls++;editing=ctx.editing;
   return {role:'harmony',notes:[{pitch:67,startTick:1920,durationTicks:480,velocity:75}]};
  }});
  const url=await launch({apiKey:'fake',arrangerFactory});
  const payload={project:source,sourceTrackId:'melody',startTick:1920,endTick:3840,instruction:'replace harmony',
   editing:{targetTrackId:'harmony',targetRole:'harmony'}};
  const post=async(body:unknown)=>fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(body)});
  const success=await post(payload);
  expect(success.status).toBe(200);
  expect(await success.json()).toEqual({role:'harmony',notes:[{pitch:67,startTick:1920,durationTicks:480,velocity:75}]});
  expect(editing).toMatchObject({
   targetRole:'harmony',original:[old],protectedParts:[{trackIndex:2,notes:[bass]}]
  });
  expect(calls).toBe(1);
  const forged=await post({...payload,editing:{...payload.editing,protectedParts:[{trackIndex:1,notes:[]}]}});
  expect(forged.status).toBe(422);
  expect((await forged.json()).error).toBe('invalid_arrangement_editing');
  const locked=await post({...payload,editing:{targetTrackId:'bass',targetRole:'bass'}});
  expect(locked.status).toBe(422);
  expect((await locked.json()).error).toBe('track_locked');
  expect(calls).toBe(1);
 });
 it('rejects invalid one-role outputs without partially updating existing tracks',async()=>{
  const melody={noteId:'source',pitch:64,startTick:0,durationTicks:480,velocity:90};
  const src={...project,tracks:[
   {trackId:'melody',name:'Melody',locked:false,notes:[melody]},
   {trackId:'h',name:'Existing harmony',locked:false,notes:[{noteId:'old',pitch:67,startTick:0,durationTicks:480,velocity:80}]}
  ]};
  const factory=()=>({id:'bad',async generate(){return {tracks:[{role:'harmony',notes:[]}]};}});
  const url=await launch({apiKey:'fake',arrangerFactory:factory});
  const res=await fetch(url+'/api/arrange',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({project:src,sourceTrackId:'melody',startTick:0,endTick:1920,instruction:'rewrite',
    editing:{targetTrackId:'h',targetRole:'harmony'}})});
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({error:'generation_failed'});
  expect(src.tracks[1]?.notes).toHaveLength(1);
 });
 it('rejects occupied scope',async()=>{
  const occupied={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'old',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]};
  const url=await launch({apiKey:'fake',providerFactory:fakeFactory});
  const response=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:occupied})});
  expect(response.status).toBe(422);
 });
});
