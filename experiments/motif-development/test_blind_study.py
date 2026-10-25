"""No manufactured listening result: tests use unmistakably mock participants."""
import csv
import json
import tempfile
import unittest
from pathlib import Path
from blind_study import DESIGNS,METRICS,prepare,summarize

class BlindStudyTests(unittest.TestCase):
    def test_pack_randomized_and_key_separated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'audio';source.mkdir()
            for kind,_ in DESIGNS:
                (source/(kind+'.mp3')).write_bytes(('mock-'+kind).encode())
            report=prepare(source,root/'review',root/'private/key.json')
            self.assertEqual(report['clips'],6)
            self.assertTrue((root/'review/rating_form.csv').exists())
            self.assertFalse((root/'review/key.json').exists())
            self.assertEqual(len(list((root/'review').glob('clip_*.mp3'))),6)
            key=json.loads((root/'private/key.json').read_text())
            self.assertEqual(len(key['mapping']),6)
            files=key['mapping']
            self.assertEqual(sum(x['source']=='C_developed' for x in files),2)
            self.assertEqual(sum(x['source']=='E_style_mismatch' for x in files),1)
            self.assertEqual(sum(x['source']=='A_static_loop' for x in files),1)
    def test_real_responses_aggregator_with_mock_scores(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'audio';source.mkdir()
            for kind,_ in DESIGNS:
                (source/(kind+'.mp3')).write_bytes(('mock-'+kind).encode())
            prepare(source,root/'review',root/'private/key.json')
            key=json.loads((root/'private/key.json').read_text())
            responses=root/'mock-only.csv'
            with responses.open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=['participantId','clip',*METRICS])
                w.writeheader()
                for clip in key['mapping']:
                    v=1 if clip['brief']=='carnival' else 4
                    w.writerow({'participantId':'MOCK_PERSON',
                        'clip':clip['clip'],**{metric:v for metric in METRICS}})
            result=summarize(root/'private/key.json',[responses])
            self.assertEqual(result['participants'],1)
            self.assertEqual(result['sameMusicDifferentBrief']['pairedParticipants'],1)
            self.assertEqual(result['sameMusicDifferentBrief']['meanDifference'],3.0)
            self.assertIn('C_developed/ruins',result['groups'])
    def test_missing_response_rejected_without_fabricating_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                summarize(Path(tmp)/'missing.json',[])
    def test_incomplete_or_invalid_ratings_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'key.json').write_text(json.dumps({'mapping':[{'clip':'clip_01.mp3','source':'C_developed','brief':'ruins'}]}))
            row={'participantId':'TEST','clip':'clip_01.mp3',**{m:'5' for m in METRICS}}
            row[METRICS[0]]='6'
            with (root/'values.csv').open('w',newline='') as f:
                w=csv.DictWriter(f,fieldnames=row.keys());w.writeheader();w.writerow(row)
            with self.assertRaises(ValueError):
                summarize(root/'key.json',[root/'values.csv'])

if __name__=='__main__':
    unittest.main()
