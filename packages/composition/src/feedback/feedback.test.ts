import {describe,it,expect} from 'vitest';
import {interpretFeedbackRules,validateFeedbackInput,validateFeedbackInterpretation,hasActionableFeedback,reconcileFeedbackInterpretation} from './feedback.js';
describe('reviewable musical feedback interpretation',()=>{
 it('parses explicit Chinese constraints without inventing stylistic numeric values',()=>{
  const out=interpretFeedbackRules('保留前三个音，后面跳进不超过五个半音，节奏不变',8);
  expect(out).toMatchObject({pitchOnly:true,protectedPrefixCount:3,maxLeapSemitones:5,unresolved:[]});
  expect(hasActionableFeedback(out)).toBe(true);
  expect(interpretFeedbackRules('保留开头2个音符，最大跳进不超过12个半音',5))
   .toMatchObject({protectedPrefixCount:2,maxLeapSemitones:12});
 });
 it('handles ambiguous style without guessing a hard limit',()=>{
  const out=interpretFeedbackRules('第二小节的和声太平淡，要更有张力',5);
  expect(out.pitchOnly).toBe(false);
  expect(out.protectedPrefixCount).toBeNull();
  expect(out.maxLeapSemitones).toBeNull();
  expect(out.unresolved.length).toBeGreaterThan(0);
  expect(hasActionableFeedback(out)).toBe(false);
 });
 it('reports invalid, contradictory, all-protected amounts without silent clamping',()=>{
  expect(interpretFeedbackRules('保留前3个音，保留前4个音',6).protectedPrefixCount).toBeNull();
  expect(interpretFeedbackRules('保留前6个音',6).unresolved.join('')).toContain('不能保护');
  expect(interpretFeedbackRules('跳进不超过25个半音',6).maxLeapSemitones).toBeNull();
  expect(interpretFeedbackRules('保持原有节奏',6).pitchOnly).toBe(true);
 });
 it('rejects malformed or over-authorized AI suggestions',()=>{
  const ok={pitchOnly:true,protectedPrefixCount:2,maxLeapSemitones:5,
   explanation:'提议保留前两音',unresolved:[]};
  expect(validateFeedbackInterpretation(ok,3)).toEqual(ok);
  for(const candidate of [
   {...ok,protectedPrefixCount:3},
   {...ok,maxLeapSemitones:30},
   {...ok,project:{tracks:[]}},
   {...ok,pitchOnly:false},
   {...ok,unresolved:['']},
   {...ok,explanation:'x'.repeat(401)}
  ])expect(()=>validateFeedbackInterpretation(candidate,3)).toThrow('invalid_feedback_interpretation');
  expect(()=>validateFeedbackInput('',3)).toThrow('invalid_feedback_text');
  expect(()=>validateFeedbackInput('valid',0)).toThrow('invalid_feedback_note_count');
 });
});

describe('feedback for explicitly numbered protected notes',()=>{
 it('parses one-based Chinese and Arabic ordinals, keeping them separate from a protected prefix',()=>{
  const only=interpretFeedbackRules('保留第2个音符',5);
  expect(only.protectedNoteOrdinals).toEqual([2]);
  expect(only.protectedPrefixCount).toBeNull();
  expect(only.pitchOnly).toBe(true);
  const combined=interpretFeedbackRules('保留第2和第4个音符，跳进不超过五个半音',6);
  expect(combined.protectedNoteOrdinals).toEqual([2,4]);
  expect(combined.maxLeapSemitones).toBe(5);
  expect(combined.explanation).toContain('第 2、4 个音符');
  const named=interpretFeedbackRules('固定第二个音符',5);
  expect(named.protectedNoteOrdinals).toEqual([2]);
 });
 it('does not mistake first-N, bar number or subjective opinions for numbered note IDs',()=>{
  expect(interpretFeedbackRules('保留前两个音符',6).protectedNoteOrdinals).toEqual([]);
  expect(interpretFeedbackRules('把第二小节写得更丰富',6).protectedNoteOrdinals).toEqual([]);
  expect(interpretFeedbackRules('曲风更有张力',6).protectedNoteOrdinals).toEqual([]);
 });
 it('rejects out-of-range, duplicate, all-protected and unauthorized model proposals',()=>{
  const base={pitchOnly:true,protectedPrefixCount:null,protectedNoteOrdinals:[2,4],
   maxLeapSemitones:null,explanation:'explicit',unresolved:[]};
  expect(validateFeedbackInterpretation(base,5)).toEqual(base);
  for(const partial of [
   {protectedNoteOrdinals:[0]},
   {protectedNoteOrdinals:[2,2]},
   {protectedNoteOrdinals:[6]},
   {protectedNoteOrdinals:[1,2,3,4,5]},
   {protectedNoteOrdinals:['1']},
   {protectedPrefixCount:2,protectedNoteOrdinals:[3,4,5]},
   {pitchOnly:false}
  ])expect(()=>validateFeedbackInterpretation({...base,...partial},5))
   .toThrow('invalid_feedback_interpretation');
  const out=interpretFeedbackRules('保留第8个音符',5);
  expect(out.protectedNoteOrdinals).toEqual([]);
  expect(out.unresolved.join('')).toContain('超出');
  expect(interpretFeedbackRules('保留第1和第2个音符',2).protectedNoteOrdinals).toEqual([]);
 });
});

