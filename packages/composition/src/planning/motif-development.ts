import type {MidiNote} from '@ai-composer/music-core';

/** Original-music planning instructions; never write source-reference notes to an output. */
export type DevelopmentOperation =
 'introduce'|'sequence'|'rhythmic_augmentation'|'rhythmic_diminution'|
 'fragmentation'|'register_transfer'|'call_response'|
 'harmonic_recontextualization'|'texture_subtraction'|'thematic_return';
export interface MotifIdentity {
 readonly id:string;
 readonly sourceTrackId:string;
 readonly noteIds:readonly string[];
 readonly anchorIntervals:readonly number[];
 readonly rhythmRatios:readonly number[];
}
export interface DevelopmentWindow {
 readonly startTick:number;readonly endTick:number;
 readonly motifId:string;readonly operation:DevelopmentOperation;
 readonly targetRole:'lead'|'answer'|'harmony'|'texture';
 readonly preserve:'interval_contour'|'rhythm_shape'|'motif_fragment';
 readonly instruction:string;
}
export interface MotifDevelopmentPlan {
 readonly version:'motif-development-v1';
 readonly ppq:number;
 readonly startTick:number;readonly endTick:number;
 readonly motifs:readonly MotifIdentity[];
 readonly windows:readonly DevelopmentWindow[];
 readonly musicalGoal:string;
 readonly cautions:readonly string[];
}
const ops:readonly DevelopmentOperation[]=[
 'introduce','sequence','rhythmic_augmentation','rhythmic_diminution',
 'fragmentation','register_transfer','call_response',
 'harmonic_recontextualization','texture_subtraction','thematic_return'
];
const integer=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x);
export function extractMotifIdentity(id:string,sourceTrackId:string,notes:readonly MidiNote[]):MotifIdentity{
 if(!id||!sourceTrackId||notes.length<3||notes.length>16||
  notes.some(n=>!integer(n.pitch)||!integer(n.startTick)||!integer(n.durationTicks)||n.durationTicks<=0))
  throw Error('invalid_motif_source');
 const sorted=[...notes].sort((a,b)=>a.startTick-b.startTick||a.pitch-b.pitch);
 if(new Set(sorted.map(n=>n.noteId)).size!==sorted.length)throw Error('duplicate_motif_note');
 const base=sorted[0]!.durationTicks;
 return {
  id,sourceTrackId,noteIds:sorted.map(n=>n.noteId),
  anchorIntervals:sorted.slice(1).map((n,i)=>n.pitch-sorted[i]!.pitch),
  rhythmRatios:sorted.map(n=>Number((n.durationTicks/base).toFixed(4)))
 };
}
export function validateMotifDevelopmentPlan(plan:MotifDevelopmentPlan):void{
 if(!plan||plan.version!=='motif-development-v1'||!integer(plan.ppq)||plan.ppq<24||plan.ppq>9600||
  !integer(plan.startTick)||!integer(plan.endTick)||plan.startTick<0||plan.endTick<=plan.startTick||
  typeof plan.musicalGoal!=='string'||!plan.musicalGoal.trim()||plan.musicalGoal.length>1000||
  !Array.isArray(plan.motifs)||plan.motifs.length<1||plan.motifs.length>8||
  !Array.isArray(plan.windows)||plan.windows.length<2||plan.windows.length>64||
  !Array.isArray(plan.cautions)||plan.cautions.some(x=>typeof x!=='string'))
  throw Error('invalid_development_plan');
 const ids=new Set<string>();
 for(const m of plan.motifs){
  if(!m||typeof m.id!=='string'||!m.id||ids.has(m.id)||typeof m.sourceTrackId!=='string'||!m.sourceTrackId||
   !Array.isArray(m.noteIds)||m.noteIds.length<3||m.noteIds.length>16||
   new Set(m.noteIds).size!==m.noteIds.length||
   m.noteIds.some((x:unknown)=>typeof x!=='string'||!x)||
   !Array.isArray(m.anchorIntervals)||m.anchorIntervals.length!==m.noteIds.length-1||
   m.anchorIntervals.some((x:unknown)=>!integer(x)||Math.abs(x)>127)||
   !Array.isArray(m.rhythmRatios)||m.rhythmRatios.length!==m.noteIds.length||
   m.rhythmRatios.some((x:unknown)=>typeof x!=='number'||!Number.isFinite(x)||x<=0||x>64))throw Error('invalid_motif_identity');
  ids.add(m.id);
 }
 let previousEnd=plan.startTick;
 for(const w of plan.windows){
  if(!w||!integer(w.startTick)||!integer(w.endTick)||w.startTick<previousEnd||
   w.endTick<=w.startTick||w.endTick>plan.endTick||!ids.has(w.motifId)||
   !ops.includes(w.operation)||!['lead','answer','harmony','texture'].includes(w.targetRole)||
   !['interval_contour','rhythm_shape','motif_fragment'].includes(w.preserve)||
   typeof w.instruction!=='string'||!w.instruction.trim()||w.instruction.length>1000)
   throw Error('invalid_development_window');
  previousEnd=w.endTick;
 }
 if(!plan.windows.some(w=>w.operation==='introduce')||
  !plan.windows.some(w=>w.operation==='thematic_return')||
  !plan.windows.some(w=>!['introduce','thematic_return'].includes(w.operation)))
  throw Error('development_requires_introduction_change_and_return');
}
/** Scene-specific plan with sparse but consequential changes, not a universal template. */
export function buildRuinsDevelopmentPlan(motif:MotifIdentity,ppq=480):MotifDevelopmentPlan{
 if(!integer(ppq)||ppq<24||ppq>9600)throw Error('invalid_ppq');
 const bar=ppq*4;
 const plan:MotifDevelopmentPlan={
  version:'motif-development-v1',ppq,startTick:0,endTick:24*bar,motifs:[motif],
  musicalGoal:'Mysterious ancient ruins exploration: coherent, restrained thematic development without continuous foreground activity.',
  windows:[
   {startTick:0,endTick:4*bar,motifId:motif.id,operation:'introduce',targetRole:'lead',preserve:'interval_contour',instruction:'State the compact source motif with large rests; let the drone establish the center.'},
   {startTick:4*bar,endTick:8*bar,motifId:motif.id,operation:'rhythmic_augmentation',targetRole:'lead',preserve:'interval_contour',instruction:'Stretch durations and alter phrase spacing while retaining the identifiable contour.'},
   {startTick:8*bar,endTick:12*bar,motifId:motif.id,operation:'fragmentation',targetRole:'answer',preserve:'motif_fragment',instruction:'Answer only part of the motif in a separated register; avoid filling all silence.'},
   {startTick:12*bar,endTick:16*bar,motifId:motif.id,operation:'harmonic_recontextualization',targetRole:'harmony',preserve:'rhythm_shape',instruction:'Place recognizable motif gestures over a changed, deliberately chosen harmonic color.'},
   {startTick:16*bar,endTick:20*bar,motifId:motif.id,operation:'register_transfer',targetRole:'lead',preserve:'interval_contour',instruction:'Transfer the contour to a different register and keep the original response space.'},
   {startTick:20*bar,endTick:24*bar,motifId:motif.id,operation:'thematic_return',targetRole:'lead',preserve:'interval_contour',instruction:'Reprise the original identity with lighter accompaniment and a stable entry to the opening.'}
  ],
  cautions:['Do not treat more notes or louder timbre as evidence of development.',
   'The caller must supply a real authorized motif; this plan itself generates no MIDI.',
   'Motif preservation and affective success require independent MIDI inspection and listening.']
 };
 validateMotifDevelopmentPlan(plan);
 return plan;
}
