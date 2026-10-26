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
            order_files=sorted((root/'review').glob('rating_form_order_*.csv'))
            self.assertEqual(len(order_files),6)
            orders=[]
            for form in order_files:
                with form.open(encoding='utf-8-sig',newline='') as file:
                    orders.append([row['clip'] for row in csv.DictReader(file)])
            for position in range(6):
                self.assertEqual(len({order[position] for order in orders}),6)
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
            # One listener contributed two repeated C ratings but only one
            # statistically independent C response.
            self.assertEqual(result['groups']['C_developed/ruins']['participantCount'],1)
            self.assertEqual(result['groups']['C_developed/ruins']['clipRatingCount'],2)
            self.assertEqual(result['sameBriefRepeatedClip']['participantsWithBothRepeats'],1)
            self.assertEqual(result['sameBriefRepeatedClip']['meanAbsoluteDifferenceByDimension']['overallRating_1to5'],0)
            self.assertEqual(result['completeParticipants'],1)
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

    def test_repeated_c_trials_average_within_participant(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'audio';source.mkdir()
            for kind,_ in DESIGNS:
                (source/(kind+'.mp3')).write_bytes(('mock-'+kind).encode())
            prepare(source,root/'review',root/'private/key.json')
            mapping=json.loads((root/'private/key.json').read_text())['mapping']
            responses=root/'mock-only.csv'
            with responses.open('w',newline='',encoding='utf-8') as f:
                writer=csv.DictWriter(f,fieldnames=['participantId','clip',*METRICS])
                writer.writeheader()
                # Participant ONE rates C twice: 1 and 5. Participant TWO
                # only rates a single C: 4. Expected (3+4)/2 = 3.5, NOT
                # raw-trial mean (1+5+4)/3 = 3.3333.
                c=[row for row in mapping if row['source']=='C_developed']
                for participant,clip,val in [('ONE',c[0],1),('ONE',c[1],5),('TWO',c[0],4)]:
                    writer.writerow({'participantId':participant,'clip':clip['clip'],
                                     **{metric:val for metric in METRICS}})
            result=summarize(root/'private/key.json',[responses])
            group=result['groups']['C_developed/ruins']
            self.assertEqual(group['participantCount'],2)
            self.assertEqual(group['clipRatingCount'],3)
            self.assertEqual(group['meanByDimension']['overallRating_1to5'],3.5)
            self.assertEqual(result['sameBriefRepeatedClip']['meanAbsoluteDifferenceByDimension']['overallRating_1to5'],4)
            self.assertEqual(result['incompleteParticipants'],2)
            self.assertEqual(result['sameMusicDifferentBrief']['pairedParticipants'],0)

    def test_duplicate_participant_clip_in_two_files_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            key=root/'key.json'
            key.write_text(json.dumps({'mapping':[{'clip':'clip_01.mp3',
                'source':'C_developed','brief':'ruins'}]}))
            paths=[]
            for i in range(2):
                path=root/f'answer_{i}.csv'
                with path.open('w',newline='',encoding='utf-8') as f:
                    writer=csv.DictWriter(f,fieldnames=['participantId','clip',*METRICS])
                    writer.writeheader()
                    writer.writerow({'participantId':'SAME','clip':'clip_01.mp3',
                                     **{metric:4 for metric in METRICS}})
                paths.append(path)
            with self.assertRaisesRegex(ValueError,"Duplicate participant/clip"):
                summarize(key,paths)

if __name__=='__main__':
    unittest.main()
