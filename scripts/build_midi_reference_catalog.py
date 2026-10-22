#!/usr/bin/env python3
"""Fetch and audit a representative MIDI reference pack. Sources are unmodified."""
import csv,hashlib,io,json,pathlib,statistics,time,urllib.request,urllib.parse,zipfile
from collections import defaultdict,Counter
from html.parser import HTMLParser
import mido
from midi_reference_facets import enrich_catalog,format_report
from midi_reference_targets import evaluate_targets,format_targets

HERE=pathlib.Path(__file__).resolve().parent
OUT=HERE/'reference-output'
OUT.mkdir(exist_ok=True)
GMD='https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip'
GMD_SHA='651cbc524ffb891be1a3e46d89dc82a1cecb09a57c748c7b45b844c4841dcc1e'
OGA='https://opengameart.org/sites/default/files/15_melodic_rpg_chiptunes_mid.zip'
RHYTHM={'rock':(3,112),'funk':(3,105),'jazz':(3,125),'latin':(3,110),'hiphop':(3,92),'dance':(2,125),'blues':(2,95),'pop':(2,110),'soul':(2,100),}
GAME={'game_town':['rpgchip03_town','rpgchip04_in_the_royal_court'],'game_dungeon':['rpgchip06_dungeon','rpgchip07_the_shrine_of_mysteries'],'game_battle':['rpgchip13_battle_1','rpgchip14_battle_2'],'game_narrative':['rpgchip02_bittersweet_story','rpgchip09_rainy_streets']}
SCORE={'baroque_counterpoint':[('Bach Invention No. 3 BWV 774',70),('Bach Invention No. 8 BWV 779',61)],'classical_form':[('Mozart Sonata K309 I',1379),('Beethoven Fuer Elise',931)],'romantic_piano':[('Chopin Minute Waltz',483),('Chopin Waltz B minor Op69 No2',511)],'ragtime_piano':[('Joplin Maple Leaf Rag',23),('Joplin Pineapple Rag',1899)]}
groups=defaultdict(list)

class MidiLinks(HTMLParser):
 def __init__(self):super().__init__();self.href=None;self.words='';self.matches=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.href=dict(attrs).get('href');self.words=''
 def handle_data(self,v):
  if self.href is not None:self.words+=v
 def handle_endtag(self,tag):
  if tag=='a' and self.href is not None:
   if self.words.strip().lower()=='midi file' and '.mid' in self.href:self.matches.append(self.href)
   self.href=None

def fetch(url,limit=7_000_000):
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
   with urllib.request.urlopen(req,timeout=75) as resp:raw=resp.read(limit+1)
   if len(raw)>limit:raise RuntimeError('Download exceeds limit '+url)
   return raw
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)

def add(style,title,blob,source,license_name,source_member,meta):
 if blob[:4]!=b'MThd':raise RuntimeError('invalid MIDI '+title)
 midi=mido.MidiFile(file=io.BytesIO(blob));events=[];tempo=[];meter=[];channels=set();ccs=set();programs=[]
 for track in midi.tracks:
  tick=0
  for msg in track:
   tick+=msg.time
   if msg.type=='note_on' and msg.velocity>0:events.append((tick,msg.note,msg.velocity));channels.add(msg.channel)
   elif msg.type=='set_tempo':tempo.append(round(mido.tempo2bpm(msg.tempo),1))
   elif msg.type=='time_signature':meter.append(str(msg.numerator)+'/'+str(msg.denominator))
   elif msg.type=='control_change':ccs.add(msg.control)
   elif msg.type=='program_change':programs.append((msg.channel,msg.program))
 if len(events)<8:raise RuntimeError('empty MIDI '+title)
 path=OUT/'midi'/style/(style+'_'+str(len(groups[style])+1).zfill(2)+'.mid')
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(blob)
 item={'style':style,'title':title,'file':str(path.relative_to(OUT)),'source_page':source,'license':license_name,'source_member':source_member,'sha256':hashlib.sha256(blob).hexdigest(),'metadata':meta,
 'analysis':{'note_count':len(events),'track_count':len(midi.tracks),'ppq':midi.ticks_per_beat,'pitch_range':[min(n for _,n,_ in events),max(n for _,n,_ in events)],'tempo_events':tempo[:16],'meter_events':meter[:16],'channel_10_drums':9 in channels,'program_change_count':len(programs),'controller_numbers':sorted(ccs),'velocity_mean':round(statistics.mean(v for _,_,v in events),1),'velocity_sd':round(statistics.pstdev(v for _,_,v in events),1)}}
 groups[style].append(item);print('SELECTED',style,title,path.name,len(events),flush=True)

