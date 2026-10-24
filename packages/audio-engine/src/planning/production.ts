import type {MusicProject,MusicTrack} from '@ai-composer/music-core';
export type PresetId='legacy_triangle'|'synth_bass'|'synth_pluck'|'synth_pad'|'synth_lead'|'drum_machine';
export interface TrackSound{
 readonly trackId:string;readonly presetId:PresetId;
 readonly gainDb:number;readonly cutoffHz:number;readonly attackMs:number;readonly releaseMs:number;
}
export interface ProductionPlan{
 readonly version:'basic-production-v1';
 readonly tracks:readonly TrackSound[];
 readonly warnings:readonly string[];
}
export const PRESETS:Readonly<Record<PresetId,Omit<TrackSound,'trackId'>>> ={
 legacy_triangle:{presetId:'legacy_triangle',gainDb:-13,cutoffHz:16000,attackMs:8,releaseMs:20},
 synth_bass:{presetId:'synth_bass',gainDb:-15,cutoffHz:820,attackMs:5,releaseMs:100},
 synth_pluck:{presetId:'synth_pluck',gainDb:-17,cutoffHz:2300,attackMs:3,releaseMs:90},
 synth_pad:{presetId:'synth_pad',gainDb:-20,cutoffHz:1400,attackMs:160,releaseMs:320},
 synth_lead:{presetId:'synth_lead',gainDb:-18,cutoffHz:2800,attackMs:14,releaseMs:100},
 drum_machine:{presetId:'drum_machine',gainDb:-13,cutoffHz:12500,attackMs:3,releaseMs:65}
};
export function inferPreset(track:MusicTrack):PresetId{
 if(track.isDrum===true||track.channel===9)return 'drum_machine';
 const program=track.program;
 if(program===undefined)return 'legacy_triangle'; // Preserve old projects' preview.
 if(program>=38&&program<=39)return 'synth_bass';
 if(program>=88&&program<=95)return 'synth_pad';
 if(program>=80&&program<=81)return 'synth_pluck';
 if(program>=82&&program<=87)return 'synth_lead';
 return 'legacy_triangle';
}
const inRange=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateProductionPlan(project:MusicProject,plan:ProductionPlan):void{
 if(!plan||plan.version!=='basic-production-v1'||!Array.isArray(plan.tracks)||
  plan.tracks.length!==project.tracks.length)throw Error('invalid_production_plan');
 const trackIds=new Set(project.tracks.map(t=>t.trackId)),seen=new Set<string>();
 for(const t of plan.tracks){
  if(!t||typeof t.trackId!=='string'||!trackIds.has(t.trackId)||seen.has(t.trackId)||
   !Object.hasOwn(PRESETS,t.presetId)||!inRange(t.gainDb,-40,6)||
   !inRange(t.cutoffHz,30,18000)||!inRange(t.attackMs,0,1000)||
   !inRange(t.releaseMs,1,2000))throw Error('invalid_production_plan');
  seen.add(t.trackId);
 }
}
export function createProductionPlan(project:MusicProject):ProductionPlan{
 const plan:ProductionPlan={
  version:'basic-production-v1',
  tracks:project.tracks.map(track=>({...PRESETS[inferPreset(track)],trackId:track.trackId})),
  warnings:[
   'Lightweight built-in preview only; not a professional DAW mix or an emulation of commercial synth presets.',
   'Procedural drums are locally synthesized without distributing third-party sample packs.',
   'A GM program mapping is not a verified genre or instrument-performance classification.'
  ]
 };
 validateProductionPlan(project,plan);
 return plan;
}