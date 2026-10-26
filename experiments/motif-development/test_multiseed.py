"""Integrity controls for multiseed experiment; vectors here are explicitly MOCK."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from collections import Counter
from io import BytesIO
import mido

from multiseed_export import SAMPLES,KINDS,SECTION,ORDERS,generate,note_inventory
from multiseed_score import validate_stimuli,evaluate,ci95_by_seed

class MultiseedExperimentTests(unittest.TestCase):
 def test_distinct_motifs_and_exact_section_permutations(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp)
   meta=generate(root)
   self.assertEqual(len(meta['cases']),72)
   self.assertEqual(len({tuple(c['pitches']) for c in meta['cases']}),12)
   self.assertEqual(len({tuple(c['offsets']) for c in meta['cases']}),4)
   self.assertEqual(len({c['genre'] for c in meta['cases']}),2)
   validated=validate_stimuli(root)
   self.assertEqual(validated['seeds'],12)
   for seed in range(SAMPLES):
    rows={c['condition']:c for c in meta['cases'] if c['seed']==seed}
    base=(root/rows['ordered']['file']).read_bytes()
    inventory=note_inventory(base)
    for kind in ('swap','reverse','rotate'):
     variant=(root/rows[kind]['file']).read_bytes()
     self.assertEqual(note_inventory(variant),inventory)
     self.assertNotEqual(base,variant)
    ordered=mido.MidiFile(file=BytesIO(base))
    self.assertAlmostEqual(ordered.length,64 if seed<6 else 48,places=2)
    self.assertEqual(len(ordered.tracks),4)
    self.assertEqual(rows['static']['order'],[0,0,0,0,0,0])
    self.assertEqual(rows['ordered']['order'],[0,1,2,3,4,5])

 def test_checksum_rejects_modified_file(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp)
   generate(root)
   (root/'midi/motif_00_ordered.mid').write_bytes(b'bad')
   with self.assertRaisesRegex(ValueError,'checksum'):
    validate_stimuli(root)

 def test_identical_music_style_matched_by_seed_with_mock_vectors(self):
  try:import numpy as np
  except ImportError:self.skipTest('NumPy optional')
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp)
   generate(root)
   midi=root/'features';midi.mkdir()
   text=root/'texts';text.mkdir()
   a=np.zeros((768,),dtype=np.float32);a[0]=1
   b=np.zeros((768,),dtype=np.float32);b[1]=1
   np.save(text/'ruins.npy',a);np.save(text/'carnival.npy',b)
   for seed in range(SAMPLES):
    base=a if seed<6 else b
    for kind in KINDS:
     vec=base.copy()
     # Explicit deterministic pseudo similarity; no real checkpoint loaded.
     if kind in ('swap','reverse','rotate'):
      vec=vec + .4*(b if seed<6 else a)
     np.save(midi/(f'motif_{seed:02d}_{kind}.npy'),vec)
   result=evaluate(root,midi,text)
   self.assertEqual(result['midiCandidates'],72)
   self.assertEqual(result['seeds'],12)
   self.assertEqual(result['orderedVsScrambled']['pairedMIDIComparisons'],36)
   self.assertEqual(result['orderedVsScrambled']['seedLevelMeanOfThreePermutations']['positive'],12)
   self.assertEqual(result['matchedPromptControl']['orderedOnly']['positive'],12)
   self.assertEqual(result['orderedVsScrambled']['orderedFirstAmongFour'],12)
   self.assertIn('NO humans',result['claimScope'])

 def test_seed_bootstrap_is_repeatable_and_respects_sample_unit(self):
  data=[.1,.2,-.3,.4]
  self.assertEqual(ci95_by_seed(data,repetitions=200),ci95_by_seed(data,repetitions=200))
  self.assertEqual(len(ci95_by_seed(data)),2)

if __name__=='__main__':
 unittest.main()
