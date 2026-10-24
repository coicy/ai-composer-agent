import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {proposeArrangement} from './arrange.js';
import {DEFAULT_REGISTERS} from '../planning/harmony-plan.js';
import {SeededArranger} from './seeded-arranger.js';
import type {ArrangementProvider} from './arrange.js';
const melody={noteId:'melody-1',pitch:64,startTick:0,durationTicks:480,velocity:91,locked:true};
const original:MusicProject={projectId:'p',revision:3,ppq:480,tracks:[{trackId:'source',name:'旋律',locked:true,notes:[melody]}]};
const note=(pitch:number,startTick=0)=>({pitch,startTick,durationTicks:480,velocity:84});
const tracks=()=>({tracks:[
 {role:'bass',notes:[note(40)]},
 {role:'accompaniment',notes:[note(55)]},
 {role:'harmony',notes:[note(68)]}
]});
const request={project:original,sourceTrackId:'source',startTick:0,endTick:1920,instruction:'Add fantasy-game harmony and bass'};
const fake=(value:unknown):ArrangementProvider=>({id:'mock',async generate(){return value;}});
describe('atomic three-track arrangement candidate',()=>{
 it('adds three independent tracks in a single revision without changing locked source',async()=>{
  const candidate=await proposeArrangement(fake(tracks()),request);
  expect(candidate.changes.operations.map(x=>x.type)).toEqual(['add_track','add_track','add_track']);
  expect(candidate.assessment.tonalProfile.status).toBe('insufficient');
  expect(candidate.assessment.chordSuggestions).toHaveLength(1);
  expect(candidate.assessment.disclaimer).toContain('启发式');
  expect(candidate.tracks.map(t=>t.name)).toEqual(['AI 和声','AI 低音','AI 伴奏']);
  expect(original.tracks).toHaveLength(1);
  const applied=applyChangeSet(original,candidate.changes);
  expect(applied.ok).toBe(true);
  if(applied.ok){
   expect(applied.project.revision).toBe(4);
   expect(applied.project.tracks).toHaveLength(4);
   expect(applied.project.tracks[0]).toEqual(original.tracks[0]);
  }
 });
 it('passes uncertain music context to provider without changing source',async()=>{
  let saw:{profile?:unknown;chords?:unknown}|undefined;
  const provider:ArrangementProvider={id:'spy',async generate(context){saw={profile:context.tonalProfile,chords:context.chordSuggestions};return tracks();}};
  await proposeArrangement(provider,request);
  expect(saw?.profile).toMatchObject({status:'insufficient',noteCount:1});
  expect(saw?.chords).toHaveLength(1);
  expect(original.tracks[0]?.notes).toEqual([melody]);
 });
 it('passes auto-weighted electronic style to a generic LLM but only returns advisory MIDI technique evidence',async()=>{
  let sawStyle:string|undefined,signature:string[]=[];
  const provider:ArrangementProvider={id:'electronic-style-spy',async generate(context){
   sawStyle=context.techniquePlan?.style;
   signature=context.techniquePlan?.choices.filter(x=>x.priority==='signature').map(x=>x.id)??[];
   expect(context.techniqueRequest?.style).toBe('house');
   return tracks();
  }};
  const candidate=await proposeArrangement(provider,{...request,electronicStyle:'house',seed:19501});
  expect(sawStyle).toBe('house');
  expect(signature).toContain('four_floor');
  expect(signature).toContain('offbeat_bass');
  expect(candidate.techniqueEvidence?.some(x=>x.id==='four_floor'&&x.state==='not_evaluable')).toBe(true);
  expect(candidate.techniqueEvidence?.some(x=>x.id==='offbeat_bass'&&x.state==='not_observed')).toBe(true);
  expect(candidate.changes.baseRevision).toBe(3);
  expect(original.revision).toBe(3);
  const noBass=await proposeArrangement(fake(tracks()),{...request,electronicStyle:'house',seed:19501,
   disabledTechniques:['offbeat_bass']});
  expect(noBass.techniquePlan?.choices.some(x=>x.id==='offbeat_bass')).toBe(false);
  await expect(proposeArrangement(fake(tracks()),{...request,
   disabledTechniques:['four_floor']})).rejects.toThrow('electronic_style_required');
 });
 it('enforces a strict user chord plan before commit while keeping source unchanged',async()=>{
  const plan={tonic:0,mode:'major' as const,degrees:[1] as const,registers:DEFAULT_REGISTERS,enforcement:{scale:'hard' as const,chords:'hard' as const,registers:'hard' as const}};
  const req={...request,plan};
  const chordOnlyViolation={tracks:tracks().tracks.map(t=>t.role==='harmony'?{...t,notes:[note(62)]}:t)};
  await expect(proposeArrangement(fake(chordOnlyViolation),req)).rejects.toThrow('plan_chords_violation');
  const generated=await proposeArrangement(new SeededArranger(),req);
  expect(generated.planFindings).toHaveLength(0);
  expect(generated.tracks).toHaveLength(3);
  expect(generated.plan?.degrees).toEqual([1]);
  expect(original.tracks[0]?.notes).toEqual([melody]);
 });
 it('permits soft preference warnings without silently repairing generated music',async()=>{
  const plan={tonic:0,mode:'major' as const,degrees:[1] as const,registers:DEFAULT_REGISTERS,enforcement:{scale:'soft' as const,chords:'soft' as const,registers:'soft' as const}};
  const candidate=await proposeArrangement(fake(tracks()),{...request,plan});
  expect(candidate.planFindings.some(f=>f.constraint==='chords')).toBe(true);
  expect(candidate.tracks.map(t=>t.notes[0]?.pitch)).toEqual([68,40,55]);
 });
 it('fails malformed plans before calling any provider',async()=>{
  let called=0;
  const spy:ArrangementProvider={id:'spy',async generate(){called++;return tracks();}};
  await expect(proposeArrangement(spy,{...request,plan:{tonic:0,mode:'major',degrees:[9]}} as never)).rejects.toThrow();
  expect(called).toBe(0);
 });
 it('rejects absent, extra and duplicate roles',async()=>{
  for(const invalid of [{tracks:tracks().tracks.slice(0,2)},{tracks:[...tracks().tracks.slice(0,2),tracks().tracks[0]]},{tracks:[...tracks().tracks,{role:'extra',notes:[note(60)]}]}]){
   await expect(proposeArrangement(fake(invalid),request)).rejects.toThrow();
  }
 });
 it('rejects extra fields, invalid MIDI data and out-of-scope notes',async()=>{
  const cases=[
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[{...note(40),locked:true}]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[note(140)]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[{...note(40),durationTicks:2000}]})},
   {tracks:tracks().tracks.map((t,i)=>i? t:{...t,notes:[]})}
  ];
  for(const invalid of cases)await expect(proposeArrangement(fake(invalid),request)).rejects.toThrow();
 });
 it('rejects empty source, missing source and scope greater than four bars',async()=>{
  const blank={...original,tracks:[{...original.tracks[0]!,notes:[]}]};
  await expect(proposeArrangement(fake(tracks()),{...request,project:blank})).rejects.toThrow('empty_source_range');
  await expect(proposeArrangement(fake(tracks()),{...request,sourceTrackId:'other'})).rejects.toThrow('source_track_not_found');
  await expect(proposeArrangement(fake(tracks()),{...request,endTick:9000})).rejects.toThrow('invalid_arrangement_scope');
 });
 it('rejects old revision and prevents ID collisions',async()=>{
  const candidate=await proposeArrangement(fake(tracks()),request);
  expect(applyChangeSet({...original,revision:4},candidate.changes)).toMatchObject({ok:false,reason:'stale_revision'});
  const colliding={...original,tracks:[...original.tracks,{trackId:candidate.tracks[0]!.trackId,name:'Existing',locked:false,notes:[]}]};
  await expect(proposeArrangement(fake(tracks()),{...request,project:colliding})).rejects.toThrow('arrangement_track_collision');
 });
});
