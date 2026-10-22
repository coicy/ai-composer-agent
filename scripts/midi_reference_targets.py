#!/usr/bin/env python3
"""Coverage targets are independent evidence checks, NOT genre labels."""
from collections import Counter

# id, independent facet, exact value, minimum clips, minimum drummers,
# minimum distinct data collections. Expert-verified tags are currently absent.
TARGETS=[
 ('meter_4_4','meter','4/4',3,0,0),
 ('meter_3_4','meter','3/4',2,0,0),
 ('meter_6_8','meter','6/8',3,2,0),
 ('meter_12_8','meter','12/8',2,2,0),
 ('meter_5_4','meter','5/4',2,2,0),
 ('meter_5_8','meter','5/8',2,2,0),
 ('meter_7_8','meter','7/8',2,2,0),
 ('source_disco','source_style','dance/disco',2,2,0),
 ('source_breakbeat','source_style','dance/breakbeat',2,2,0),
 ('source_blues_shuffle','source_style','blues/shuffle',2,2,0),
 ('source_jazz_fusion','source_style','jazz/fusion',2,2,0),
 ('source_brazilian_baiao','source_style','latin/brazilian-baiao',2,2,0),
 ('game_battle','usage','battle',2,0,2),
 ('game_town','usage','town',2,0,2),
 ('game_dungeon','usage','dungeon',2,0,2),
 ('game_narrative','usage','narrative',2,0,2),
 ('mode_ionian','verified_mode','ionian',2,0,0),
 ('mode_aeolian','verified_mode','aeolian',2,0,0),
 ('mode_dorian','verified_mode','dorian',2,0,0),
 ('mode_mixolydian','verified_mode','mixolydian',2,0,0),
 ('mode_pentatonic','verified_mode','pentatonic',2,0,0),
 ('groove_swing','verified_groove','swing',2,0,0),
 ('groove_straight','verified_groove','straight',2,0,0),
 ('groove_shuffle','verified_groove','shuffle',2,0,0)
]

def evaluate_targets(items,targets=TARGETS):
 rows=[]
 for name,facet,value,minimum,min_drummers,min_sources in targets:
  found=[]
  for item in items:
   f=item['facets'];label=f['labels']
   if facet=='meter':match=value in f['meter']['values']
   elif facet=='source_style':match=label['source_style_label']==value
   elif facet=='usage':match=label['game_usage']==value
   elif facet=='verified_mode':match=(label['verified_mode']==value and f['pitch_language']['pitched_notes']>0)
   elif facet=='verified_groove':match=label['verified_groove']==value
   else:raise ValueError('Unknown facet '+facet)
   if match:found.append(item)
  drummers={x.get('metadata',{}).get('drummer') for x in found if x.get('metadata',{}).get('drummer')}
  sources={x['facets']['labels']['source_collection'] for x in found}
  covered=(len(found)>=minimum and len(drummers)>=min_drummers and len(sources)>=min_sources)
  status='missing' if not found else 'covered' if covered else 'partial'
  rows.append({
   'id':name,'facet':facet,'value':value,'status':status,
   'samples':len(found),'minimum_samples':minimum,
   'distinct_drummers':len(drummers),'minimum_drummers':min_drummers,
   'distinct_source_collections':len(sources),'minimum_sources':min_sources,
   'file_examples':[x['file'] for x in found[:3]]
  })
 counts=Counter(r['status'] for r in rows)
 return {
  'schema':'ai-composer-reference-targets-v1','targets':rows,
  'status_counts':{k:counts.get(k,0) for k in ('covered','partial','missing')},
  'warning':'Independent evidence goals, not genres; covered indicates only minimum evidence, NOT aesthetic representativity.'
 }

def format_targets(result):
 lines=['# 参考库采样充分性矩阵','',
        '> covered 仅表示满足最低样本数量及独立性门槛，并非风格或审美已获专家验证。','',
        '| 分面 | 目标 | 样本 | 独立鼓手 | 数据源 | 状态 |',
        '|---|---|---:|---:|---:|---|']
 for x in result['targets']:
  lines.append(f"| {x['facet']} | {x['value']} | {x['samples']}/{x['minimum_samples']} | {x['distinct_drummers']}/{x['minimum_drummers']} | {x['distinct_source_collections']}/{x['minimum_sources']} | {x['status']} |")
 lines+=['','缺失或部分覆盖会作为下一轮定向采样依据。零样本和未验证标签不得自动填充。','']
 return '\n'.join(lines)
