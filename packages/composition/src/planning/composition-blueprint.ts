import type {ElectronicGenre} from './weighted-techniques.js';
export type SectionKind='opening'|'theme'|'development'|'return'|'outro';
export type EnergyAction='establish'|'expand'|'contrast'|'reprise'|'release';
export interface CompositionSection {
 readonly id:string;
 readonly kind:SectionKind;
 readonly startTick:number;
 readonly endTick:number;
 readonly energy:number;
 readonly motifId:string;
 readonly action:EnergyAction;
 readonly guidance:string;
 readonly changeDimension:'rhythm'|'register'|'density'|'texture'|'none';
}
export interface CompositionBlueprint{
 readonly version:'composition-blueprint-v1';
 readonly seed:number;
 readonly originalStyle:ElectronicGenre|'general';
 readonly ppq:number;
 readonly meter:{readonly numerator:number;readonly denominator:number};
 readonly songStartTick:number;
 readonly totalBars:number;
 readonly mainMotifId:string;
 readonly sections:readonly CompositionSection[];
 readonly limitations:readonly string[];
}
export interface BlueprintRequest {
 readonly seed:number;
 readonly style?:ElectronicGenre|'general';
 readonly ppq:number;
 readonly meter:{readonly numerator:number;readonly denominator:number};
 readonly songStartTick?:number;
 readonly totalBars?:8|12|16|24|32;
 readonly mainMotifId?:string;
}
const validStyles=new Set<string>(['general','house','techno','trance','synthwave','drum_and_bass','chiptune','ambient']);
const VALID_BARS=new Set([8,12,16,24,32]);
const safeInt=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n);
function validateParams(input:BlueprintRequest){
 if(!input||!safeInt(input.seed)||input.seed<0||input.seed>0xffffffff)throw Error('invalid_blueprint_seed');
 if(input.style!==undefined&&!validStyles.has(input.style))throw Error('invalid_blueprint_style');
 if(!safeInt(input.ppq)||input.ppq<24||input.ppq>9600)throw Error('invalid_blueprint_ppq');
 const {numerator,denominator}=input.meter??{};
 if(!safeInt(numerator)||numerator<1||numerator>32||
  !safeInt(denominator)||![1,2,4,8,16,32].includes(denominator)||!safeInt(input.ppq*numerator*4/denominator))
  throw Error('invalid_blueprint_meter');
 if(!safeInt(input.songStartTick??0)||(input.songStartTick??0)<0)throw Error('invalid_blueprint_scope');
 if(!VALID_BARS.has(input.totalBars??16))throw Error('invalid_blueprint_bars');
 if(input.mainMotifId!==undefined&&(!/^[a-z][a-z0-9_-]{0,39}$/.test(input.mainMotifId)))throw Error('invalid_blueprint_motif');
}
function energy(style:CompositionBlueprint['originalStyle'],kind:SectionKind):number{
 const general={opening:28,theme:62,development:82,return:72,outro:24};
 if(style==='ambient')return ({opening:16,theme:36,development:52,return:40,outro:20})[kind];
 if(style==='techno')return ({opening:38,theme:67,development:81,return:69,outro:29})[kind];
 if(style==='trance')return ({opening:22,theme:65,development:89,return:84,outro:32})[kind];
 return general[kind];
}
function hash(seed:number,key:string):number{
 let n=(2166136261^seed)>>>0;
 for(let i=0;i<key.length;i++)n=Math.imul(n^key.charCodeAt(i),16777619)>>>0;
 return n;
}
const TRANSFORMS=['rhythm','register','density','texture'] as const;
function sectionsFor(bars:number):readonly SectionKind[]{
 if(bars===8)return ['opening','theme','development','return'];
 if(bars===12)return ['opening','theme','development','return'];
 if(bars===16)return ['opening','theme','development','return'];
 if(bars===24)return ['opening','theme','development','development','return','outro'];
 return ['opening','theme','theme','development','development','return','return','outro'];
}
const ACTIONS:Record<SectionKind,EnergyAction>={opening:'establish',theme:'expand',development:'contrast',return:'reprise',outro:'release'};
const GUIDANCE:Record<SectionKind,string>={
 opening:'Introduce a recognizable motif fragment with clear rhythmic identity; reserve space for later layers.',
 theme:'State the primary motif clearly; keep a musically identifiable contour from the opening.',
 development:'Vary ONE property of the recognized motif and rebalance density, without abandoning harmony or pulse.',
 return:'Reprise the recognizable theme after contrast; preserve its interval/rhythm identity while adjusting orchestration.',
 outro:'Release energy by subtracting layers or slowing harmonic rhythm; do not replace the entire motif with unrelated notes.'
};
export function createCompositionBlueprint(request:BlueprintRequest):CompositionBlueprint{
 validateParams(request);
 const bars=request.totalBars??16,style=request.style??'general';
 const kinds=sectionsFor(bars);
 const barTicks=request.ppq*4*request.meter.numerator/request.meter.denominator;
 const origin=request.songStartTick??0;
 const motif=request.mainMotifId??'primary-motif';
 const sectionBars=bars/kinds.length;
 if(!safeInt(sectionBars))throw Error('invalid_blueprint_bars');
 const sections=kinds.map((kind,index):CompositionSection=>{
  const startTick=origin+index*sectionBars*barTicks;
  const endTick=startTick+sectionBars*barTicks;
  const changeDimension=kind==='development'?
   TRANSFORMS[hash(request.seed,'development/'+index)%TRANSFORMS.length]!:
   kind==='return'?'texture':'none';
  return {
   id:'section-'+index,kind,startTick,endTick,energy:energy(style,kind),
   motifId:motif,action:ACTIONS[kind],guidance:GUIDANCE[kind],changeDimension
  };
 });
 return {version:'composition-blueprint-v1',seed:request.seed,originalStyle:style,
  ppq:request.ppq,meter:{...request.meter},songStartTick:origin,totalBars:bars,
  mainMotifId:motif,sections,
  limitations:[
   'The blueprint describes composition/form, NOT actual editable MIDI events.',
   'No section or motif is user-approved merely because it was proposed by an Agent.',
   'Perform creation in authorized short windows; preserve previous and neighboring motif context.',
   'Only the external general-purpose LLM composes the music; hard constraints remain authoritative.'
  ]};
}
export function validateCompositionBlueprint(value:unknown):CompositionBlueprint{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_composition_blueprint');
 const p=value as CompositionBlueprint;
 validateParams({seed:p.seed,style:p.originalStyle,ppq:p.ppq,meter:p.meter,
  songStartTick:p.songStartTick,totalBars:p.totalBars as 8|12|16|24|32,mainMotifId:p.mainMotifId});
 if(p.version!=='composition-blueprint-v1'||!Array.isArray(p.sections)||p.sections.length!==sectionsFor(p.totalBars).length)
  throw Error('invalid_composition_blueprint');
 const expected=createCompositionBlueprint({seed:p.seed,style:p.originalStyle,ppq:p.ppq,meter:p.meter,
  songStartTick:p.songStartTick,totalBars:p.totalBars as 8|12|16|24|32,mainMotifId:p.mainMotifId});
 // This first version accepts strictly deterministic auto-plans, not an arbitrary
 // user-supplied list of model-invented permissions/sections.
 if(JSON.stringify(p.sections)!==JSON.stringify(expected.sections))
  throw Error('blueprint_section_mismatch');
 return expected;
}
export function blueprintWindow(blueprint:CompositionBlueprint,startTick:number,endTick:number){
 if(!safeInt(startTick)||!safeInt(endTick)||endTick<=startTick||startTick<blueprint.songStartTick||
  endTick>blueprint.sections.at(-1)!.endTick)throw Error('blueprint_window_out_of_scope');
 const sections=blueprint.sections.filter(s=>s.startTick<endTick&&s.endTick>startTick)
  .map(s=>({...s,activeStartTick:Math.max(startTick,s.startTick),activeEndTick:Math.min(endTick,s.endTick)}));
 return {version:blueprint.version,style:blueprint.originalStyle,motifId:blueprint.mainMotifId,
  songBars:blueprint.totalBars,window:{startTick,endTick},sections,
  requirement:'Continue the same motif across adjacent windows; vary only the declared section dimension and respect MusicProject locks/harmony.'};
}
