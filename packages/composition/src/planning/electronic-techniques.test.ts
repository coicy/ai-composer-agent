import {describe,it,expect} from 'vitest';
import {listElectronicTechniques,recommendElectronicTechniques,proposeElectronicTechniqueVariations} from './electronic-techniques.js';
const initial={style:'house' as const,seed:19501};
describe('weighted electronic technique planner — LLM instructions only',()=>{
 it('emits recognizable critical house anchors without making aesthetic guarantees',()=>{
  const plan=recommendElectronicTechniques(initial);
  expect(plan.version).toBe('electronic-technique-plan-v1');
  expect(plan.choices.some(x=>x.id==='four_floor'&&x.priority==='signature')).toBe(true);
  expect(plan.choices.some(x=>x.id==='offbeat_bass'&&x.priority==='signature')).toBe(true);
  expect(plan.choices.some(x=>x.id==='chord_stabs'&&x.priority==='signature')).toBe(true);
  expect(plan.choices.every(x=>x.canDisable)).toBe(true);
  expect(plan.choices.every(x=>x.evidence==='genre_design_heuristic')).toBe(true);
 });
 it('preserves style anchors and varies creative gestures across candidates',()=>{
  const v=proposeElectronicTechniqueVariations(initial,4);
  expect(v).toHaveLength(4);
  expect(new Set(v.map(x=>x.gestures.join(','))).size).toBeGreaterThan(1);
  expect(v.every(x=>x.choices.some(c=>c.id==='four_floor'))).toBe(true);
  expect(v).toEqual(proposeElectronicTechniqueVariations(initial,4));
 });
 it('honors explicit avoidance even for the strongest style signature',()=>{
  const plan=recommendElectronicTechniques({...initial,disabled:['four_floor','offbeat_bass']});
  expect(plan.choices.some(c=>c.id==='four_floor'||c.id==='offbeat_bass')).toBe(false);
  expect(plan.choices.some(c=>c.slot==='drums')).toBe(true);
  const noDrums=recommendElectronicTechniques({
   ...initial,disabled:['four_floor','retro_backbeat','breakbeat_two_step','sparse_pulse']
  });
  expect(noDrums.choices.some(c=>c.slot==='drums')).toBe(false);
 });
 it('allows a user to force a non-default but compatible technique',()=>{
  const plan=recommendElectronicTechniques({...initial,forced:['alberti']});
  expect(plan.choices.find(c=>c.slot==='harmony_motion')?.id).toBe('alberti');
  expect(()=>recommendElectronicTechniques({...initial,forced:['alberti','chord_stabs']})).toThrow('conflicting_technique_slots');
  expect(()=>recommendElectronicTechniques({...initial,forced:['offbeat_bass'],disabled:['offbeat_bass']})).toThrow('conflicting_technique_override');
 });
 it('does not force drums into ambient music',()=>{
  const plan=recommendElectronicTechniques({style:'ambient',seed:0});
  expect(plan.choices.some(c=>c.slot==='drums')).toBe(false);
  expect(plan.choices.some(c=>c.id==='pad_chords')).toBe(true);
  expect(plan.choices.some(c=>c.id==='sub_drone')).toBe(true);
 });
 it('supports representative core identities for techno, trance, DnB and synthwave',()=>{
  for(const [style,id] of [
   ['techno','ostinato'],['trance','arpeggio_ascending'],
   ['drum_and_bass','breakbeat_two_step'],['synthwave','arpeggio_pingpong']
  ] as const){
   const plan=recommendElectronicTechniques({style,seed:7});
   expect(plan.choices.some(x=>x.id===id&&x.priority==='signature')).toBe(true);
  }
 });
 it('enforces validated seed, genre, capacity and catalog identity',()=>{
  expect(listElectronicTechniques().length).toBeGreaterThanOrEqual(16);
  expect(new Set(listElectronicTechniques().map(x=>x.id)).size).toBe(listElectronicTechniques().length);
  for(const seed of [-1,0x100000000,NaN,4.2])
   expect(()=>recommendElectronicTechniques({...initial,seed})).toThrow('invalid_technique_seed');
  expect(()=>recommendElectronicTechniques({...initial,style:'edm-anything' as never})).toThrow('invalid_electronic_style');
  expect(()=>recommendElectronicTechniques({...initial,disabled:['other' as never]})).toThrow('invalid_technique_override');
  expect(()=>proposeElectronicTechniqueVariations(initial,5)).toThrow('invalid_technique_variation_count');
 });
});