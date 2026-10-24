import {resolveMeter,resolveTempoBpm,ticksPerBar} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {recommendElectronicTechniques} from './electronic-techniques.js';
import type {ElectronicStyle,TechniquePlan} from './electronic-techniques.js';

export type SongSectionKind='intro'|'groove'|'contrast'|'return';
export interface PlannedSongSection{
 readonly id:string;readonly kind:SongSectionKind;
 readonly startBar:number;readonly endBar:number;
 readonly startTick:number;readonly endTick:number;
 readonly energy:number;
 readonly motifId:'A'|'B';
 readonly motifAction:'introduce'|'repeat_and_develop'|'contrast'|'reprise';
 readonly techniquePlan:TechniquePlan;
 readonly instruction:string;
}
export interface CompositionBlueprint{
 readonly version:'electronic-composition-blueprint-v1';
 readonly style:ElectronicStyle;
 readonly baseSeed:number;
 readonly timebase:{startTick:number;ppq:number;barTicks:number;tempoBpm:number;meter:{numerator:number;denominator:number}};
 readonly barCount:number;
 readonly sections:readonly PlannedSongSection[];
 readonly warnings:readonly string[];
}
export interface BlueprintRequest{
 readonly project:MusicProject;
 readonly style:ElectronicStyle;
 readonly seed:number;
 readonly startTick?:number;
 readonly bars?:number;
}
const KINDS:readonly SongSectionKind[]=['intro','groove','contrast','return'];
const ENERGY:Readonly<Record<ElectronicStyle,readonly number[]>>={
 house:[38,68,43,82],synthwave:[30,60,51,78],techno:[48,68,56,80],
 trance:[30,64,45,88],drum_and_bass:[38,78,48,91],
 ambient:[22,40,35,44],chiptune:[42,70,52,83]
};
const DIRECTIONS:Readonly<Record<SongSectionKind,string>>={
 intro:'Present a compact identifiable motif and establish the rhythmic/harmonic identity without saturating all parts.',
 groove:'Develop motif A and its recognizable rhythmic relationships. Add movement coherently; do not discard existing theme.',
 contrast:'Contrast texture, density or register, or remove a layer; preserve musical transitions rather than random notes.',
 return:'Reprise motif A with one purposeful phrase variation or accent change and a coherent cadence/loop point.'
};
export function buildElectronicCompositionBlueprint(input:BlueprintRequest):CompositionBlueprint{
 const {project,style,seed}=input,met=resolveMeter(project);
 const barTicks=ticksPerBar(project.ppq,met),startTick=input.startTick??0,bars=input.bars??16;
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('invalid_blueprint_seed');
 if(!Number.isSafeInteger(startTick)||startTick<0||startTick%barTicks!==0)throw Error('invalid_blueprint_start');
 if(!Number.isSafeInteger(bars)||bars<8||bars>32||bars%4!==0)throw Error('invalid_blueprint_bars');
 if(!Object.hasOwn(ENERGY,style))throw Error('invalid_electronic_style');
 const segments=bars/4;
 const sections=KINDS.map((kind,index):PlannedSongSection=>{
  const from=index*segments,to=from+segments;
  return {
   id:'section-'+index,kind,startBar:from,endBar:to,
   startTick:startTick+from*barTicks,endTick:startTick+to*barTicks,
   energy:ENERGY[style][index]!,
   motifId:index===2?'B':'A',
   motifAction:(['introduce','repeat_and_develop','contrast','reprise'] as const)[index]!,
   techniquePlan:recommendElectronicTechniques({style,seed,variant:index}),
   instruction:DIRECTIONS[kind]
  };
 });
 return {
  version:'electronic-composition-blueprint-v1',style,baseSeed:seed,
  timebase:{startTick,ppq:project.ppq,barTicks,tempoBpm:resolveTempoBpm(project),meter:met},
  barCount:bars,sections,
  warnings:[
   'This is a SOFT structure proposal, not a user-authorized MIDI write, audio production or aesthetic quality guarantee.',
   'Only already authorized notes may be edited, and all hard user tempo, meter, harmony, lock and revision constraints prevail.',
   'Segment-specific technique gestures generate independent ideas; original leitmotif identity and selected style anchors should remain recognizable.'
  ]
 };
}
export function locateBlueprintSection(blueprint:CompositionBlueprint,startTick:number,endTick:number):PlannedSongSection{
 if(!Number.isSafeInteger(startTick)||!Number.isSafeInteger(endTick)||endTick<=startTick)throw Error('invalid_blueprint_scope');
 const section=blueprint.sections.find(s=>startTick>=s.startTick&&startTick<s.endTick);
 if(!section||endTick>section.endTick)throw Error('blueprint_window_crosses_section');
 return section;
}