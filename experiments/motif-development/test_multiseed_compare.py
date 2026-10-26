"""Comparison arithmetic uses MOCK scores ONLY; CI has no human participants."""
import unittest
from multiseed_compare import compare,pearson,ranks

class ReviewJoinTests(unittest.TestCase):
 def setUp(self):
  self.model={'status':'real-embedding-analysis, source provenance must be separately verified',
              'midiCandidates':72,
              'orderedVsScrambled':{'comparisons':[
                {'seed':i,'variant':'swap','orderedMinusScrambled':float(i-3)/100}
                for i in range(8)]}}
 def test_no_actual_listeners_cannot_be_called_correlation(self):
  out=compare(self.model,{'status':'aggregated submitted human responses',
                          'pairedObservations':[]})
  self.assertEqual(out['status'],'awaiting_human_submissions')
  self.assertIsNone(out['rankCorrelation'])
  self.assertEqual(out['pairedHumanRatings'],0)
 def test_mock_pairs_join_by_seed_and_derive_rank_correlation(self):
  records=[{'participant_id':'MOCK_PERSON','seed':i,'scramble':'swap',
            'development_1to5':float(i-3)/2} for i in range(8)]
  out=compare(self.model,{'status':'aggregated submitted human responses',
                          'pairedObservations':records})
  self.assertEqual(out['uniqueParticipants'],1)
  self.assertEqual(out['seedCount'],8)
  self.assertEqual(out['spearmanSeedLevel'],1)
  self.assertEqual(out['matchedSeedVariantPairs'],8)
 def test_sparse_or_mismatched_data_reports_limits(self):
  records=[{'participant_id':'MOCK','seed':0,'scramble':'swap',
            'development_1to5':2.0}]
  result=compare(self.model,{'status':'aggregated submitted human responses',
                             'pairedObservations':records})
  self.assertEqual(result['status'],'insufficient_independent_seeds')
  self.assertIsNone(result['spearmanSeedLevel'])
  records[0]['scramble']='missing'
  with self.assertRaisesRegex(ValueError,'mismatch'):
   compare(self.model,{'status':'aggregated submitted human responses',
                       'pairedObservations':records})
 def test_tied_ranks_no_false_correlation(self):
  self.assertEqual(ranks([2,1,1]),[3,1.5,1.5])
  self.assertIsNone(pearson([0,0,0,0],[1,2,3,4]))
if __name__=='__main__':unittest.main()
