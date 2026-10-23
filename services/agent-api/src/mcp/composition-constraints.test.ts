import {describe,expect,it} from 'vitest';
import {checkCandidate,explainSpec,parseMusicSpec} from './composition-constraints.js';
function spec(overrides:Record<string,unknown>={}){
 return parseMusicSpec({
  tonic:2,mode:'dorian',meter:'4/4',groove:'swing',startTick:0,endTick:1920,
  ...overrides
 },480);
}
const dorian=[
 {pitch:62,startTick:0,durationTicks:320,velocity:88}, // D4
 {pitch:65,startTick:320,durationTicks:160,velocity:73}, // F4, late offbeat
 {pitch:71,startTick:480,durationTicks:320,velocity:90}, // B4 (Dorian natural 6)
 {pitch:69,startTick:800,durationTicks:160,velocity:77} // A4, late offbeat
];
describe('reference-guided composition — deterministic and auditable, not AI generation',()=>{
 it('checks the characteristic Dorian sixth instead of treating Dorian as natural minor',()=>{
  const result=checkCandidate(dorian,spec());
  expect(result.passed).toBe(true);
  expect(result.modeEvidence).toMatchObject({scaleCompliant:true,status:'candidate_pitch_class_check_only'});
  expect(result.grooveEvidence).toMatchObject({
   status:'matches_requested_eighth_offbeat_target',
   observedOffbeats:2,matchedOffbeats:2,
   targetOffbeatPhaseTicks:320
  });
  expect(explainSpec(spec()).allowedPitchClassesC0ToB11).toEqual([0,2,4,5,7,9,11]);
  const wrong=[...dorian,{pitch:70,startTick:960,durationTicks:480,velocity:85}]; // Bb
  const failed=checkCandidate(wrong,spec());
  expect(failed.passed).toBe(false);
  expect(failed.diagnostics.some(e=>e.code==='out_of_scale_pitch'&&'noteIndex' in e&&e.noteIndex===4)).toBe(true);
  const chromatic=checkCandidate(wrong,spec({allowChromatic:true}));
  expect(chromatic.passed).toBe(true);
  expect(chromatic.diagnostics.some(e=>e.code==='out_of_scale_pitch'&&e.severity==='warning')).toBe(true);
 });
 it('distinguishes straight eighth and late triplet offbeat targets without claiming artistic swing',()=>{
  const straight=checkCandidate(dorian,spec({groove:'straight'}));
  expect(straight.passed).toBe(true);
  expect(straight.grooveEvidence.status).toBe('timing_deviates');
  expect(straight.diagnostics.some(e=>e.code==='groove_timing_deviation')).toBe(true);
  const triplet=checkCandidate(dorian,spec({groove:'shuffle'}));
  expect(triplet.grooveEvidence.status).toBe('matches_requested_eighth_offbeat_target');
  expect(triplet.diagnostics.some(e=>e.code==='shuffle_requires_phrase_evidence')).toBe(true);
 });
 it('records missing rhythmic evidence rather than pretending Swing was validated',()=>{
  const quarters=[{pitch:62,startTick:0,durationTicks:480,velocity:80},
    {pitch:65,startTick:480,durationTicks:480,velocity:85}];
  const result=checkCandidate(quarters,spec());
  expect(result.passed).toBe(true);
  expect(result.grooveEvidence.status).toBe('insufficient_evidence');
  expect(result.diagnostics.some(e=>e.code==='groove_not_observable')).toBe(true);
 });
 it('checks user-declared compound meter ticks without assuming the project stores a meter map',()=>{
  const sixEight=spec({meter:'6/8',endTick:2880});
  expect(explainSpec(sixEight).meterTicksPerBar).toBe(1440);
  expect(explainSpec(sixEight).proposedOffbeatPositionWithinQuarterTicks).toBe(320);
  expect(()=>spec({meter:'17/8'})).toThrow('invalid_meter');
  expect(()=>spec({meter:'7/3'})).toThrow('invalid_meter');
  expect(()=>spec({mode:'super_dorian'})).toThrow('invalid_mode');
  expect(()=>spec({tonic:12})).toThrow('invalid_tonic');
 });
 it('rejects out-of-scope and illegal pitch/time values, without mutating original notes',()=>{
  const input=structuredClone(dorian);
  const long=[...dorian,{pitch:62,startTick:1900,durationTicks:240,velocity:85}];
  expect(checkCandidate(long,spec()).diagnostics.some(e=>e.code==='note_outside_requested_scope')).toBe(true);
  expect(checkCandidate([...dorian,{pitch:128,startTick:960,durationTicks:120,velocity:90}],spec()).passed).toBe(false);
  expect(checkCandidate([...dorian,{pitch:60,startTick:960,durationTicks:0,velocity:90}],spec()).passed).toBe(false);
  expect(dorian).toEqual(input);
 });
});
