import {afterEach,describe,it,expect} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createAgentServer} from './server.js';
import type {MusicProject} from '@ai-composer/music-core';
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
 it('rejects occupied scope',async()=>{
  const occupied={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'old',pitch:60,startTick:0,durationTicks:480,velocity:90}]}]};
  const url=await launch({apiKey:'fake',providerFactory:fakeFactory});
  const response=await fetch(url+'/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,project:occupied})});
  expect(response.status).toBe(422);
 });
});
