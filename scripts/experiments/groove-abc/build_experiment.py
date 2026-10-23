#!/usr/bin/env python3
"""Three LLM-authored arrangement treatments of one fixed pitch/chord composition.

The code performs SMF serialization, a small amount of explicitly scored musical
performance interpretation, playback rendering, and mechanical validation.
It does NOT call an LLM, learn a model, or claim an independent blinded evaluation.
"""
from __future__ import annotations
import ctypes as ct
import ctypes.util
import hashlib
import io
import json
import os
from collections import defaultdict
from pathlib import Path
import subprocess
import wave
import zipfile
from typing import NamedTuple

import mido
import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE_ARCHIVE = Path(os.environ.get('AI_COMPOSER_REFERENCE_SOURCE',
                          str(HERE.parent/'ai_composer_reference_pack_v2_44_midis.zip')))
if not SOURCE_ARCHIVE.exists() and Path('/mnt/data/ai_composer_reference_pack_v2_44_midis.zip').exists():
 SOURCE_ARCHIVE=Path('/mnt/data/ai_composer_reference_pack_v2_44_midis.zip')
SAMPLE_RATE=44100
TEMPO=112
PPQ=480
BARS=16
BAR=PPQ*4
SONG_TICKS=BARS*BAR
MODE_PCS={0,2,4,5,7,9,11} # D Dorian (pitch classes)
TONE={'bass':33,'keys':4,'lead':26}
CHORDS=['Dm9','G13','Dm9','G13','Dm9','Cmaj9','G13','Dm9',
        'G13','Dm9','Cmaj9','G13','Dm9','Em7','G13','Dm9']
VOICINGS={
 'Dm9':[53,60,64,69], # F C E A
 'G13':[53,59,64,69], # F B E A
 'Cmaj9':[52,59,62,67], # E B D G
 'Em7':[52,55,59,62]
}
BASS={
 'Dm9':(38,45,48,50,41),
 'G13':(43,50,53,55,47),
 'Cmaj9':(36,43,47,48,40),
 'Em7':(40,47,43,52,50)
}
# Manually composed, invariant MIDI-pitch melody; each note has nominal beat & duration.
# Creative treatment variants change articulation, timing, dynamics and accompaniment,
# NOT this motif's pitches, chord order, or number of bars.
MELODY=[
 [(62,0,0.82),(65,.6667,.31),(69,1,.84),(71,2.6667,.32),(69,3,.74)],
 [(67,0,.75),(69,.6667,.3),(71,1,.76),(74,2,.92),(71,3.6667,.27)],
 [(72,0,.74),(71,.6667,.27),(69,1,.79),(65,2,.72),(62,3,.93)],
 [(71,0,.69),(69,.6667,.3),(67,1,.72),(64,2.6667,.28),(62,3,.84)],
 [(62,0,.8),(65,.6667,.28),(69,1,.85),(71,2.6667,.30),(74,3,.8)],
 [(76,0,.84),(74,1,.65),(71,1.6667,.31),(69,2,.8),(67,3,.81)],
 [(71,0,.85),(74,.6667,.30),(76,1,.91),(74,2,.78),(71,3.6667,.3)],
 [(69,0,.7),(65,.6667,.32),(62,1,1.4),(64,3,.66)],
 [(67,0,.76),(71,.6667,.31),(74,1,.75),(76,2,.72),(79,3,.67)],
 [(77,0,.74),(76,.6667,.29),(74,1,.8),(71,2.6667,.29),(69,3,.9)],
 [(72,0,.85),(76,1,.75),(79,1.6667,.32),(76,2,.75),(74,3,.82)],
 [(71,0,.75),(69,.6667,.29),(67,1,.81),(69,2,.76),(71,3.6667,.29)],
 [(74,0,.73),(71,.6667,.30),(69,1,.83),(65,2,.73),(62,3,.77)],
 [(64,0,.87),(67,.6667,.29),(71,1,.8),(74,2,.82),(76,3,.7)],
 [(74,0,.82),(71,.6667,.30),(69,1,.83),(67,2,.7),(64,3,.76)],
 [(65,0,.7),(64,.6667,.30),(62,1,2.62)]
]

