#!/usr/bin/env python3
"""MIDI reference features with explicit source evidence and unknown values."""
from collections import Counter,defaultdict
from hashlib import sha256
import io
import statistics
import mido

METER_TARGETS = ('2/4','3/4','4/4','6/8','9/8','12/8','5/4','5/8','7/8','7/4')
SOURCE_KINDS = {
 'magenta.withgoogle.com':'human_drum_performance',
 'opengameart.org':'game_composition_midi',
 'mutopiaproject.org':'score_derived_midi'
}
GAME_USAGE = {
 'game_town':'town','game_battle':'battle',
 'game_dungeon':'dungeon','game_narrative':'narrative'
}

def _source_kind(item):
 for domain,kind in SOURCE_KINDS.items():
  if domain in item['source_page']:return kind
 return 'unknown'

def _meter_metadata(value):
 if not isinstance(value,str):return None
 p=value.strip().replace('-','/').split('/')
 if len(p)!=2:return None
 try:n,d=map(int,p)
 except ValueError:return None
 return f'{n}/{d}' if n>0 and d>0 and d&(d-1)==0 else None

def analyze_reference(item,midi_bytes):
 """Return independent dimensions; no inference of style/mode/swing."""
 if sha256(midi_bytes).hexdigest()!=item['sha256']:
  raise ValueError('Reference SHA-256 mismatch: '+item['file'])
 song=mido.MidiFile(file=io.BytesIO(midi_bytes))
 if song.ticks_per_beat<=0:raise ValueError('Invalid PPQ')
 kind=_source_kind(item);meta=item.get('metadata',{})
 notes=[];meters=[];tempos=[];keys=[];programs=[];ccs=set()
 for ti,track in enumerate(song.tracks):
  tick=0
  for msg in track:
   tick+=msg.time
   if msg.type=='note_on' and msg.velocity>0:
    notes.append((tick,msg.channel,msg.note,msg.velocity,ti))
   elif msg.type=='time_signature':meters.append((tick,f'{msg.numerator}/{msg.denominator}'))
   elif msg.type=='set_tempo':tempos.append((tick,round(mido.tempo2bpm(msg.tempo),2)))
   elif msg.type=='key_signature':keys.append((tick,msg.key))
   elif msg.type=='program_change':programs.append((msg.channel,msg.program))
   elif msg.type=='control_change':ccs.add(msg.control)
 if not notes:raise ValueError('No audible note-on events')
 pitched=[(t,p,v) for t,ch,p,v,_ in notes if ch!=9]
 drums=[(t,p,v) for t,ch,p,v,_ in notes if ch==9]
 meter=sorted({v for _,v in meters})
 meter_source='midi_event' if meter else 'unknown'
 if not meter:
  declared=_meter_metadata(meta.get('time_signature'))
  if declared:meter=[declared];meter_source='source_annotation'
 bpm=sorted({v for _,v in tempos})
 bpm_source='midi_event' if bpm else 'unknown'
 if not bpm and isinstance(meta.get('bpm'),(int,float,str)):
  try:
   v=float(meta['bpm'])
   if 15<=v<=400:bpm=[round(v,2)];bpm_source='source_annotation'
  except (ValueError,TypeError):pass
 histogram=Counter(p%12 for _,p,_ in pitched)
 pitch_classes=[histogram.get(i,0) for i in range(12)] if pitched else None
 ppq=song.ticks_per_beat
 phases=Counter(int(round(((t%ppq)/ppq)*16))%16 for t,_,_,_,_ in notes)
 phase_hist=[phases.get(i,0) for i in range(16)]
 velocities=[v for _,_,_,v,_ in notes]
 velocity_sd=round(statistics.pstdev(velocities),2)
 raw_style=meta.get('style') if kind=='human_drum_performance' else None
 return {
  'labels':{
   'source_collection':kind,
   'source_style_label':raw_style if isinstance(raw_style,str) and raw_style else None,
   'source_index_group':item['style'],
   'game_usage':GAME_USAGE.get(item['style']),
   'verified_genre':None,'verified_mode':None,
   'verified_groove':None,'verified_form':None
  },
  'meter':{'values':meter,'source':meter_source,
           'changes':len(set(meters))>1},
  'tempo':{'bpm_values':bpm,'source':bpm_source,
           'changes':len(set(tempos))>1},
  'pitch_language':{
   'status':'observable' if pitched else 'not_applicable_percussion_only',
   'pitched_notes':len(pitched),'percussion_notes':len(drums),
   'pitch_classes_c_to_b':pitch_classes,
   'key_signature_events':sorted({v for _,v in keys}),
   'verified_tonic':None,'verified_mode':None
  },
  'rhythm':{
   'note_onset_count':len(notes),
   'last_onset_beats':round(max(t for t,_,_,_,_ in notes)/ppq,2),
   'quarter_note_phase_16_bins':phase_hist,
   'swing_classification':None,'microtiming_style':None,
   'performance_source':kind=='human_drum_performance'
  },
  'performance':{
   'velocity_standard_deviation':velocity_sd,
   'velocity_variation_observed':velocity_sd>0,
   'controller_numbers':sorted(ccs),
   'pedal_64_observed':64 in ccs
  },
  'instrumentation':{
   'pitched_midi_channels':sorted({ch for _,ch,_,_,_ in notes if ch!=9}),
   'drum_channel_10_observed':bool(drums),
   'programs':sorted(set(programs)),
   'distinct_note_tracks':len({ti for _,_,_,_,ti in notes})
  }
 }

