#!/usr/bin/env python3
"""Read finished MP3/SMF files independently of the composition builder."""
import hashlib,json,subprocess,sys,zipfile
from pathlib import Path
import mido,numpy as np
BASE=Path(__file__).resolve().parent
results=json.loads((BASE/'experiment_results.json').read_text())
fixed=results['metadata']['fixed']
assert fixed['bars']==16 and fixed['ppq']==480 and fixed['tempo_bpm']==112
lead_sequences=[];variants={}
for key in 'ABC':
 f=BASE/f'variant_{key}.mid';p=BASE/f'variant_{key}.mp3'
 assert f.exists() and p.exists()
 assert hashlib.sha256(f.read_bytes()).hexdigest()==results['variants'][key]['midi_sha256']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==results['variants'][key]['mp3_sha256']
 smf=mido.MidiFile(f)
 assert len(smf.tracks)==5 and smf.type==1 and smf.ticks_per_beat==480
 assert any(msg.type=='set_tempo' and abs(mido.tempo2bpm(msg.tempo)-112)<.001 for msg in smf.tracks[0])
 assert any(msg.type=='key_signature' and msg.key=='C' for msg in smf.tracks[0]),'D Dorian uses no flats/sharps as a pitch collection'
 assert any(msg.type=='text' and 'D Dorian' in msg.text for msg in smf.tracks[0])
 assert any(msg.type=='time_signature' and (msg.numerator,msg.denominator)==(4,4) for msg in smf.tracks[0])
 all_pitch=set();lead=[];total=0;tracks=[];max_tick=0
 for tr in smf.tracks[1:]:
  cumulative=0;tracknotes=[];notes_active={};last_tick=0
  for msg in tr:
   cumulative+=msg.time;last_tick=cumulative
   if msg.type=='note_on' and msg.velocity>0:
    total+=1;tracknotes.append((cumulative,msg.note,msg.velocity))
    if msg.channel!=9:
     all_pitch.add(msg.note%12)
    assert 1<=msg.velocity<=127
   if msg.type=='end_of_track':assert cumulative==16*4*480
  max_tick=max(max_tick,last_tick);tracks.append(len(tracknotes))
  if len(tracks)==1:lead=[n for _,n,_ in tracknotes]
 assert all_pitch.issubset({0,2,4,5,7,9,11}), (key,all_pitch)
 assert 11 in all_pitch,'Dorian characteristic natural sixth B missing'
 assert lead and tracks==[results['variants'][key]['count_by_track'][t] for t in ('lead','keys','bass','drums')]
 assert total==results['variants'][key]['total_notes']
 lead_sequences.append(lead)
 probing=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,channels','-of','json',str(p)]))
 dur=float(probing['format']['duration']);assert 36<dur<37,(key,dur)
 assert probing['streams'][0]['channels']==2 and probing['streams'][0]['codec_name']=='mp3'
 z=subprocess.run(['ffmpeg','-nostats','-hide_banner','-i',str(p),'-af','loudnorm=I=-18:TP=-2:LRA=11:print_format=summary','-f','null','-'],capture_output=True,text=True,check=True).stderr
 import re
 m=re.search(r'Input Integrated:\s*([\-0-9.]+) LUFS',z);assert m,key
 lufs=float(m.group(1));assert -18.5<=lufs<=-17.5,(key,lufs)
 variants[key]={'lead_notes':len(lead),'track_note_count':tracks,'mode_pitch_classes':sorted(all_pitch),'mp3_seconds':round(dur,2),'integrated_lufs':lufs}
assert lead_sequences[0]==lead_sequences[1]==lead_sequences[2], 'All three cases must have identical lead pitch sequence'
assert len(lead_sequences[0])==77
assert results['variants']['A']['drum_midbeat_phase_median']<results['variants']['C']['drum_midbeat_phase_median']<results['variants']['B']['drum_midbeat_phase_median']
refs=results['metadata']['source_evidence']
assert len(refs)==2 and all(r['license']=='CC BY 4.0' and r['source_style']=='blues/shuffle' for r in refs)
assert len({r['drummer'] for r in refs})==1
print('INDEPENDENT_EXPERIMENT_VERIFICATION_PASSED',json.dumps(variants,ensure_ascii=False))