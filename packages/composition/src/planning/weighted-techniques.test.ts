import {describe,it,expect} from 'vitest';
import {inferElectronicGenre,planElectronicTechniques} from './weighted-techniques.js';
import type {TechniqueContext} from './weighted-techniques.js';
const house:TechniqueContext={
 instruction:'Compose a House groove with distinctive bass and chord hits',
 startTick:0,endTick:7680,ppq:480,
 meter:{numerator:4,denominator:4},intent:{seed:19501}
};
describe('style-weighted technique planning, no automatic MIDI edits',()=>{
 it('activates from a single explicit genre hint and reports unavailable drums',()=>{
  const p=planElectronicTechniques(house);
  expect(p).not.toBeNull();
  expect(p).toMatchObject({genre:'house',detection:'instruction_hint',version:'weighted-techniques-v1'});
  expect(p?.assigned.map(x=>[x.role,x.id,x.weight])).toEqual([
   ['bass','offbeat_bass',94],
   ['accompaniment','syncopated_comp',88],
   ['harmony','pad',61]
  ]);
  expect(p?.deferred.some(x=>x.id==='four_on_floor'&&x.weight===100)).toBe(true);
  expect(p?.assigned.every(x=>x.variation?.startTick===5760)).toBe(true);
  expect(JSON.stringify(p)).not.toContain('approved:true');
 });
 it('ensures high genre signatures are preselected, not optional text-only suggestions',()=>{
  const trance=planElectronicTechniques({...house,intent:{genre:'trance',seed:18},instruction:'Music for a game'});
  expect(trance?.detection).toBe('explicit');
  expect(trance?.assigned.find(x=>x.role==='accompaniment')).toMatchObject({id:'arpeggio',weight:97,strength:'signature'});
  expect(trance?.assigned.find(x=>x.role==='bass')).toMatchObject({id:'offbeat_bass',weight:89});
  expect(trance?.deferred).toEqual(expect.arrayContaining([expect.objectContaining({id:'four_on_floor',role:'drums'})]));
  const synthwave=planElectronicTechniques({...house,intent:{genre:'synthwave',seed:22},instruction:'Game soundtrack'});
  expect(synthwave?.assigned.map(x=>x.id)).toEqual(['arpeggio','root_octave_bass','pad']);
 });
 it('never assigns unsupported drum MIDI to a pitched role',()=>{
  for(const g of ['house','techno','trance','synthwave','drum_and_bass','chiptune','ambient'] as const){
   const p=planElectronicTechniques({...house,intent:{genre:g}});
   expect(p?.assigned.every(x=>['harmony','bass','accompaniment'].includes(x.role))).toBe(true);
   expect(new Set(p?.assigned.map(x=>x.role)).size).toBe(p?.assigned.length);
   expect(p?.deferred.every(x=>x.role==='drums'||x.role==='structure')).toBe(true);
  }
  const dnb=planElectronicTechniques({...house,intent:{genre:'drum_and_bass'}});
  expect(dnb?.deferred).toEqual(expect.arrayContaining([expect.objectContaining({id:'breakbeat_drums',weight:100})]));
 });
 it('respects user exclusions and opt-out above any high genre weight',()=>{
  const p=planElectronicTechniques({...house,intent:{genre:'house',disabled:['offbeat_bass','four_on_floor']}});
  expect(p?.assigned.some(x=>x.id==='offbeat_bass')).toBe(false);
  expect(p?.deferred.some(x=>x.id==='four_on_floor')).toBe(false);
  expect(p?.suppressed.filter(x=>x.reason==='explicit_user_exclusion').map(x=>x.id)).toEqual(
   expect.arrayContaining(['offbeat_bass','four_on_floor'])
  );
  expect(planElectronicTechniques({...house,intent:{genre:'house',auto:false}})).toBeNull();
 });
 it('does not infer a definitive genre from unknown or mixed requests',()=>{
  expect(inferElectronicGenre('Write a joyful piano melody')).toBeNull();
  expect(inferElectronicGenre('House + Techno experimental fusion')).toBeNull();
  expect(planElectronicTechniques({...house,instruction:'Compose a warm piano theme',intent:undefined})).toBeNull();
  expect(inferElectronicGenre('Write a Synthwave track')).toBe('synthwave');
  expect(inferElectronicGenre('Compose drum & bass')).toBe('drum_and_bass');
 });
 it('produces deterministic, scoped, changing variations under multiple seeds',()=>{
  const x=planElectronicTechniques(house);
  expect(x).toEqual(planElectronicTechniques(house));
  const values=new Set(Array.from({length:40},(_,seed)=>
   planElectronicTechniques({...house,intent:{seed}})?.assigned.map(p=>p.variation?.instruction).join('|')));
  expect(values.size).toBeGreaterThan(1);
  const six=planElectronicTechniques({...house,meter:{numerator:6,denominator:8},endTick:5760});
  expect(six?.meter).toBe('6/8');
  expect(six?.assigned[0]?.variation?.startTick).toBe(4320);
  expect(six?.assigned.every(x=>x.variation!.endTick===5760)).toBe(true);
 });
 it('rejects unknown genres, invalid scopes and malformed or duplicate disabled rules',()=>{
  expect(()=>planElectronicTechniques({...house,intent:{genre:'dubstep' as never}})).toThrow('invalid_technique_intent');
  expect(()=>planElectronicTechniques({...house,intent:{genre:'house',seed:-1}})).toThrow('invalid_technique_seed');
  expect(()=>planElectronicTechniques({...house,intent:{genre:'house',disabled:['offbeat_bass','offbeat_bass']}})).toThrow('invalid_technique_exclusions');
  expect(()=>planElectronicTechniques({...house,intent:{genre:'house',disabled:['nonexistent' as never]}})).toThrow('invalid_technique_exclusions');
  expect(()=>planElectronicTechniques({...house,endTick:0})).toThrow('invalid_technique_scope');
  expect(()=>planElectronicTechniques({...house,meter:{numerator:7,denominator:3}})).toThrow('invalid_technique_meter');
 });
});
