"""Synthetic vectors test plumbing only; never represent scores from real CLaMP 3."""
import json
import tempfile
import unittest
from pathlib import Path
from export_midis import export

try:
    import numpy as np
    from score_clamp3 import score, cosine
except ImportError:
    np = None

@unittest.skipUnless(np is not None, "Optional NumPy dependency is absent")
class ClampFeaturePostprocessorTests(unittest.TestCase):
    def test_known_vectors_match_expected_cosine_and_query_mapping(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            manifest=export(root)
            midi=root/"midi_features"
            text=root/"text_features"
            midi.mkdir()
            text.mkdir()
            vec=lambda a,b: np.array([[a,b]+[0.0]*766],dtype=np.float32)
            np.save(text/"ruins.npy",vec(1,0))
            np.save(text/"carnival.npy",vec(0,1))
            examples={"A_static_loop":vec(.2,.98),"B_surface_density":vec(.5,.87),
                      "C_developed":vec(.9,.1),"D_scrambled":vec(.35,.93),
                      "E_style_mismatch":vec(.9,.1)}
            for name, emb in examples.items():
                np.save(midi/(name+".npy"),emb)
            result=score(root/"manifest.json",midi,text)
            self.assertEqual(len(result["scores"]),5)
            self.assertGreater(result["comparisons"]["C_minus_A_ruins"],0)
            self.assertGreater(result["comparisons"]["C_minus_D_ruins"],0)
            self.assertGreater(result["comparisons"]["C_ruins_minus_E_carnival_same_MIDI"],0)
            self.assertFalse(result["model_verified_by_script"])
    def test_invalid_temporal_and_zero_vectors_are_rejected(self):
        with self.assertRaises(ValueError):
            cosine(np.ones((2,768)),np.ones(768))
        with self.assertRaises(ValueError):
            cosine(np.zeros(768),np.ones(768))

if __name__=="__main__":
    unittest.main()