def main():
 print('Downloading GMD 3.11MB MIDI-only archive...',flush=True)
 data=fetch(GMD)
 if hashlib.sha256(data).hexdigest()!=GMD_SHA:raise RuntimeError('GMD archive checksum mismatch')
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  files=z.namelist();info=next(x for x in files if x.endswith('info.csv'))
  rows=list(csv.DictReader(io.StringIO(z.read(info).decode('utf-8-sig'))))
  print('GMD_BEAT_METER_COUNTS',dict(sorted(Counter(r.get('time_signature') for r in rows if r.get('beat_type')=='beat').items())),flush=True)
  for style,(wanted,target_bpm) in RHYTHM.items():
   candidates=[]
   for r in rows:
    if r.get('style','').split('/')[0].lower()!=style or r.get('beat_type')!='beat':continue
    bpm=float(r['bpm']);duration=float(r['duration'])
    if duration<6 or duration>75 or bpm<55 or bpm>205:continue
    relative=r['midi_filename'].lstrip('/')
    hits=[f for f in files if f==relative or f.endswith('/'+relative)]
    if len(hits)!=1:continue
    score=(0 if r.get('time_signature') in ('4-4','4/4') else 6)+abs(bpm-target_bpm)/40+abs(duration-16)/60
    candidates.append((score,r,hits[0]))
   candidates.sort(key=lambda x:(x[0],x[2]))
   chosen=[];drummers=set()
   for _,r,path in candidates:
    if r.get('drummer') not in drummers:chosen.append((r,path));drummers.add(r.get('drummer'))
    if len(chosen)>=wanted:break
   for _,r,path in candidates:
    if len(chosen)>=wanted:break
    if path not in [p for _,p in chosen]:chosen.append((r,path))
   if len(chosen)<2:raise RuntimeError(style+' has fewer than 2 valid genre beats')
   for r,path in chosen:
    add(style,'GMD '+r['style']+' '+r['drummer'],z.read(path),'https://magenta.withgoogle.com/datasets/groove','CC BY 4.0',path,{**{k:r.get(k) for k in ('style','bpm','time_signature','duration','drummer','beat_type','split')},'attribution':'Google LLC; Groove MIDI Dataset; Gillick et al. 2019'})
  # Evidence-only meter probes. These are NOT new music genres; scarce
  # 5/4 and 5/8 samples remain insufficient as representative categories.
  for meter,wanted in {'6-8':3,'5-4':1,'5-8':1}.items():
   candidates=[]
   for row in rows:
    if row.get('beat_type')!='beat' or row.get('time_signature')!=meter:continue
    path=row['midi_filename'].lstrip('/')
    matches=[f for f in files if f==path or f.endswith('/'+path)]
    if len(matches)!=1:continue
    candidates.append((abs(float(row['duration'])-18),row,matches[0]))
   candidates.sort(key=lambda x:(x[0],x[2]))
   chosen=[];drummers=set()
   for _,row,path in candidates:
    if row['drummer'] not in drummers:
     chosen.append((row,path));drummers.add(row['drummer'])
    if len(chosen)>=wanted:break
   for _,row,path in candidates:
    if len(chosen)>=wanted:break
    if path not in {p for _,p in chosen}:chosen.append((row,path))
   if len(chosen)<wanted:raise RuntimeError(f'{meter}: insufficient sample candidates: {len(chosen)}/{wanted}')
   bucket='meter_'+meter.replace('-','_')
   for row,path in chosen:
    meta={k:row.get(k) for k in ('style','bpm','time_signature','duration','drummer','beat_type','split')}
    meta.update({'sample_role':'meter_coverage_probe',
                 'attribution':'Google LLC; Groove MIDI Dataset; Gillick et al. 2019'})
    add(bucket,f"GMD {row['time_signature']} · {row['style']} · {row['drummer']}",
        z.read(path),'https://magenta.withgoogle.com/datasets/groove','CC BY 4.0',path,meta)
 print('Downloading OpenGameArt CC0 RPG MIDI...',flush=True)
 with zipfile.ZipFile(io.BytesIO(fetch(OGA))) as z:
  names=z.namelist()
  for style,titles in GAME.items():
   for title in titles:
    matches=[name for name in names if name.lower().endswith(title.lower()+'.mid') or name.lower().endswith(title.lower()+'.midi')]
    if len(matches)!=1:raise RuntimeError('missing RPG '+title+': '+str(matches))
    add(style,title,z.read(matches[0]),'https://opengameart.org/content/15-melodic-rpg-chiptunes','CC0-1.0',matches[0],{'attribution':'Aureolus_Omicron (CC0)'})
 print('Downloading 8 Mutopia scores...',flush=True)
 for style,pieces in SCORE.items():
  for title,piece_id in pieces:
   page='https://www.mutopiaproject.org/cgibin/piece-info.cgi?id='+str(piece_id)
   links=MidiLinks();links.feed(fetch(page,500_000).decode('utf-8','replace'))
   if len(links.matches)!=1:raise RuntimeError('missing exact MIDI on '+page)
   midi_url=urllib.parse.urljoin(page,links.matches[0])
   add(style,title,fetch(midi_url,2_000_000),page,'Public Domain',midi_url,{'attribution':title+' · Mutopia Project volunteer edition'})
 for style,entries in groups.items():
  if not style.startswith('meter_') and not 2<=len(entries)<=3:raise RuntimeError('invalid source index count '+style)
 items=[x for name in sorted(groups) for x in groups[name]]
 coverage=enrich_catalog(items,lambda rel:(OUT/rel).read_bytes())
 (OUT/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (OUT/'COVERAGE.md').write_text(format_report(coverage),encoding='utf-8')
 targets=evaluate_targets(items)
 (OUT/'targets.json').write_text(json.dumps(targets,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (OUT/'TARGETS.md').write_text(format_targets(targets),encoding='utf-8')
 print('TARGET_STATUS',targets['status_counts'],flush=True)
 print('FACET_COVERAGE',coverage['capabilities'],flush=True)
 print('MISSING_METERS',coverage['missing_priority_meters'],flush=True)
 manifest={'total_styles':len(RHYTHM)+len(GAME)+len(SCORE),'total_sampling_buckets':len(groups),'total_files':len(items),'style_counts':{k:len(groups[k]) for k in sorted(groups)},'items':items,
 'licensing':'GMD CC BY 4.0 requires attribution; RPG CC0; selected Mutopia editions are individually labeled Public Domain.',
 'limitations':'GMD is drum-only, not harmony. Mutopia is score-rendered and not a human groove reference. ai-composer-agent MIDI import currently loses tempo/meter/program/CC/channel fidelity.',
 'selection':'GMD beat-type performances; typical BPM, duration, mostly 4/4, differing drummers when available; game tracks selected by named context; Mutopia by canonical style and public-domain notation.',
 'facets_schema':'ai-composer-reference-facets-v1',
 'sampling_disclaimer':'meter_* buckets are facet probes, NOT musical style classes; 1-item probes are insufficient to represent a style.',
 'coverage_file':'coverage.json',
 'targets_file':'targets.json'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 lines=['# Representative MIDI reference catalog','',str(len(RHYTHM)+len(GAME)+len(SCORE))+' original indexing groups plus '+str(len(groups)-len(RHYTHM)-len(GAME)-len(SCORE))+' **meter-only probe buckets**; '+str(len(items))+' original MIDI files.','','The meter-only buckets have 1 or 3 samples; a single rare meter example is **not a representative style**.','','## Tracks','']
 for style in sorted(groups):
  lines+=['### '+style,'']
  for x in groups[style]:lines.append('- '+x['file']+' — '+x['title']+' · '+x['license']+' · '+str(x['analysis']['note_count'])+' note-ons · '+x['source_page'])
  lines.append('')
 lines+=['## Coverage','', 'See COVERAGE.md, coverage.json, TARGETS.md and targets.json. Feature dimensions are independent; no verified genre, mode, swing or form claims are inferred from MIDI alone.', '','## Usage','', '1. Hear the originals in an external General MIDI player.', '2. In ai-composer-agent use Import MIDI; verify note content and track division, not instrument/tempo fidelity.', '3. Feed feature summaries to an external LLM Agent rather than pasting entire copyrighted music into context.', '4. Preserve source and license information from manifest.json.', '', 'These original MIDI bytes have NOT been quantized, normalized, edited or re-exported.']
 (OUT/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 with zipfile.ZipFile(HERE/'representative_midi_references.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(OUT.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(OUT))
 print('READY',len(RHYTHM)+len(GAME)+len(SCORE),'original groups',len(groups),'sampling buckets',len(items),'MIDIs',flush=True)

if __name__=='__main__':main()
