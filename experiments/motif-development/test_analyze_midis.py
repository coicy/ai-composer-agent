"""Real parsed-MIDI order controls, not learned-model predictions."""
from pathlib import Path
import tempfile
import unittest
from export_midis import export
from analyze_midis import analyze, sections

class IndependentMidiControls(unittest.TestCase):
    def test_order_change_preserves_bag_of_sections(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            export(root)
            report=analyze(root)
            self.assertTrue(report['C_D_bagOfSectionsEqual'])
            self.assertTrue(report['C_D_sectionOrderDifferent'])
            self.assertGreater(report['C_D_positionMismatches'],0)
            self.assertTrue(report['C_E_sameSections'])
            self.assertAlmostEqual(report['durationSeconds'],64.0,places=2)
            self.assertEqual(report['byCase']['A_static_loop']['distinctSectionPatterns'],1)
            self.assertGreater(report['byCase']['C_developed']['distinctSectionPatterns'],1)
            self.assertGreater(report['byCase']['B_surface_density']['leadNotes'],
                               report['byCase']['A_static_loop']['leadNotes'])
    def test_orphan_note_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            export(root)
            lead,duration=sections(root/'midi'/'C_developed.mid')
            self.assertEqual(len(lead),6)
            self.assertTrue(all(len(segment)>0 for segment in lead))

if __name__=="__main__":
    unittest.main()