class N(NamedTuple):
 tick:int;duration:int;pitch:int;velocity:int;channel:int;track:str

VARIANTS={
 'A':{
   'description':'No external MIDI reference; common prompt and instrument constraints only',
   'context':'same explicit task, no examples or style labels',
   'offbeat':[.620], 'microticks':[0], 'humanize':0,
   'chord_offsets':[0,2.0], 'ride':[75,72,72,72],
   'kick':[93,87], 'snare':[96,99], 'bass_kind':'foundation',
   'melody_v':92, 'lead_staccato':0.90,
 },
 'B':{
   'description':'Same task + original source style label blues/shuffle, no event statistics',
   'context':'source label blues/shuffle (NOT an independently validated style label)',
   'offbeat':[.6666667], 'microticks':[0], 'humanize':1,
   'chord_offsets':[0,.6667,2.6667], 'ride':[87,63,83,68],
   'kick':[94,87], 'snare':[98,101], 'bass_kind':'shuffle',
   'melody_v':94, 'lead_staccato':0.91,
 },
 'C':{
   'description':'Same task + grounded source style and timing/dynamics features from 2 licensed Groove MIDI files',
   'context':'blues/shuffle; median mid-beat onset phases 0.608/0.647; reference intensity and variability; both clips from drummer4',
   'offbeat':[.608333,.646875], 'microticks':[-5,2,5,-3,1,7,-2,4], 'humanize':2,
   'chord_offsets':[0,.6667,2.6667], 'ride':[90,52,76,65],
   'kick':[90,82], 'snare':[94,103], 'bass_kind':'shuffle',
   'melody_v':93, 'lead_staccato':0.91,
 }
}

def real_references():
 if not SOURCE_ARCHIVE.exists():raise FileNotFoundError(SOURCE_ARCHIVE)
 if SOURCE_ARCHIVE.is_dir():
  manifest=json.loads((SOURCE_ARCHIVE/'catalog'/'manifest.json').read_text())
  get_bytes=lambda path:(SOURCE_ARCHIVE/path).read_bytes()
  close=lambda:None
 else:
  archive=zipfile.ZipFile(SOURCE_ARCHIVE)
  manifest=json.loads(archive.read('manifest.json'))
  get_bytes=lambda path:archive.read(path)
  close=archive.close
 try:
  rows=[]
  for entry in manifest['items']:
   if entry['file'] not in ('midi/blues/blues_01.mid','midi/blues/blues_02.mid'):continue
   blob=get_bytes(entry['file'])
   digest=hashlib.sha256(blob).hexdigest()
   if digest!=entry['sha256']:raise AssertionError('SHA mismatch')
   md=mido.MidiFile(file=io.BytesIO(blob))
   times=[];velocities=[];target=[]
   for track in md.tracks:
    tick=0
    for msg in track:
     tick+=msg.time
     if msg.type=='note_on' and msg.velocity>0:
      frac=(tick%md.ticks_per_beat)/md.ticks_per_beat
      if .52<=frac<=.79:times.append(frac)
      velocities.append(msg.velocity)
      if msg.note in (51,53):target.append(msg.velocity)
   rows.append({
    'file':entry['file'],'sha256':digest,'source_member':entry['source_member'],
    'source_page':entry['source_page'],'license':entry['license'],
    'source_style':entry['metadata']['style'],
    'drummer':entry['metadata']['drummer'],
    'tempo_bpm':float(entry['metadata']['bpm']),
    'midbeat_phase_samples':len(times),'median_midbeat_phase':round(float(np.median(times)),6),
    'midbeat_phase_q25_q75':[round(float(x),6) for x in np.quantile(times,[.25,.75])],
    'velocity_std':round(float(np.std(velocities)),2),
    'velocity_mean':round(float(np.mean(velocities)),2),
    'ride_velocity_mean':round(float(np.mean(target)),2) if target else None
   })
  assert len(rows)==2
  return rows
 finally:close()

def swingbeat(num, bar, offbeat):
 # .6667 in the canonical note spelling is the generic offbeat within beat.
 frac=round(num%1,4)
 if abs(frac-.6667)<.007:
  return int(round((int(num)+offbeat)*PPQ))
 return int(round(num*PPQ))

