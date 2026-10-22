"""Offline evidence-boundary regression tests for MIDI reference facets."""
from hashlib import sha256
import io
import unittest
import mido
from midi_reference_facets import analyze_reference,build_coverage,_meter_metadata
from query_midi_references import select_references

def midi_fixture(percussion=False,meter=None,velocity=(70,90),key=None):
 m=mido.MidiFile(ticks_per_beat=480);t=mido.MidiTrack();m.tracks.append(t)
 if meter:
  n,d=map(int,meter.split('/'));t.append(mido.MetaMessage('time_signature',numerator=n,denominator=d,time=0))
 if key:t.append(mido.MetaMessage('key_signature',key=key,time=0))
 for i in range(12):
  pitch=38 if percussion else 60+i%5;channel=9 if percussion else 0
  t.append(mido.Message('note_on',channel=channel,note=pitch,velocity=velocity[i%len(velocity)],time=120))
  t.append(mido.Message('note_off',channel=channel,note=pitch,velocity=0,time=120))
 b=io.BytesIO();m.save(file=b);return b.getvalue()

def item(blob,kind='game_town',meta=None):
 source={'game_town':'https://opengameart.org/content/sample',
         'jazz':'https://magenta.withgoogle.com/datasets/groove',
         'baroque_counterpoint':'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=70'}[kind]
 return {'style':kind,'file':'test.mid','source_page':source,
         'sha256':sha256(blob).hexdigest(),'metadata':meta or {}}

class ReferenceFacetTests(unittest.TestCase):
 def test_drum_only_never_claims_pitch_or_mode(self):
  raw=midi_fixture(percussion=True,meter='6/8')
  f=analyze_reference(item(raw,'jazz',{'style':'jazz/swing','bpm':'105'}),raw)
  self.assertEqual(f['meter']['values'],['6/8'])
  self.assertEqual(f['pitch_language']['status'],'not_applicable_percussion_only')
  self.assertIsNone(f['pitch_language']['pitch_classes_c_to_b'])
  self.assertIsNone(f['labels']['verified_mode'])
  self.assertIsNone(f['labels']['verified_genre'])
  self.assertEqual(f['labels']['source_style_label'],'jazz/swing')
  self.assertEqual(f['tempo']['source'],'source_annotation')
  self.assertTrue(f['rhythm']['performance_source'])
 def test_key_signature_is_not_verified_mode(self):
  raw=midi_fixture(meter='7/8',key='Dm')
  f=analyze_reference(item(raw,'baroque_counterpoint'),raw)
  self.assertEqual(f['pitch_language']['pitched_notes'],12)
  self.assertEqual(f['pitch_language']['key_signature_events'],['Dm'])
  self.assertIsNone(f['pitch_language']['verified_mode'])
  self.assertEqual(sum(f['rhythm']['quarter_note_phase_16_bins']),12)
  self.assertEqual(f['meter']['values'],['7/8'])
 def test_meter_unknown_unless_cited(self):
  raw=midi_fixture()
  f=analyze_reference(item(raw),raw)
  self.assertEqual(f['meter']['values'],[])
  self.assertEqual(f['meter']['source'],'unknown')
  f=analyze_reference(item(raw,'jazz',{'time_signature':'12-8'}),raw)
  self.assertEqual(f['meter']['values'],['12/8'])
  self.assertEqual(f['meter']['source'],'source_annotation')
 def test_sha_mismatch_fails_closed(self):
  raw=midi_fixture();wrong=item(raw);wrong['sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'SHA-256 mismatch'):analyze_reference(wrong,raw)
 def test_velocity_zero_variance(self):
  raw=midi_fixture(velocity=(85,))
  f=analyze_reference(item(raw),raw)
  self.assertFalse(f['performance']['velocity_variation_observed'])
 def test_coverage_keeps_absence_explicit(self):
  drum=midi_fixture(percussion=True,meter='6/8')
  tonal=midi_fixture(meter='7/8')
  entries=[dict(item(raw,kind),facets=analyze_reference(item(raw,kind),raw))
           for raw,kind in ((drum,'jazz'),(tonal,'game_town'))]
  c=build_coverage(entries)
  self.assertEqual(c['total_midi'],2)
  self.assertEqual(c['priority_meters']['6/8'],1)
  self.assertEqual(c['priority_meters']['7/8'],1)
  self.assertEqual(c['priority_meters']['12/8'],0)
  self.assertIn('12/8',c['missing_priority_meters'])
  self.assertEqual(c['capabilities']['drum_only'],1)
  self.assertEqual(c['capabilities']['pitched_material'],1)
  self.assertEqual(c['capabilities']['expert_verified_mode'],0)
 def test_reference_queries_do_not_conflate_facets(self):
  drum=midi_fixture(percussion=True,meter='4/4')
  game=midi_fixture(meter='3/4')
  items=[dict(item(drum,'jazz',{'style':'jazz/fusion'}),
              title='A',license='CC BY 4.0',
              facets=analyze_reference(item(drum,'jazz',{'style':'jazz/fusion'}),drum)),
         dict(item(game,'game_town'),title='B',license='CC0-1.0',
              facets=analyze_reference(item(game,'game_town'),game))]
  catalog={'items':items}
  self.assertEqual(select_references(catalog,meter='4/4',pitched=False)['match_count'],1)
  self.assertEqual(select_references(catalog,usage='town',pitched=True)['match_count'],1)
  self.assertEqual(select_references(catalog,source_style='jazz/fusion')['match_count'],1)
  self.assertEqual(select_references(catalog,meter='6/8')['match_count'],0)
  self.assertIsNone(select_references(catalog,meter='4/4')['matches'][0]['verified_mode'])
  with self.assertRaises(ValueError):select_references(catalog,limit=0)
 def test_invalid_meters_not_inferred(self):
  self.assertEqual(_meter_metadata('6-8'),'6/8')
  for bad in ('C','0/4','7/3',None):
   self.assertIsNone(_meter_metadata(bad))
if __name__=='__main__':unittest.main()
