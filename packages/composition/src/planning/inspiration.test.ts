import {describe,expect,it} from 'vitest';
import {drawMusicalInspiration} from './inspiration.js';
import type {InspirationInput} from './inspiration.js';

const base:InspirationInput={
 seed:19501,level:'balanced',ppq:480,
 meter:'4/4',mode:'dorian',groove:'shuffle',
 startTick:0,endTick:7680,editableOtherTracks:2
};
function draw(v:Partial<InspirationInput>={}){return drawMusicalInspiration({...base,...v});}

describe('musical inspiration — reproducible optional ideas, not algorithmic composition',()=>{
 it('returns the same versioned cards for the same seed and user constraints',()=>{
  expect(draw()).toEqual(draw());
  const result=draw();
  expect(result.algorithm).toBe('musical-inspiration-v1');
  expect(result.seed).toBe(19501);
  expect(result.cards).toHaveLength(3);
  expect(new Set(result.cards.map(c=>c.axis)).size).toBe(result.cards.length);
  expect(result.cards.every(c=>c.instruction.length>35)).toBe(true);
  expect(result.briefLines).toHaveLength(3);
  expect(JSON.stringify(result)).not.toContain('noteId');
 });
 it('gives different but controlled idea sets under different seeds',()=>{
  const sets=new Set(Array.from({length:40},(_,i)=>
   draw({seed:i}).cards.map(c=>c.id).join(',')));
  expect(sets.size).toBeGreaterThan(15);
  for(let i=0;i<40;i++){
   const pack=draw({seed:i});
   expect(pack.cards.every(c=>c.intensity!=='high')).toBe(true);
   expect(pack.cards).toHaveLength(3);
  }
 });
 it('offers explicit low/medium/high novelty budgets',()=>{
  const subtle=draw({level:'subtle'});
  expect(subtle.cards).toHaveLength(2);
  expect(subtle.cards.every(c=>c.intensity==='low')).toBe(true);
  const bold=draw({level:'adventurous'});
  expect(bold.cards).toHaveLength(4);
  expect(bold.cards.every(c=>['low','medium','high'].includes(c.intensity))).toBe(true);
 });
 it('never suggests cross-track rewrites when no other unlocked track exists',()=>{
  const results=Array.from({length:70},(_,seed)=>draw({seed,editableOtherTracks:0,level:'adventurous'}));
  const restricted=new Set(['t_reply','t_subtract']);
  expect(results.every(p=>p.cards.every(c=>!restricted.has(c.id)))).toBe(true);
  expect(results.every(p=>new Set(p.cards.map(c=>c.axis)).size===p.cards.length)).toBe(true);
 });
 it('selects compound-meter cards only under compound meter',()=>{
  const simple=Array.from({length:90},(_,seed)=>draw({seed,level:'adventurous'}));
  expect(simple.every(p=>!p.cards.some(c=>c.id==='r_compound'))).toBe(true);
  const compound=Array.from({length:90},(_,seed)=>draw({
   seed,level:'adventurous',meter:'6/8',endTick:5760,
   focus:['rhythm']
  }));
  expect(compound.some(p=>p.cards.some(c=>c.id==='r_compound'))).toBe(true);
  expect(compound.every(p=>p.cards.length===1)).toBe(true);
 });
 it('rejects optional card ideas that require more measures than the user's scope',()=>{
  const short=Array.from({length:50},(_,seed)=>draw({
   seed,level:'adventurous',startTick:0,endTick:1920
  }));
  expect(short.every(p=>p.cards.every(c=>!['f_three_one','f_reprise','m_question','m_fragment'].includes(c.id)))).toBe(true);
  expect(short.every(p=>p.target.scopeBars===1)).toBe(true);
 });
 it('does not give mutually contradictory density instructions in the same pack',()=>{
  for(let seed=0;seed<150;seed++){
   const ids=draw({seed,level:'adventurous'}).cards.map(c=>c.id);
   const sparse=['r_breath','h_rhythm','t_subtract','f_pause'].some(id=>ids.includes(id));
   const dense=['r_syncopation'].some(id=>ids.includes(id));
   expect(sparse&&dense).toBe(false);
  }
 });
 it('rejects invalid seeds and dangerous/fabricated or duplicated focus axes',()=>{
  for(const seed of [-1,0x100000000,1.2,Number.NaN] ){
   expect(()=>draw({seed})).toThrow('invalid_inspiration_seed');
  }
  expect(()=>draw({meter:'7/3'})).toThrow('invalid_inspiration_meter');
  expect(()=>draw({ppq:0})).toThrow('invalid_inspiration_ppq');
  expect(()=>draw({mode:'made_up' as InspirationInput['mode']})).toThrow('invalid_inspiration_mode');
  expect(()=>draw({focus:[]})).toThrow('invalid_inspiration_focus');
  expect(()=>draw({focus:['rhythm','rhythm']})).toThrow('invalid_inspiration_focus');
  expect(()=>draw({focus:['../secrets' as unknown as 'rhythm']})).toThrow('invalid_inspiration_focus');
  expect(()=>draw({startTick:480,endTick:480})).toThrow('invalid_inspiration_scope');
 });
 it('is unaffected by global Math.random state',()=>{
  const before=draw();
  const random=Math.random;
  try{
   Math.random=()=>{throw Error('global randomness forbidden');};
   expect(draw()).toEqual(before);
  }finally{Math.random=random;}
 });
});