def pos(variant,bar,beat,layer='',index=0):
 cfg=VARIANTS[variant]
 phase=cfg['offbeat'][(bar+(1 if layer=='lead' else 0))%len(cfg['offbeat'])]
 tick=bar*BAR+swingbeat(beat,bar,phase)
 if cfg['humanize']==2 and layer in ('drums','keys','bass'):
  tick+=cfg['microticks'][(bar*5+index*3+len(layer))%len(cfg['microticks'])]
 if cfg['humanize']==1 and layer=='drums' and index%3==0:tick+=2
 return max(0,tick)

def dur(beats,scale=1.0):return max(55,round(PPQ*beats*scale))

def emit(notes,variant,bar,beat,pitch,beats,velocity,channel,track,index=0,articulation=1.0):
 t=pos(variant,bar,beat,track,index)
 length=dur(beats,articulation)
 if t+length>SONG_TICKS:length=SONG_TICKS-t-5
 if length<=0:return
 assert pitch%12 in MODE_PCS or track=='drums',('out-of-scale',pitch,track)
 assert 0<=pitch<=127 and 1<=velocity<=127
 notes.append(N(t,length,pitch,velocity,channel,track))

def compose(variant):
 notes=[];cfg=VARIANTS[variant]
 for bar in range(BARS):
  chord=CHORDS[bar]
  # lead guitar note intervals: identical pitches and nominal onset identity for all arms
  for i,(pitch,beat,length) in enumerate(MELODY[bar]):
   phrase=8 if bar%4==0 and i==0 else -5 if i==len(MELODY[bar])-1 else 0
   dyn=cfg['melody_v']+phrase+(i*5%13-6)+(bar%4-1)*2
   emit(notes,variant,bar,beat,pitch,length,max(60,min(116,dyn)),0,'lead',i,cfg['lead_staccato'])
  # fixed functional chord identity and inversion pool, differing voicing rhythm/dynamics
  stab_positions=cfg['chord_offsets']
  for stab,beat in enumerate(stab_positions):
   tones=VOICINGS[chord]
   if variant=='A':
    velocities=[58,54] ;length=[1.6,1.35][stab]
   elif variant=='B':
    velocities=[67,57,60]; length=[.52,.34,.55][stab]
   else:
    velocities=[63+(bar%4)*2,49+(stab%2)*4,66-(bar%3)*3];length=[.56,.29,.45][stab]
   for k,pitch in enumerate(tones):
    v=velocities[stab]+(2 if k==2 else 0)-(2 if k==3 else 0)
    emit(notes,variant,bar,beat,pitch,length,max(35,min(112,v)),1,'keys',stab*4+k,1.0)
  root,fifth,minor_seventh,octave,passing=BASS[chord]
  # direct written bass rhythms with controlled sources of stylistic variation
  if variant=='A':
   pattern=[(0,root,.84,90),(1,fifth,.75,79),(2,root,.82,85),(3,minor_seventh,.79,77)]
  elif variant=='B':
   pattern=[(0,root,.75,88),(.6667,fifth,.26,72),(1,root,.90,84),
            (2,minor_seventh,.73,81),(2.6667,fifth,.28,73),(3,octave,.73,81)]
  else:
   pattern=[(0,root,.80,91),(.6667,fifth,.22,62),(1,root,.84,84),
            (1.6667,minor_seventh,.23,69),(2,root,.66,82),(2.6667,fifth,.23,65),
            (3,octave,.58,87),(3.6667,minor_seventh,.24,67)]
   if bar in (3,7,11,15):pattern=pattern[:-2]+[(3,octave,.55,88)]
  for i,(beat,pitch,length,velocity) in enumerate(pattern):
   emit(notes,variant,bar,beat,pitch,length,velocity,2,'bass',i,.91)
  # GM percussion channel 10 => 9
  if variant=='A':
   drumhits=[(0,36,93),(2,36,87),(1,38,96),(3,38,99)]
   for step in range(8):
    beat=(step//2)+(.6667 if step%2 else 0)
    drumhits.append((beat,42,72 if step%2 else 80))
  elif variant=='B':
   drumhits=[(0,36,94),(2,36,87),(1,38,98),(3,38,101),
             (1.6667,38,35),(3.6667,36,70)]
   for step in range(8):
    beat=(step//2)+(.6667 if step%2 else 0)
    drumhits.append((beat,51,63 if step%2 else 86))
   if bar%4==3:drumhits += [(3.6667,43,77)]
  else:
   drumhits=[(0,36,91),(1,38,97),(2,36,84),(3,38,101)]
   if bar%2==0:drumhits.append((3.6667,36,66))
   if bar%2==1:drumhits.append((.6667,36,59))
   drumhits += [(1.6667,38,32),(2.6667,38,37)]
   for step in range(8):
    beat=(step//2)+(.6667 if step%2 else 0)
    v=cfg['ride'][step%4]+((bar*7+step*3)%11-6)
    drumhits.append((beat,51,max(33,min(112,v))))
   # Low tom gesture only at the ends of 4-bar sections. Different from reference onsets.
   if bar in (3,7,11,15):
    drumhits += [(3,43,66),(3.6667,43,79)]
  for i,(beat,pitch,velocity) in enumerate(drumhits):
   emit(notes,variant,bar,beat,pitch,.12,velocity,9,'drums',i,1)
 return sorted(notes,key=lambda n:(n.tick,n.channel,n.pitch))

def write_midi(notes,variant):
 midi=mido.MidiFile(type=1,ticks_per_beat=PPQ)
 meta=mido.MidiTrack();midi.tracks.append(meta)
 meta.append(mido.MetaMessage('track_name',name='A/B/C controlled 16-bar D Dorian arrangement',time=0))
 meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(TEMPO),time=0))
 meta.append(mido.MetaMessage('time_signature',numerator=4,denominator=4,time=0))
 meta.append(mido.MetaMessage('key_signature',key='C',time=0))
 meta.append(mido.MetaMessage('text',text='D Dorian target: shares C major pitch collection; tonal center D in notes and experiment metadata.',time=0))
 channel_by_track={'lead':0,'keys':1,'bass':2,'drums':9}
 names={'lead':'01 Jazz Guitar - constant motif','keys':'02 Rhodes - Dorian chords','bass':'03 Finger Bass','drums':'04 Kit - Shuffle reference experiment'}
 for track,channel in channel_by_track.items():
  channelnotes=[n for n in notes if n.track==track]
  t=mido.MidiTrack();midi.tracks.append(t)
  t.append(mido.MetaMessage('track_name',name=names[track],time=0))
  if channel!=9:t.append(mido.Message('program_change',channel=channel,program=TONE[track],time=0))
  events=[]
  for n in channelnotes:
   events.extend([(n.tick,1,mido.Message('note_on',channel=channel,note=n.pitch,velocity=n.velocity,time=0)),
                  (n.tick+n.duration,0,mido.Message('note_off',channel=channel,note=n.pitch,velocity=0,time=0))])
  # End before note-on when same onset; events retain absolute time.
  events.sort(key=lambda e:(e[0],e[1],e[2].note))
  last=0
  for tick,_,msg in events:
   assert tick>=last
   msg.time=tick-last;t.append(msg);last=tick
  t.append(mido.MetaMessage('end_of_track',time=max(0,SONG_TICKS-last)))
 out=HERE/f'variant_{variant}.mid';midi.save(out);return out

class Synth:
 def __init__(self):
  lib=ct.CDLL(ctypes.util.find_library('fluidsynth'))
  self.lib=lib
  def bind(name,ret,args):
   f=getattr(lib,name);f.restype=ret;f.argtypes=args;return f
  V=ct.c_void_p;I=ct.c_int;P=ct.c_char_p
  self.new_settings=bind('new_fluid_settings',V,[])
  self.set_num=bind('fluid_settings_setnum',I,[V,P,ct.c_double])
  self.set_int=bind('fluid_settings_setint',I,[V,P,I])
  self.new_synth=bind('new_fluid_synth',V,[V]);self.sfload=bind('fluid_synth_sfload',I,[V,P,I])
  self.program=bind('fluid_synth_program_change',I,[V,I,I])
  self.noteon=bind('fluid_synth_noteon',I,[V,I,I,I]);self.noteoff=bind('fluid_synth_noteoff',I,[V,I,I])
  self.write=bind('fluid_synth_write_float',I,[V,I,V,I,I,V,I,I])
  self.alloff=bind('fluid_synth_all_sounds_off',I,[V,I])
  self.delete_synth=bind('delete_fluid_synth',None,[V]);self.delete_settings=bind('delete_fluid_settings',None,[V])
  self.settings=self.new_settings()
  self.set_num(self.settings,b'synth.sample-rate',SAMPLE_RATE)
  self.set_num(self.settings,b'synth.gain',.5)
  self.set_num(self.settings,b'synth.reverb.room-size',.32)
  self.set_num(self.settings,b'synth.reverb.level',.22)
  self.set_int(self.settings,b'synth.reverb.active',1)
  self.set_int(self.settings,b'synth.chorus.active',1)
  self.synth=self.new_synth(self.settings)
  sid=self.sfload(self.synth,b'/usr/share/sounds/sf2/TimGM6mb.sf2',1)
  if sid<0:raise RuntimeError('soundfont unavailable')
  for ch,prg in ((0,26),(1,4),(2,33)):
   assert self.program(self.synth,ch,prg)==0
 def render(self,notes,path):
  events=[]
  for n in notes:
   on=int(round(n.tick/PPQ*60/TEMPO*SAMPLE_RATE))
   off=int(round((n.tick+n.duration)/PPQ*60/TEMPO*SAMPLE_RATE))
   events.extend([(on,1,n),(off,0,n)])
  events.sort(key=lambda e:(e[0],e[1],e[2].channel))
  stop=int(round((SONG_TICKS/PPQ*60/TEMPO+2)*SAMPLE_RATE))
  array=np.empty((stop,2),dtype=np.float32)
  here=0
  def produce(size):
   nonlocal here
   while size>0:
    k=min(size,8192)
    left=np.zeros(k,dtype=np.float32);right=np.zeros(k,dtype=np.float32)
    self.write(self.synth,k,left.ctypes.data,0,1,right.ctypes.data,0,1)
    array[here:here+k,0]=left
    array[here:here+k,1]=right
    here+=k;size-=k
  for frame,kind,n in events:
   if frame>here:produce(frame-here)
   if kind==1:self.noteon(self.synth,n.channel,n.pitch,n.velocity)
   else:self.noteoff(self.synth,n.channel,n.pitch)
  produce(stop-here)
  peak=float(np.max(np.abs(array)))
  rms=float(np.sqrt(np.mean(array**2)))
  if rms<0.0005:raise RuntimeError('Synth rendered nearly silent audio')
  scale=min(1.0,0.92/max(.01,peak))
  out=np.clip(array*scale,-.99,.99)
  with wave.open(str(path),'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(SAMPLE_RATE)
   w.writeframes((out*32767).astype('<i2').tobytes())
  return {'peak_before_normalize':round(peak,4),'rms_before_normalize':round(rms,5),'seconds':round(stop/SAMPLE_RATE,3)}
 def close(self):
  for ch in (0,1,2,9):self.alloff(self.synth,ch)
  self.delete_synth(self.synth);self.delete_settings(self.settings)

def verify_midi(path, notes):
 parsed=mido.MidiFile(path)
 assert parsed.type==1 and parsed.ticks_per_beat==PPQ and len(parsed.tracks)==5
 counts=[];pitch_classes=[];onsets=[];max_tick=0
 for tr in parsed.tracks[1:]:
  t=0;last=0;ctnotes=0
  for msg in tr:
   t+=msg.time;max_tick=max(t,max_tick)
   if msg.type=='note_on' and msg.velocity:
    ctnotes+=1;pitch_classes.append(msg.note%12) if msg.channel!=9 else None
    onsets.append((t,msg.note,msg.channel))
  counts.append(ctnotes)
 assert sum(counts)==len(notes)
 assert all(p in MODE_PCS for p in pitch_classes)
 assert max_tick==SONG_TICKS
 assert sorted(counts)==sorted([sum(n.track==tr for n in notes) for tr in ('lead','keys','bass','drums')])
 return {'tracks':counts,'note_count':sum(counts),'pitched_pitch_classes':sorted(set(pitch_classes))}

def stats(notes):
 by=defaultdict(list)
 for n in notes:by[n.track].append(n)
 # Restrict offbeat check to starts within [.52,.80] beat for motif/key/bass/drums.
 def offbeats(rows):
  return [round((n.tick%PPQ)/PPQ,4) for n in rows if .52<((n.tick%PPQ)/PPQ)<.81]
 vals=offbeats(by['drums']);vels=np.array([n.velocity for n in by['drums']])
 return {'count_by_track':{k:len(by[k]) for k in ['lead','keys','bass','drums']},
         'total_notes':len(notes),'drum_midbeat_onsets':len(vals),
         'drum_midbeat_phase_median':round(float(np.median(vals)),4),
         'drum_midbeat_phase_q25_q75':[round(float(x),4) for x in np.quantile(vals,[.25,.75])],
         'drum_velocity_sd':round(float(np.std(vels)),2),
         'distinct_drum_pitches':sorted(set(n.pitch for n in by['drums'])),
         'has_dorian_natural_6_B':any(n.pitch%12==11 for n in by['lead']),
         'all_pitched_D_dorian':all(n.pitch%12 in MODE_PCS for n in notes if n.track!='drums')}

def main():
 sources=real_references()
 (HERE/'source_reference_features.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 results={}
 for name in 'ABC':
  notes=compose(name);midi=write_midi(notes,name)
  verification=verify_midi(midi,notes)
  wav=HERE/f'variant_{name}.wav'
  synth=Synth()
  try:
   audio=synth.render(notes,wav)
  finally:
   synth.close()
  mp3=HERE/f'variant_{name}.mp3'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af','loudnorm=I=-18:TP=-2.0:LRA=11','-c:a','libmp3lame','-qscale:a','2',str(mp3)],check=True)
  # For controlled comparison, all tracks/notes have the same pitch motif.
  results[name]={**VARIANTS[name],**stats(notes),'smf':verification,'audio':audio,
                 'midi_sha256':hashlib.sha256(midi.read_bytes()).hexdigest(),
                 'mp3_sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()}
  wav.unlink()
 lead_pitches=[]
 for name in 'ABC':
  notes=compose(name)
  lead_pitches.append([n.pitch for n in notes if n.track=='lead'])
 assert lead_pitches[0]==lead_pitches[1]==lead_pitches[2], 'lead motif must be invariant'
 assert results['A']['all_pitched_D_dorian'] and results['B']['all_pitched_D_dorian'] and results['C']['all_pitched_D_dorian']
 assert results['C']['drum_velocity_sd']!=results['A']['drum_velocity_sd']
 (HERE/'experiment_results.json').write_text(json.dumps({'metadata':{
  'experiment_type':'nonblinded single-session exploratory controlled arrangement comparison',
  'authoring':'one GPT-6 assistant-authored composition and three arrangement treatments in one context; NOT independently generated model runs',
  'scope':'meter/timing/texture comparison, not causally estimated musical quality',
  'fixed':{'tempo_bpm':TEMPO,'ppq':PPQ,'meter':'4/4','mode':'D dorian','bars':BARS,
   'chord_progression':CHORDS,'lead_pitch_sequence_invariant':True,'instruments':['Jazz guitar','Rhodes','Finger bass','GM drums']},
  'source_evidence':sources,'limitations':[
   'Both source Shuffle MIDIs come from drummer4 (not independent performers).',
   'Measurements of reference MIDI are evidence of onsets/velocity, not verified subjective style labels.',
   'A/B/C are authored in one shared LLM conversation; no blinded model calls or randomized seed were used.',
   'Arrangement variations were intentionally authored, not produced by a learned generator trained on source MIDI.',
   'Mechanical MIDI validations cannot demonstrate better musical quality; blind human listening is still pending.'
  ]},'variants':results},ensure_ascii=False,indent=2)+'\n')
 print('REFERENCE_SOURCE_FEATURES',json.dumps(sources))
 for name,r in results.items():print('VERIFIED',name,r['count_by_track'],r['drum_midbeat_phase_median'],r['drum_velocity_sd'],r['audio']['seconds'])

if __name__=='__main__':main()