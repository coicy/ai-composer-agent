"""Format-level and counterfactual invariants for the generated, playable MIDI pack."""
import hashlib
import json
import tempfile
import unittest
import mido
from pathlib import Path
from export_midis import export, make_case, varlen, CASES, PPQ

class MotifFixtureExportTests(unittest.TestCase):
    def test_five_files_and_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            manifest=export(root)
            self.assertEqual(len(manifest["cases"]),5)
            files=[root / c["file"] for c in manifest["cases"]]
            self.assertTrue(all(p.exists() and p.stat().st_size>70 for p in files))
            for path, case in zip(files,manifest["cases"]):
                data=path.read_bytes()
                self.assertEqual(data[:4],b"MThd")
                self.assertEqual(int.from_bytes(data[8:10],"big"),1)
                self.assertEqual(int.from_bytes(data[10:12],"big"),3)
                self.assertEqual(int.from_bytes(data[12:14],"big"),PPQ)
                self.assertEqual(data.count(b"MTrk"),3)
                parsed=mido.MidiFile(str(path))
                self.assertEqual(parsed.ticks_per_beat,PPQ)
                self.assertAlmostEqual(parsed.length,64,places=2)
                self.assertEqual(hashlib.sha256(data).hexdigest(),case["sha256"])
            self.assertEqual(files[2].read_bytes(),files[4].read_bytes(),
                             "C and E must be exactly identical music")
            self.assertNotEqual(files[2].read_bytes(),files[3].read_bytes(),
                                "D should reorder the same underlying material")
            self.assertEqual(manifest["cases"][0]["notes"],18)
            self.assertGreater(manifest["cases"][1]["notes"],18)
            self.assertTrue((root/"text_queries"/"ruins.txt").exists())
            self.assertEqual(len(json.loads((root/"manifest.json").read_text())["cases"]),5)
    def test_encoding_and_rejecting_overflow(self):
        self.assertEqual(varlen(0),b"\x00")
        self.assertEqual(varlen(128),b"\x81\x00")
        with self.assertRaises(ValueError): varlen(-1)
        with self.assertRaises(ValueError): varlen(2**28)
    def test_all_cases_deterministic(self):
        for kind,order in CASES.values():
            a,count=make_case(kind,order)
            b,count_again=make_case(kind,order)
            self.assertEqual(a,b)
            self.assertEqual(count,count_again)

if __name__=="__main__":
    unittest.main()
