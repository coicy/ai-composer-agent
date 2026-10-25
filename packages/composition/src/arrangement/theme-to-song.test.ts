import {describe,it,expect} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import type {CompositionProvider} from '../contracts/provider.js';
import type {ArrangementProvider} from './arrange.js';
import {composeRuinsThemeToSong} from './theme-to-song.js';
const project:MusicProject={projectId:'empty-ruins',revision:0,ppq:480,
 tracks:[{trackId:'lead',name:'Lead',locked:false,notes:[]}]};
let seen=0;
const melodyProvider:CompositionProvider={id:'mock-melody-llm',async generate(ctx){
 seen++;
 return {notes:[60,62,61].map((pitch,i)=>({pitch,startTick:ctx.startTick+i*480,durationTicks:240,velocity:76}))};
}};
const arranger:ArrangementProvider={id:'mock-arrangement-llm',async generate(ctx){
 const t=ctx.startTick;return {tracks:[
 {role:'harmony',notes:[{pitch:52,startTick:t,durationTicks:480,velocity:60}]},
 {role:'bass',notes:[{pitch:40,startTick:t,durationTicks:480,velocity:60}]},
 {role:'accompaniment',notes:[60,62,61].map((pitch,i)=>({pitch,startTick:t+240+i*480,durationTicks:240,velocity:70}))}
 ]};
}};
describe('end to end theme to song (mock general-LLM providers)',()=>{
 it('makes six novel-melody section candidates and stages full song without committing',async()=>{
  seen=0;const unchanged=JSON.stringify(project);
  const result=await composeRuinsThemeToSong(melodyProvider,arranger,{project,melodyTrackId:'lead',creativeBrief:'Sparse mysterious ruins exploration',maxAttemptsPerWindow:1});
  expect(seen).toBe(6);
  expect(result.melodyWindows).toHaveLength(6);
  expect(result.arrangement.windows).toHaveLength(6);
  expect(result.combinedChanges.operations).toHaveLength(36);
  expect(result.combinedChanges.baseRevision).toBe(0);
  expect(result.committed).toBe(false);
  expect(JSON.stringify(project)).toBe(unchanged);
 });
 it('rejects a preexisting melody before provider invocation',async()=>{
  seen=0;
  await expect(composeRuinsThemeToSong(melodyProvider,arranger,{
   project:{...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'existing',pitch:60,startTick:0,durationTicks:240,velocity:70}]}]},
   melodyTrackId:'lead',creativeBrief:'test'
  })).rejects.toThrow('theme_track_must_be_empty_and_editable');
  expect(seen).toBe(0);
 });
});
