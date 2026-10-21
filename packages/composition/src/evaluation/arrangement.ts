import type {MidiNote,MusicTrack} from '@ai-composer/music-core';
import {analyzeTonality,suggestChords} from '../analysis/tonality.js';
import type {ChordSuggestion,TonalProfile} from '../analysis/tonality.js';

export interface ArrangementFinding {
 readonly code:'bass_above_melody'|'bass_register'|'large_voice_leap'|'harmony_bass_crossing'|'dense_dissonance';
 readonly message:string;
 readonly count:number;
 readonly severity:'review';
}
export interface ArrangementMetrics {
 readonly simultaneousMelodyHarmony:number;
 readonly dissonantMelodyHarmony:number;
 readonly bassAboveMelody:number;
 readonly bassRegisterOutliers:number;
 readonly largeVoiceLeaps:number;
 readonly harmonyBassCrossings:number;
}
export interface ArrangementAssessment {
 readonly tonalProfile:TonalProfile;
 readonly chordSuggestions:readonly ChordSuggestion[];
 readonly metrics:ArrangementMetrics;
 readonly findings:readonly ArrangementFinding[];
 readonly disclaimer:string;
}
const overlaps=(a:MidiNote,b:MidiNote)=>a.startTick<b.startTick+b.durationTicks&&b.startTick<a.startTick+a.durationTicks;
const pitchClassInterval=(a:number,b:number)=>Math.abs(a-b)%12;
/** Advisory heuristics only: never grounds for silently rejecting or repairing valid MIDI. */
export function evaluateArrangement(source:readonly MidiNote[],tracks:readonly MusicTrack[],startTick:number,endTick:number,ppq:number):ArrangementAssessment{
 if(tracks.length!==3)throw new Error('assessment_requires_three_tracks');
 const [harmony,bass,accompaniment]=tracks;
 if(!harmony||!bass||!accompaniment)throw new Error('assessment_requires_three_tracks');
 let simultaneousMelodyHarmony=0,dissonantMelodyHarmony=0,bassAboveMelody=0,bassRegisterOutliers=0,largeVoiceLeaps=0,harmonyBassCrossings=0;
 for(const m of source){
  for(const h of harmony.notes)if(overlaps(m,h)){
   simultaneousMelodyHarmony++;
   if([1,2,6,10,11].includes(pitchClassInterval(m.pitch,h.pitch)))dissonantMelodyHarmony++;
  }
  for(const b of bass.notes)if(overlaps(m,b)&&b.pitch>=m.pitch)bassAboveMelody++;
 }
 for(const b of bass.notes){
  if(b.pitch<28||b.pitch>60)bassRegisterOutliers++;
  for(const h of harmony.notes)if(overlaps(b,h)&&h.pitch<b.pitch)harmonyBassCrossings++;
 }
 for(const t of tracks){
  const sequential=[...t.notes].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
  let previous:MidiNote|undefined;
  for(const n of sequential){
   if(previous&&n.startTick>previous.startTick&&Math.abs(n.pitch-previous.pitch)>12)largeVoiceLeaps++;
   previous=n;
  }
 }
 const metrics={simultaneousMelodyHarmony,dissonantMelodyHarmony,bassAboveMelody,bassRegisterOutliers,largeVoiceLeaps,harmonyBassCrossings};
 const findings:ArrangementFinding[]=[];
 function add(code:ArrangementFinding['code'],count:number,message:string){if(count>0)findings.push({code,count,message,severity:'review'});}
 add('bass_above_melody',bassAboveMelody,'低音音符与旋律同时发声时存在低音高于或等于旋律的情况，请核听声部关系。');
 add('bass_register',bassRegisterOutliers,'部分低音不在启发式参考音域 MIDI 28–60，需核对乐器和配器目标。');
 add('large_voice_leap',largeVoiceLeaps,'某些声部相邻起音相差超过十二半音，建议检查声部进行。');
 add('harmony_bass_crossing',harmonyBassCrossings,'和声声部与低音存在音区交叉，建议检查是否有意为之。');
 if(simultaneousMelodyHarmony>=2&&dissonantMelodyHarmony/simultaneousMelodyHarmony>=.5){
  add('dense_dissonance',dissonantMelodyHarmony,'与旋律同时发声的和声音程中有较高比例的紧张音程，请核听其解决方式。');
 }
 return {tonalProfile:analyzeTonality(source,startTick,endTick),
  chordSuggestions:suggestChords(source,startTick,endTick,ppq),metrics,findings,
  disclaimer:'基于音符重叠、音高分布和相邻进行的启发式提示；不是调性定论、和弦识别证明或编配质量评分。'};
}
