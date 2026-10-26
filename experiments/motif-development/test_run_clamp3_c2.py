"""C2 preflight must fail closed; no real ML inference is run in unit tests."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from export_midis import export
from run_clamp3_c2 import inspect, execute

class ClampPreflightTests(unittest.TestCase):
    def make_fixture(self, folder: Path):
        upstream=folder/"upstream"
        code=upstream/"code"
        code.mkdir(parents=True)
        (upstream/"clamp3_embd.py").write_text("# mock-only; never executed\n")
        (code/"config.py").write_text('CLAMP3_WEIGHTS_PATH = "weights_clamp3_c2_test.pth"\n')
        checkpoint=code/"weights_clamp3_c2_test.pth"
        checkpoint.write_bytes(b"not a model; for test only")
        subprocess.run(["git","init","-q",str(upstream)],check=True)
        subprocess.run(["git","-C",str(upstream),"-c","user.name=Mock",
                        "-c","user.email=mock@example.invalid","commit","-q",
                        "--allow-empty","-m","mock"],check=True)
        generated=folder/"benchmark"
        export(generated)
        return upstream,generated,checkpoint

    def test_valid_c2_config_reports_provenance_without_inference(self):
        with tempfile.TemporaryDirectory() as temp:
            upstream,stimuli,ckpt=self.make_fixture(Path(temp))
            data=inspect(upstream,stimuli,minimum_checkpoint_bytes=1)
            self.assertFalse(data["generatedScores"])
            self.assertEqual(data["sampleCount"],5)
            self.assertEqual(data["checkpointFilename"],ckpt.name)
            self.assertEqual(len(data["checkpointSha256"]),64)
            with self.assertRaisesRegex(ValueError,"Feature output already exists"):
                output=Path(temp)/"report"
                (output/"midi_features").mkdir(parents=True)
                execute(upstream,stimuli,output,data)

    def test_rejects_wrong_variant_and_misnamed_checkpoint(self):
        with tempfile.TemporaryDirectory() as temp:
            upstream,stimuli,ckpt=self.make_fixture(Path(temp))
            config=upstream/"code"/"config.py"
            config.write_text('CLAMP3_WEIGHTS_PATH = "weights_clamp3_saas_test.pth"\n')
            with self.assertRaisesRegex(ValueError,"C2 symbolic"):
                inspect(upstream,stimuli,minimum_checkpoint_bytes=1)
            config.write_text('CLAMP3_WEIGHTS_PATH = "weights_clamp3_c2_missing.pth"\n')
            with self.assertRaisesRegex(ValueError,"differs"):
                inspect(upstream,stimuli,minimum_checkpoint_bytes=1)

    def test_rejects_sha_mismatch_and_corrupt_stimulus(self):
        with tempfile.TemporaryDirectory() as temp:
            upstream,stimuli,ckpt=self.make_fixture(Path(temp))
            with self.assertRaisesRegex(ValueError,"expected digest"):
                inspect(upstream,stimuli,minimum_checkpoint_bytes=1,
                        expected_checkpoint_sha256="0"*64)
            (stimuli/"midi"/"C_developed.mid").write_bytes(b"not the original MIDI")
            with self.assertRaisesRegex(ValueError,"SHA256 mismatch"):
                inspect(upstream,stimuli,minimum_checkpoint_bytes=1)

    def test_rejects_missing_negative_prompt(self):
        with tempfile.TemporaryDirectory() as temp:
            upstream,stimuli,ckpt=self.make_fixture(Path(temp))
            (stimuli/"text_queries"/"carnival.txt").unlink()
            with self.assertRaisesRegex(ValueError,"negative/positive"):
                inspect(upstream,stimuli,minimum_checkpoint_bytes=1)

if __name__=="__main__":
    unittest.main()
