import type {MusicTrack} from '@ai-composer/music-core';
import type {TechniqueChoice,TechniquePlan,TechniqueId} from '../planning/electronic-techniques.js';

export interface TechniqueEvidence {
 readonly id:TechniqueId;
 readonly priority:TechniqueChoice['priority'];
 readonly state:'observed'|'not_observed'|'not_evaluable';
 readonly advisory:true;
 readonly summary:string;
}
function count<T>(xs:readonly T[],fn:(x:T)=>boolean):number{return xs.filter(fn).length;}
function observation(technique:TechniqueChoice,tracks:readonly MusicTrack[],ppq:number):TechniqueEvidence{
 const id=technique.id,role=technique.slot;
 const none=(summary:string):TechniqueEvidence=>({id,priority:technique.priority,state:'not_evaluable',advisory:true,summary});
 if(role==='drums')return none('Legacy three-role arranger cannot write an independent drum lane; its recommended pulse is not in this MIDI candidate.');
 if(role==='transition')return none('Transition/break is a phrase-level musical decision; this small snapshot alone is insufficient.');
 const part=tracks[role==='bass'?1:role==='harmony_sustain'?0:2];
 if(!part)return none('No role track found for analysis.');
 const notes=[...part.notes].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
 if(notes.length===0)return {id,priority:technique.priority,state:'not_observed',advisory:true,summary:'No MIDI notes in expected part.'};
 const observed=(matched:boolean,summary:string):TechniqueEvidence=>({
  id,priority:technique.priority,state:matched?'observed':'not_observed',advisory:true,summary
 });
 const offbeat=count(notes,n=>{
  const fraction=(n.startTick%ppq)/ppq;return fraction>=0.35&&fraction<=0.8;
 });
 const shortNotes=count(notes,n=>n.durationTicks<=ppq);
 const sustained=count(notes,n=>n.durationTicks>=2*ppq);
 const distances=notes.slice(1).map((n,i)=>n.pitch-notes[i]!.pitch);
 const uniquePitches=new Set(notes.map(n=>n.pitch%12)).size;
 switch(id){
  case 'offbeat_bass':return observed(offbeat>=2,'Check audible offbeat bass entries, in register and harmony with the kick; timing metric only.');
  case 'octave_bass':return observed(distances.some(n=>Math.abs(n)===12),'Check root/octave movement and groove coordination.');
  case 'rolling_bass':return observed(notes.length>=4&&shortNotes>=3,'Check that the rolling bass figure is sustained over multiple note attacks.');
  case 'sub_drone':return observed(sustained>=1,'Check continuous low drone / sustained pedal.');
  case 'arpeggio_ascending':return observed(notes.length>=4&&uniquePitches>=3&&count(distances,d=>d>0)>=3,
   'Check a recurrent upward chord-tone contour; actual chords, voicing and musical phrasing still require review.');
  case 'arpeggio_pingpong':return observed(notes.length>=5&&uniquePitches>=3&&distances.some((d,i)=>i>0&&Math.sign(d)*Math.sign(distances[i-1]!)<0),
   'Check up/down melodic contour and chord-tone order; do not label all pitch contours as arpeggios.');
  case 'alberti':return observed(notes.length>=4&&uniquePitches>=3,
   'Only enough note activity and pitch variety is observed; Alberti low-high-mid-high order still needs explicit chord evidence.');
  case 'chord_stabs':return observed(shortNotes>=2&&
   notes.some((n,i)=>notes.some((m,j)=>i!==j&&n.startTick===m.startTick)),
   'Check short simultaneous chord attacks; time/velocity and harmonic voice-leading still require musical review.');
  case 'ostinato':return observed(notes.length>=4&&uniquePitches>=1,
   'A repeated note texture MAY be present; motif similarity and phrase-level development are not proven.');
  case 'pad_chords':return observed(sustained>=1,'Check sustained pad-like harmonic support; actual pad timbre is outside MIDI.');
  case 'pedal_tone':return observed(sustained>=1,'Check long held pedal tone and chord-change behavior.');
  case 'reese_bass':return none('Reese denotes timbre/processing which MIDI note data cannot authenticate.');
  default:return none('Requires phrase context or audio timbre evidence rather than note-only classification.');
 }
}
/** Explicitly advisory: high weight increases LLM prompting, never causes unapproved edits. */
export function evaluateTechniqueEvidence(
 plan:TechniquePlan,tracks:readonly MusicTrack[],ppq:number
):readonly TechniqueEvidence[]{
 return plan.choices.map(choice=>observation(choice,tracks,ppq));
}