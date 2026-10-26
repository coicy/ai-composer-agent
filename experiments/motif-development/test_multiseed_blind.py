"""Human study pack and arithmetic are only tested with MOCK listeners."""
from pathlib import Path
import tempfile
import csv
import unittest

from multiseed_blind import BLOCK_SEEDS,GENRE_BRIEFS,METRICS,prepare,summarize

class BlindMultiseedTests(unittest.TestCase):
 def test_six_balanced_four_clip_blocks_no_answer_key_leak(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   audio=root/'audio';audio.mkdir()
   for seed in range(12):
    for c in ("ordered",("swap","reverse","rotate")[seed%3]):
     (audio/f"motif_{seed:02d}_{c}.mp3").write_bytes(f"MOCK-MP3:{seed}:{c}".encode())
   review=root/'review';key=root/'private/key.json'
   report=prepare(audio,review,key)
   self.assertEqual(report["clips"],24)
   self.assertFalse(report["humanRatingsCollected"])
   self.assertEqual(len(list(review.glob("clip_*.mp3"))),24)
   self.assertEqual(len(list(review.glob("rating_block*.csv"))),12)
   self.assertFalse((review/'answer_key.json').exists())
   self.assertTrue(key.exists())
   import json
   data=json.loads(key.read_text())
   self.assertEqual(len({e['seed'] for e in data['entries']}),12)
   for i in range(1,7):
    with (review/f"rating_block_{i:02d}_order_01.csv").open(encoding="utf-8-sig") as src:
     first=list(csv.DictReader(src))
    with (review/f"rating_block_{i:02d}_order_02.csv").open(encoding="utf-8-sig") as src:
     second=list(csv.DictReader(src))
    self.assertEqual(len(first),4)
    self.assertEqual([r["clip"] for r in first],list(reversed([r["clip"] for r in second])))
    self.assertTrue(all(r['task_brief'] in GENRE_BRIEFS.values() for r in first))

 def test_mock_participant_differences_and_reject_no_responses(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   audio=root/'audio';audio.mkdir()
   for seed in range(12):
    for c in ("ordered",("swap","reverse","rotate")[seed%3]):
     (audio/f"motif_{seed:02d}_{c}.mp3").write_bytes(b'MOCK')
   review=root/'review';key=root/'private/key.json'
   prepare(audio,review,key)
   with self.assertRaisesRegex(ValueError,"No human"):
    summarize(key,[])
   import json
   data=json.loads(key.read_text())
   path=root/'mock_ratings.csv'
   with path.open("w",newline="") as file:
    writer=csv.DictWriter(file,fieldnames=["participant_id","clip",*METRICS])
    writer.writeheader()
    for e in data["entries"]:
     writer.writerow({"participant_id":f"MOCK_{e['block']:02d}","clip":e["clip"],
       **{m:(5 if e["condition"]=="ordered" else 2) for m in METRICS}})
   result=summarize(key,[path])
   self.assertEqual(result["participants"],6)
   self.assertEqual(result["pairedComparisons"],12)
   self.assertEqual(result["incompletePairs"],0)
   self.assertEqual(result["groupMeans"]["ruins"]["development_1to5"],3)
   self.assertEqual(result["groupMeans"]["carnival"]["overall_1to5"],3)

if __name__=="__main__":unittest.main()
