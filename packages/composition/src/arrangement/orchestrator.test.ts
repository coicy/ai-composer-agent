import {describe,it,expect} from 'vitest';
import {orchestrateArrangement} from './orchestrator.js';
import {extractMotifIdentity,buildRuinsDevelopmentPlan} from '../planning/motif-development.js';
import type {MusicProject} from '@ai-composer/music-core';
import type {ArrangementProvider} from './arrange.js';
const source=[60,62,61].map((pitch,i)=>({noteId:'source-'+i,pitch,startTick:i*480,durationTicks:240,velocity:80}));
const project:MusicProject={projectId:'orchestrator',revision:0,ppq:480,tracks:[{trackId:'lead',name:'Lead',locked:true,notes:source}]};
const plan=buildRuinsDevelopmentPlan(extractMotifIdentity('motifA','lead',source));
const raw=(matching:boolean)=>({tracks:[
 {role:'harmony',notes:[{pitch:50,startTick:0,durationTicks:480,velocity:65}]},
 {role:'bass',notes:[{pitch:38,startTick:0,durationTicks:480,velocity:70}]},
 {role:'accompaniment',notes:[60,matching?62:58,matching?61:60].map((pitch,i)=>({pitch,startTick:240+i*480,durationTicks:240,velocity:78}))}
]});
const request={project,sourceTrackId:'lead',startTick:0,endTick:1920,instruction:'Develop this motif',developmentPlan:plan};
describe('automatic scoped arrangement orchestrator',()=>{
 it('retries only absent contours then returns reviewed, uncommitted candidate',async()=>{
  const instructions:string[]=[];
  const provider:ArrangementProvider={id:'mock-llm',async generate(ctx){
   instructions.push(ctx.instruction);
   return raw(instructions.length===2);
  }};
  const before=JSON.stringify(project);
  const run=await orchestrateArrangement(provider,request);
  expect(run.status).toBe('observed');
  expect(run.attempts).toBe(2);
  expect(run.committed).toBe(false);
  expect(run.history.map(x=>x.status)).toEqual(['not_observed','observed']);
  expect(run.memory[0]?.completedWindows[0]?.status).toBe('observed');
  expect(instructions[1]).toContain('Revision:');
  expect(JSON.stringify(project)).toBe(before);
 });
 it('does not retry on unverifiable evidence',async()=>{
  let n=0;
  const provider:ArrangementProvider={id:'mock-llm',async generate(){n++;return raw(true);}};
  const w={...plan.windows[0]!,operation:'harmonic_recontextualization' as const};
  const run=await orchestrateArrangement(provider,{...request,developmentPlan:{...plan,windows:[w,...plan.windows.slice(1)]}});
  expect(run.status).toBe('not_evaluable');
  expect(n).toBe(1);
 });
 it('rejects invalid retry budget',async()=>{
  await expect(orchestrateArrangement({id:'x',async generate(){return raw(true);}}, {...request,maxAttempts:5})).rejects.toThrow('invalid_orchestration_budget');
 });
});