def build_coverage(items):
 meters=Counter();groups=Counter();sources=Counter();styles=Counter();usages=Counter();counts=Counter();performers=defaultdict(set)
 for item in items:
  f=item['facets'];label=f['labels']
  sources[label['source_collection']]+=1;groups[item['style']]+=1
  if label['source_collection']=='human_drum_performance' and item.get('metadata',{}).get('drummer'):
   performers[item['style']].add(item['metadata']['drummer'])
  if label['source_style_label']:styles[label['source_style_label']]+=1
  if label['game_usage']:usages[label['game_usage']]+=1
  if not f['meter']['values']:counts['meter_unknown']+=1
  for m in f['meter']['values']:meters[m]+=1
  if f['pitch_language']['pitched_notes']:counts['pitched_material']+=1
  else:counts['drum_only']+=1
  if f['performance']['velocity_variation_observed']:counts['velocity_variation_observed']+=1
  if f['rhythm']['performance_source']:counts['human_performance_drums']+=1
  if label['verified_mode'] is not None:counts['expert_verified_mode']+=1
  if label['verified_groove'] is not None:counts['expert_verified_groove']+=1
  if label['verified_form'] is not None:counts['expert_verified_form']+=1
 targets={m:meters.get(m,0) for m in METER_TARGETS}
 return {
  'schema':'ai-composer-reference-coverage-v1',
  'total_midi':len(items),
  'original_index_groups':dict(sorted(groups.items())),
  'evidence_source_counts':dict(sorted(sources.items())),
  'source_style_labels':dict(sorted(styles.items())),
  'known_distinct_drummers_by_bucket':{k:len(v) for k,v in sorted(performers.items())},
  'game_usage':dict(sorted(usages.items())),
  'observed_meters':dict(sorted(meters.items())),
  'priority_meters':targets,
  'capabilities':{k:counts.get(k,0) for k in (
   'pitched_material','drum_only','meter_unknown','human_performance_drums',
   'velocity_variation_observed','expert_verified_mode',
   'expert_verified_groove','expert_verified_form')},
  'coverage_warnings':[
   'Original index groups are not mutually exclusive musical genres.',
   'Drum-only MIDI files must not count toward pitch/mode/harmony coverage.',
   'Key signatures and pitch-class histograms are not verified key or mode labels.',
   'Sixteenth-phase timing histograms are not swing or human-feel certifications.',
   'Game usage labels are not genre labels.',
   'MIDI instrument programs do not fully capture synthesized audio timbre.'
  ],
  'missing_priority_meters':[m for m,n in targets.items() if n==0],
  'sampling_warnings':[
   f'{bucket}: {groups[bucket]} clips from {len(people)} documented drummer(s); recordings are not independent performers.'
   for bucket,people in sorted(performers.items()) if groups[bucket]>1 and len(people)<2
  ]+[
   f'{bucket}: only {groups[bucket]} source clip(s); useful as a meter probe but insufficient for style representativity.'
   for bucket in sorted(groups) if bucket.startswith('meter_') and groups[bucket]<2
  ]
 }

def enrich_catalog(items,data_reader):
 for item in items:item['facets']=analyze_reference(item,data_reader(item['file']))
 return build_coverage(items)

def format_report(coverage):
 lines=['# 多维 MIDI 覆盖矩阵（自动生成）','',
        '> MIDI 事件证据与未验证风格严格分离；文件夹名不是互斥的流派标签。','',
        f"- MIDI 文件数：{coverage['total_midi']}",
        f"- 原有索引组数：{len(coverage['original_index_groups'])}",
        '','## 拍号覆盖','','| 拍号 | MIDI 数量 | 结果 |','|---|---:|---|']
 for m,n in coverage['priority_meters'].items():
  lines.append(f'| {m} | {n} | '+('已有证据' if n else '**待补充**')+' |')
 lines+=['','## 来源与能力边界','','| 指标 | 数量 |','|---|---:|']
 for source,n in coverage['evidence_source_counts'].items():
  lines.append(f'| 来源：{source} | {n} |')
 for cap,n in coverage['capabilities'].items():
  lines.append(f'| {cap} | {n} |')
 lines+=['','## 样本独立性风险','']
 lines+=['- '+warning for warning in coverage['sampling_warnings']]
 lines+=['','## 重要提示','']
 lines+=['- '+warning for warning in coverage['coverage_warnings']]
 lines+=['','## 报告范围','',
         '已观测：MIDI 音符、拍号/速度元事件、来源标签、力度数值。',
         '未证明：感知拍型分组、Swing 类别、主音和调式、和弦功能、曲式、风格审美。',
         '未知不是否定；以上音乐学标签需要可信注释或专家复核。','']
 return '\n'.join(lines)