describe('evidence reconciliation of AI feedback',()=>{
 const suggest=(more:Record<string,unknown>={})=>({
  pitchOnly:true,protectedPrefixCount:2,protectedNoteOrdinals:[],maxLeapSemitones:5,
  explanation:'AI interpretation',unresolved:[],...more
 });
 it('never converts subjective style requests into invented hard MIDI constraints',()=>{
  const actual=reconcileFeedbackInterpretation('让第二小节更有张力，更戏剧化',5,suggest({
   protectedNoteOrdinals:[3]
  }));
  expect(actual).toMatchObject({pitchOnly:false,protectedPrefixCount:null,
   protectedNoteOrdinals:[],maxLeapSemitones:null});
  expect(actual.unresolved.join('')).toContain('原文');
  expect(hasActionableFeedback(actual)).toBe(false);
 });
 it('accepts only explicitly grounded numerical and ordinal requests',()=>{
  const actual=reconcileFeedbackInterpretation(
   '保留前两个音，保留第4个音符，最大跳进不超过五个半音，节奏不变',6,
   suggest({protectedNoteOrdinals:[4]})
  );
  expect(actual).toMatchObject({pitchOnly:true,protectedPrefixCount:2,
   protectedNoteOrdinals:[4],maxLeapSemitones:5,
   explanation:'AI interpretation',unresolved:[]});
 });
 it('demotes only unsupported suggestions, preserving supported user constraints',()=>{
  const actual=reconcileFeedbackInterpretation('保留前两个音，保持节奏',5,suggest({
   protectedNoteOrdinals:[3],maxLeapSemitones:8
  }));
  expect(actual.pitchOnly).toBe(true);
  expect(actual.protectedPrefixCount).toBe(2);
  expect(actual.protectedNoteOrdinals).toEqual([]);
  expect(actual.maxLeapSemitones).toBeNull();
  expect(actual.unresolved.length).toBeGreaterThanOrEqual(2);
  expect(actual.explanation).toContain('撤回');
 });
 it('treats an explicitly numbered first note as equivalent to prefix one only',()=>{
  const actual=reconcileFeedbackInterpretation('保留第一个音，跳进不超过五个半音',4,
   suggest({protectedPrefixCount:1,protectedNoteOrdinals:[],maxLeapSemitones:5}));
  expect(actual.protectedPrefixCount).toBe(1);
  expect(actual.maxLeapSemitones).toBe(5);
 });
 it('rejects invalid model output before reconciliation and bounds unresolved claims',()=>{
  expect(()=>reconcileFeedbackInterpretation('保持节奏',4,suggest({maxLeapSemitones:99})))
   .toThrow('invalid_feedback_interpretation');
  const actual=reconcileFeedbackInterpretation('太平淡了',5,suggest({
   unresolved:['一','二','三','四','五','六']
  }));
  expect(actual.unresolved.length).toBeLessThanOrEqual(6);
  expect(actual.unresolved[0]).toContain('原文');
 });
});
