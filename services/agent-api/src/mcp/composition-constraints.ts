/**
 * Bounded deterministic checks to help an EXTERNAL general-purpose LLM compose MIDI.
 * These are musical constraints and observable timing diagnostics, not a generator,
 * an aesthetic quality score, or proof that a passage establishes a musical mode.
 */
export const MODES={
 ionian:[0,2,4,5,7,9,11],
 aeolian:[0,2,3,5,7,8,10],
 dorian:[0,2,3,5,7,9,10],
 mixolydian:[0,2,4,5,7,9,10],
 phrygian:[0,1,3,5,7,8,10],
 lydian:[0,2,4,6,7,9,11],
 locrian:[0,1,3,5,6,8,10],
 major_pentatonic:[0,2,4,7,9],
 minor_pentatonic:[0,3,5,7,10]
} as const;
export type Mode=keyof typeof MODES;
export type Groove='straight'|'swing'|'shuffle';
export type MusicSpec={
 tonic:number;mode:Mode;meter:string;groove:Groove;ppq:number;
 startTick:number;endTick:number;allowChromatic:boolean;
};
export type CandidateNote={pitch:number;startTick:number;durationTicks:number;velocity:number};
type Diagnostic={code:string;severity:'error'|'warning';noteIndex?:number;detail:string};
const METER=/^([2-9]|1[0-2])\/(2|4|8|16)$/;
function safeInteger(x:unknown,lower:number,upper:number):x is number{
 return typeof x==='number'&&Number.isSafeInteger(x)&&x>=lower&&x<=upper;
}
export function parseMusicSpec(args:Record<string,unknown>,ppq:number):MusicSpec{
 const tonic=args.tonic;
 if(!safeInteger(tonic,0,11))throw Error('invalid_tonic');
 const mode=args.mode;
 if(typeof mode!=='string'||!Object.hasOwn(MODES,mode))throw Error('invalid_mode');
 const meter=args.meter;
 if(typeof meter!=='string'||!METER.test(meter))throw Error('invalid_meter');
 const [num,den]=meter.split('/').map(Number);
 const barTicks=ppq*num!*4/den!;
 if(!Number.isSafeInteger(barTicks)||barTicks<1)throw Error('unsupported_meter_ppq');
 const groove=args.groove;
 if(groove!=='straight'&&groove!=='swing'&&groove!=='shuffle')throw Error('invalid_groove');
 const startTick=args.startTick,endTick=args.endTick;
 if(!safeInteger(startTick,0,ppq*4*256)||!safeInteger(endTick,1,ppq*4*256)||
  endTick<=startTick||endTick-startTick>ppq*4*16)throw Error('invalid_scope');
 if(args.allowChromatic!==undefined&&typeof args.allowChromatic!=='boolean')throw Error('invalid_allow_chromatic');
 return {tonic,mode:mode as Mode,meter,groove,ppq,startTick,endTick,
  allowChromatic:args.allowChromatic===true};
}
export function explainSpec(spec:MusicSpec){
 const pitchClasses=MODES[spec.mode].map(step=>(step+spec.tonic)%12);
 const [numerator,denominator]=spec.meter.split('/').map(Number);
 return {
  ppq:spec.ppq,
  tonicPitchClassC0:spec.tonic,
  mode:spec.mode,
  allowedPitchClassesC0ToB11:[...pitchClasses].sort((a,b)=>a-b),
  meter:spec.meter,
  meterTicksPerBar:spec.ppq*numerator!*4/denominator!,
  groove:spec.groove,
  // Groove positioning remains observable timing, not a guaranteed "feel" classifier.
  proposedOffbeatPositionWithinQuarterTicks:Math.round(spec.ppq*(spec.groove==='straight'?0.5:2/3)),
  requestedScope:{startTick:spec.startTick,endTick:spec.endTick},
  allowChromatic:spec.allowChromatic,
  caveat:'The pitch-class check does not establish a tonal center; swing and shuffle share a triplet-like offbeat target, but differ in accent, phrase and context.'
 };
}
export function checkCandidate(notes:CandidateNote[],spec:MusicSpec){
 const errors:Diagnostic[]=[],warnings:Diagnostic[]=[];
 const allowed=new Set(MODES[spec.mode].map(interval=>(interval+spec.tonic)%12));
 const observations:number[]=[];
 const maxNotes=64;
 if(!Array.isArray(notes)||notes.length<1||notes.length>maxNotes){
  return {passed:false,diagnostics:[{code:'invalid_note_count',severity:'error' as const,
   detail:'Supply 1–64 notes'}],grooveEvidence:{status:'insufficient_evidence',observedOffbeats:0},
   constraints:explainSpec(spec)};
 }
 for(let i=0;i<notes.length;i++){
  const n=notes[i]!;
  if(!safeInteger(n.pitch,0,127)||!safeInteger(n.velocity,1,127)||
    !safeInteger(n.startTick,0,Number.MAX_SAFE_INTEGER)||
    !safeInteger(n.durationTicks,1,Number.MAX_SAFE_INTEGER)){
   errors.push({code:'invalid_midi_note',severity:'error',noteIndex:i,
    detail:'Pitch 0–127, velocity 1–127, nonnegative integer startTick and positive integer durationTicks required.'});
   continue;
  }
  if(n.startTick<spec.startTick||n.startTick+n.durationTicks>spec.endTick)
   errors.push({code:'note_outside_requested_scope',severity:'error',noteIndex:i,
    detail:'Note onset/end exceeds the authorized creative scope.'});
  if(!allowed.has(n.pitch%12)){
   const issue={code:'out_of_scale_pitch',noteIndex:i,
    detail:'Pitch class is outside the explicit requested scale. This does not imply the note is aesthetically wrong.'};
   if(spec.allowChromatic)warnings.push({...issue,severity:'warning'});
   else errors.push({...issue,severity:'error'});
  }
  // Offbeat onset measured as a fraction of a quarter-note, not an
  // inferred rhythm/style label. Exclude beat-onsets and 16th decorations.
  const phase=n.startTick%spec.ppq;
  const frac=phase/spec.ppq;
  if(frac>=0.33&&frac<=0.83)observations.push(phase);
 }
 const expected=spec.ppq*(spec.groove==='straight'?0.5:2/3);
 const tolerance=Math.max(12,Math.round(spec.ppq*0.085));
 const matched=observations.filter(t=>Math.abs(t-expected)<=tolerance);
 const sampleCount=observations.length;
 const timingMean=sampleCount?observations.reduce((a,b)=>a+b,0)/sampleCount:null;
 const grooveEvidence={
  status:sampleCount===0?'insufficient_evidence':
   matched.length===sampleCount?'matches_requested_eighth_offbeat_target':'timing_deviates',
  observedOffbeats:sampleCount,matchedOffbeats:matched.length,
  meanOffbeatPhaseTicks:timingMean===null?null:Math.round(timingMean*10)/10,
  targetOffbeatPhaseTicks:Math.round(expected*10)/10,
  toleranceTicks:tolerance,
  note:'Timing check only. Swing/shuffle feel requires additional accent and phrase evidence; rests and sparse quarter-note passages cannot be classified.'
 };
 if(sampleCount===0)warnings.push({code:'groove_not_observable',severity:'warning',
  detail:'No qualifying eighth-note offbeats; the requested groove cannot be verified from this clip.'});
 else if(matched.length!==sampleCount)warnings.push({code:'groove_timing_deviation',severity:'warning',
  detail:'Some offbeats differ from the user-requested timing target; assess musical intent before changing them.'});
 if(spec.groove==='shuffle')warnings.push({code:'shuffle_requires_phrase_evidence',severity:'warning',
  detail:'Shuffle requires recurring long-short subdivision and accents; triplet offbeat timing alone is insufficient.'});
 return {passed:errors.length===0,diagnostics:[...errors,...warnings],
  modeEvidence:{checkedNotes:notes.length,scaleCompliant:!errors.some(e=>e.code==='out_of_scale_pitch'),
   status:'candidate_pitch_class_check_only'},
  grooveEvidence,constraints:explainSpec(spec)};
}
