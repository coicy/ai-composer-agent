import {describe,it,expect} from 'vitest';
import {createCompositionBlueprint,validateCompositionBlueprint,blueprintWindow} from './composition-blueprint.js';

const req={seed:19501,style:'synthwave' as const,ppq:480,meter:{numerator:4,denominator:4},totalBars:16 as const};
describe('S2 song blueprint is an auditable creative plan, not generated MIDI',()=>{
 it('forms a contiguous 16-bar energy/motif arc across 4 equal sections',()=>{
  const p=createCompositionBlueprint(req);
  expect(p).toEqual(createCompositionBlueprint(req));
  expect(p.sections.map(s=>[s.kind,s.startTick,s.endTick,s.energy])).toEqual([
   ['opening',0,7680,28],['theme',7680,15360,62],
   ['development',15360,23040,82],['return',23040,30720,72]
  ]);
  expect(p.sections.every(s=>s.motifId==='primary-motif')).toBe(true);
  expect(p.sections[2]?.changeDimension).not.toBe('none');
  expect(p.sections[3]?.action).toBe('reprise');
  expect(validateCompositionBlueprint(p)).toEqual(p);
 });
 it('uses actual compound-meter Tick mathematics rather than four quarter notes',()=>{
  const p=createCompositionBlueprint({...req,style:'trance',meter:{numerator:6,denominator:8},totalBars:12});
  expect(p.sections).toHaveLength(4);
  expect(p.sections[0]?.endTick).toBe(4320);
  expect(p.sections.at(-1)?.endTick).toBe(17280);
  expect(blueprintWindow(p,4320,5760).sections[0]).toMatchObject({
   kind:'theme',activeStartTick:4320,activeEndTick:5760,motifId:'primary-motif'
  });
 });
 it('projects overlapping local slices without losing shared motif identity',()=>{
  const p=createCompositionBlueprint(req);
  const sliced=blueprintWindow(p,7200,8160);
  expect(sliced.sections.map(s=>s.kind)).toEqual(['opening','theme']);
  expect(sliced.sections.map(s=>[s.activeStartTick,s.activeEndTick])).toEqual([[7200,7680],[7680,8160]]);
  expect(sliced.motifId).toBe('primary-motif');
  expect(()=>blueprintWindow(p,-1,1920)).toThrow('blueprint_window_out_of_scope');
  expect(()=>blueprintWindow(p,30700,31000)).toThrow('blueprint_window_out_of_scope');
 });
 it('rejects malformed user-edited section plan before it can influence the LLM',()=>{
  const p=createCompositionBlueprint(req);
  expect(()=>validateCompositionBlueprint({...p,sections:[...p.sections.slice(0,1),{...p.sections[1]!,startTick:7200},...p.sections.slice(2)]})).toThrow('blueprint_section_mismatch');
  expect(()=>validateCompositionBlueprint({...p,totalBars:20})).toThrow('invalid_blueprint_bars');
  expect(()=>createCompositionBlueprint({...req,meter:{numerator:7,denominator:3}})).toThrow('invalid_blueprint_meter');
  expect(()=>createCompositionBlueprint({...req,seed:-1})).toThrow('invalid_blueprint_seed');
  expect(()=>createCompositionBlueprint({...req,mainMotifId:'../../secret'})).toThrow('invalid_blueprint_motif');
 });
 it('maintains deterministic phrase variations while allowing different seeds',()=>{
  const changes=new Set(Array.from({length:32},(_,seed)=>createCompositionBlueprint({...req,seed}).sections[2]?.changeDimension));
  expect(changes.size).toBeGreaterThan(1);
  const ambient=createCompositionBlueprint({...req,style:'ambient'});
  expect(ambient.sections[2]?.energy).toBeLessThan(createCompositionBlueprint({...req,style:'trance'}).sections[2]!.energy);
  expect(ambient.sections[3]?.guidance).toContain('Reprise');
 });
});
