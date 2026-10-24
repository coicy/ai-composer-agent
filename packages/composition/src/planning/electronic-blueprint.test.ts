import {describe,it,expect} from 'vitest';
import {buildElectronicCompositionBlueprint,locateBlueprintSection} from './electronic-blueprint.js';
import type {MusicProject} from '@ai-composer/music-core';
const project:MusicProject={projectId:'blue',revision:0,ppq:480,tempoBpm:124,
 meter:{numerator:4,denominator:4},tracks:[{trackId:'lead',name:'Lead',locked:true,notes:[]}]};
describe('coherent electronic song blueprint planning',()=>{
 it('plans 16 bars of identifiable sections with motif reprise and non-flat energy',()=>{
  const one=buildElectronicCompositionBlueprint({project,style:'house',seed:19501});
  const two=buildElectronicCompositionBlueprint({project,style:'house',seed:19501});
  expect(one).toEqual(two);
  expect(one.barCount).toBe(16);
  expect(one.timebase).toMatchObject({barTicks:1920,tempoBpm:124,meter:{numerator:4,denominator:4}});
  expect(one.sections.map(s=>s.kind)).toEqual(['intro','groove','contrast','return']);
  expect(one.sections.map(s=>s.motifId)).toEqual(['A','A','B','A']);
  expect(one.sections.map(s=>[s.startTick,s.endTick])).toEqual([
   [0,7680],[7680,15360],[15360,23040],[23040,30720]
  ]);
  expect(one.sections.map(s=>s.energy)).toEqual([38,68,43,82]);
  expect(one.sections.every(s=>s.techniquePlan.choices.some(t=>t.id==='four_floor'))).toBe(true);
  expect(locateBlueprintSection(one,7680,9600).kind).toBe('groove');
  expect(()=>locateBlueprintSection(one,7500,8200)).toThrow('blueprint_window_crosses_section');
 });
 it('reuses meter-consistent timebase for 6/8 and arbitrary PPQ',()=>{
  const p:MusicProject={...project,ppq:960,meter:{numerator:6,denominator:8}};
  const blueprint=buildElectronicCompositionBlueprint({project:p,style:'synthwave',seed:1,bars:8,startTick:2880});
  expect(blueprint.timebase.barTicks).toBe(2880);
  expect(blueprint.sections.map(x=>x.endTick-x.startTick)).toEqual([5760,5760,5760,5760]);
  expect(blueprint.sections.at(-1)?.endTick).toBe(2880+8*2880);
 });
 it('does not generate notes, mutate the project or validate audio timbre',()=>{
  const before=structuredClone(project);
  const blueprint=buildElectronicCompositionBlueprint({project,style:'ambient',seed:0});
  expect(project).toEqual(before);
  expect(JSON.stringify(blueprint)).not.toContain('noteId');
  expect(blueprint.sections.some(s=>s.energy>0)).toBe(true);
 });
 it('rejects truncated bars, unaligned starts, invalid seeds and illegal scopes',()=>{
  expect(()=>buildElectronicCompositionBlueprint({project,style:'house',seed:-1})).toThrow('invalid_blueprint_seed');
  expect(()=>buildElectronicCompositionBlueprint({project,style:'house',seed:1,bars:3})).toThrow('invalid_blueprint_bars');
  expect(()=>buildElectronicCompositionBlueprint({project,style:'house',seed:1,startTick:1})).toThrow('invalid_blueprint_start');
  expect(buildElectronicCompositionBlueprint({project,style:'house',seed:1,bars:20}).sections).toHaveLength(4);
 });
});