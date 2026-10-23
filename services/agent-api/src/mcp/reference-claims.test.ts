import {describe,expect,it} from 'vitest';
import {getSourceGrooveClaim} from './reference-claims.js';
const groove='https://magenta.withgoogle.com/datasets/groove';
describe('source metadata provenance is NOT an expert music review',()=>{
 it('preserves only exact Groove MIDI shuffle source label',()=>{
  expect(getSourceGrooveClaim('blues/shuffle',groove)).toEqual({
   value:'shuffle',status:'source_declared',sourceField:'style',
   originalLabel:'blues/shuffle',sourceEvidenceUrl:groove,independentlyReviewed:false
  });
 });
 it('does not infer Swing from Jazz or Shuffle from an unrelated URL',()=>{
  expect(getSourceGrooveClaim('jazz',groove)).toBeNull();
  expect(getSourceGrooveClaim('jazz/fusion',groove)).toBeNull();
  expect(getSourceGrooveClaim('blues/shuffle','https://example.com/song')).toBeNull();
  expect(getSourceGrooveClaim('blues/shuffle_other',groove)).toBeNull();
  expect(getSourceGrooveClaim(null,groove)).toBeNull();
 });
});
