import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import type {ArrangementProvider} from './arrange.js';
import {buildRuinsDevelopmentPlan,extractMotifIdentity} from '../planning/motif-development.js';
import {orchestrateSongArrangement} from './song-orchestrator.js';
const bar=1920;
const src=Array.from({length:6},(_,section)=>[60,62,61].map((pitch,i)=>({
 noteId:'src-'+section+'-'+i,pitch,startTick:section*4*bar+i*480,durationTicks:240,velocity:80
}))).flat();
const project:MusicProject={projectId:'ruins',revision:7,ppq:480,tracks:[{trackId:'lead',name:'lead',locked:true,notes:src}]};
const plan=buildRuinsDevelopmentPlan(extractMotifIdentity('A','lead',src.slice(0,3)));
const provider:ArrangementProvider={id:'fake-llm',async generate(context){
 const start=context.startTick;
 return {tracks:[
  {role:'harmony',notes:[{pitch:52,startTick:start,durationTicks:480,velocity:62}]},
  {role:'bass',notes:[{pitch:40,startTick:start,durationTicks:480,velocity:58}]},
  {role:'accompaniment',notes:[60,62,61].map((pitch,i)=>({pitch,startTick:start+240+i*480,durationTicks:240,velocity:80}))}
 ]};
}};
describe('song orchestration',()=>{
 it('stages all six windows, retaining original project and motif memory',async()=>{
  const before=JSON.stringify(project);
  const result=await orchestrateSongArrangement(provider,{project,sourceTrackId:'lead',developmentPlan:plan,instruction:'Mysterious ruins exploration',maxAttemptsPerWindow:1});
  expect(result.windows).toHaveLength(6);
  expect(result.changes.operations).toHaveLength(18);
  expect(result.motifMemory[0]?.completedWindows).toHaveLength(6);
  expect(result.committed).toBe(false);
  expect(result.status).toBe('review_required');
  expect(JSON.stringify(project)).toEqual(before);
 });
 it('fails before any model call when a source phrase is missing',async()=>{
  let called=0;
  const missingProject={...project,tracks:[{...project.tracks[0]!,notes:src.slice(0,3)}]};
  const p:ArrangementProvider={id:'mock',async generate(){called++;return {tracks:[]};}};
  await expect(orchestrateSongArrangement(p,{project:missingProject,sourceTrackId:'lead',developmentPlan:plan,instruction:'explore'}))
   .rejects.toThrow('song_window_missing_source_or_exceeds_four_bars');
  expect(called).toBe(0);
 });
});
