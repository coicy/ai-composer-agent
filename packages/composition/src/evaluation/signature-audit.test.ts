import {describe,it,expect} from 'vitest';
import {auditSignatureTechniques} from './signature-audit.js';
import type {TechniqueEvidence} from './electronic-technique-evidence.js';
const e=(id:string,state:TechniqueEvidence['state'],priority:TechniqueEvidence['priority']='signature'):TechniqueEvidence=>
 ({id:id as TechniqueEvidence['id'],state,priority,advisory:true,summary:'test'});
describe('signature evidence audit',()=>{
 it('flags absent style anchors for retrial but does not commit edits',()=>{
  expect(auditSignatureTechniques([e('offbeat_bass','not_observed')])).toMatchObject({
   status:'retry_recommended',missing:['offbeat_bass']
  });
 });
 it('does not treat unevaluable drums as an observed successful signature',()=>{
  expect(auditSignatureTechniques([e('four_floor','not_evaluable'),e('offbeat_bass','observed')])).toMatchObject({
   status:'needs_manual_review',unevaluable:['four_floor'],observed:['offbeat_bass']
  });
 });
 it('still requires listening when heuristics observe a cue',()=>{
  expect(auditSignatureTechniques([e('ostinato','observed')]).status).toBe('ready_for_listening');
 });
 it('ignores support-level failures for signature status',()=>{
  expect(auditSignatureTechniques([e('pad_chords','not_observed','supporting')]).missing).toHaveLength(0);
 });
});
