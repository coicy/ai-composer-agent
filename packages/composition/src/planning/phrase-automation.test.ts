import {describe,it,expect} from 'vitest';
import {planPhraseAutomation} from './phrase-automation.js';
const req={style:'synthwave' as const,seed:19501,ppq:480,startTick:0,bars:4,availableRoles:['bass','harmony','accompaniment'] as const};
describe('phrase automation',()=>{
 it('is deterministic, bounded, and returns gain to unity',()=>{
  const a=planPhraseAutomation(req);
  expect(a).toEqual(planPhraseAutomation(req));
  expect(a.curves.some(x=>x.lane==='filter_hz')).toBe(true);
  expect(a.curves.filter(x=>x.lane==='gain')).toHaveLength(3);
  for(const c of a.curves){
   expect(c.points.at(-1)?.tick).toBe(7680);
   expect(c.points.every((p,i)=>i===0||p.tick>c.points[i-1]!.tick)).toBe(true);
   if(c.lane==='gain')expect(c.points.at(-1)?.value).toBe(1);
  }
 });
 it('honors disable and only existing roles',()=>{
  const a=planPhraseAutomation({...req,availableRoles:['bass'],disabled:['gain']});
  expect(a.curves).toHaveLength(0);
 });
 it('rejects invalid scopes and lanes',()=>{
  expect(()=>planPhraseAutomation({...req,ppq:0})).toThrow('invalid_automation_request');
  expect(()=>planPhraseAutomation({...req,disabled:['gain','gain']})).toThrow('invalid_automation_request');
  expect(()=>planPhraseAutomation({...req,startTick:Number.MAX_SAFE_INTEGER})).toThrow();
 });
 it('never requires drums on ambient',()=>{
  const a=planPhraseAutomation({...req,style:'ambient',availableRoles:['harmony']});
  expect(a.curves.every(c=>c.role==='harmony')).toBe(true);
 });
});
