import {describe,it,expect} from 'vitest';
import {prepareArrangementContext} from './arrange.js';
import {buildRuinsDevelopmentPlan,extractMotifIdentity} from '../planning/motif-development.js';
import type {MusicProject} from '@ai-composer/music-core';
const notes=[60,62,65,64].map((pitch,i)=>({noteId:'m'+i,pitch,startTick:i*480,durationTicks:480,velocity:80}));
const project:MusicProject={projectId:'development-integration',revision:0,ppq:480,tracks:[{trackId:'lead',name:'Lead',locked:true,notes}]};
const plan=buildRuinsDevelopmentPlan(extractMotifIdentity('motif-a','lead',notes));
describe('arrangement development context',()=>{
 it('transfers real motif operation and exact active window to the provider',()=>{
  const context=prepareArrangementContext({project,sourceTrackId:'lead',startTick:0,endTick:1920,instruction:'Develop the sparse exploration motif',developmentPlan:plan});
  expect(context.developmentGuidance).toMatchObject({operation:'introduce',motifId:'motif-a',startTick:0,endTick:7680});
  expect(context.sourceNotes).toHaveLength(4);
 });
 it('refuses unverifiable motif provenance',()=>{
  const bad={...plan,motifs:[{...plan.motifs[0]!,noteIds:['unknown',...plan.motifs[0]!.noteIds.slice(1)]}]};
  expect(()=>prepareArrangementContext({project,sourceTrackId:'lead',startTick:0,endTick:1920,instruction:'explore',developmentPlan:bad})).toThrow('development_motif_source_missing');
 });
 it('refuses an arrangement slice straddling different development instructions',()=>{
  expect(()=>prepareArrangementContext({project,sourceTrackId:'lead',startTick:7200,endTick:8640,instruction:'explore',developmentPlan:plan})).toThrow('development_window_crosses_scope');
 });
});
