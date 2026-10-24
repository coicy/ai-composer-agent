import {describe,it,expect} from 'vitest';
import {proposeDrumWithRetry} from './drum-retry.js';
import type {MusicProject} from '@ai-composer/music-core';
const project:MusicProject={projectId:'retry',revision:0,ppq:480,tracks:[]};
const request={project,style:'house' as const,startTick:0,endTick:1920,seed:17,instruction:'Create a House beat'};
const mk=(tick:number)=>({pitch:36,startTick:tick,durationTicks:120,velocity:100});
describe('bounded drum retry',()=>{
 it('retries only a demonstrably absent kick and keeps the original project immutable',async()=>{
  const received:string[]=[];
  const p={id:'mock',async generateDrums(ctx:{instruction:string}){
   received.push(ctx.instruction);
   return {notes:received.length===1?[mk(0)]:[mk(0),mk(480),mk(960),mk(1440)]};
  }};
  const before=JSON.stringify(project),result=await proposeDrumWithRetry(p,request);
  expect(result.status).toBe('signature_observed');
  expect(result.attempts).toBe(2);
  expect(received[1]).toContain('480, 960, 1440');
  expect(JSON.stringify(project)).toBe(before);
 });
 it('stops after a hard cap without falsely reporting success',async()=>{
  const r=await proposeDrumWithRetry({id:'mock',async generateDrums(){return {notes:[mk(0)]};}},request,2);
  expect(r.status).toBe('signature_not_observed');
  expect(r.attempts).toBe(2);
 });
 it('does not repeat a non-evaluable ambient cue',async()=>{
  const r=await proposeDrumWithRetry({id:'mock',async generateDrums(){return {notes:[mk(0)]};}},
   {...request,style:'ambient'},3);
  expect(r.status).toBe('unverifiable');
  expect(r.attempts).toBe(1);
 });
 it('rejects invalid attempt counts',async()=>{
  await expect(proposeDrumWithRetry({id:'x',async generateDrums(){return {notes:[mk(0)]};}},request,10)).rejects.toThrow();
 });
});
