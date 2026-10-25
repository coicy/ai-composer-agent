import {describe,it,expect} from 'vitest';
import {extractMotifIdentity,buildRuinsDevelopmentPlan,validateMotifDevelopmentPlan} from './motif-development.js';
const notes=[60,62,65,64].map((pitch,i)=>({noteId:'n'+i,pitch,startTick:i*480,durationTicks:480,velocity:70}));
describe('motif development planner',()=>{
 it('captures concrete source intervals and a six-stage 24-bar arc',()=>{
  const motif=extractMotifIdentity('A','lead',notes);
  expect(motif.anchorIntervals).toEqual([2,3,-1]);
  const plan=buildRuinsDevelopmentPlan(motif);
  expect(plan.windows.map(x=>x.operation)).toEqual([
   'introduce','rhythmic_augmentation','fragmentation','harmonic_recontextualization','register_transfer','thematic_return'
  ]);
  expect(plan.windows.at(-1)?.endTick).toBe(46080);
  validateMotifDevelopmentPlan(plan);
 });
 it('rejects out-of-range windows and counterfeit motifs',()=>{
  const p=buildRuinsDevelopmentPlan(extractMotifIdentity('A','lead',notes));
  expect(()=>validateMotifDevelopmentPlan({...p,windows:[...p.windows.slice(0,5),{...p.windows[5]!,motifId:'missing'}]})).toThrow();
  expect(()=>validateMotifDevelopmentPlan({...p,windows:p.windows.slice(0,5)})).toThrow();
 });
 it('does not mutate source MIDI',()=>{
  const before=JSON.stringify(notes);
  buildRuinsDevelopmentPlan(extractMotifIdentity('A','lead',notes));
  expect(JSON.stringify(notes)).toBe(before);
 });
});
