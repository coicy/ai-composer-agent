import type {MusicProject,MusicTrack} from '@ai-composer/music-core';
export type SoundPresetId='basic_triangle'|'synth_bass'|'synth_pluck'|'synth_pad'|'saw_lead'|'drum_kit';
export interface PresetSpec {
 readonly id:SoundPresetId;readonly kind:'melodic'|'drums';
 readonly wave:OscillatorType|null;
 readonly attackSeconds:number;readonly decaySeconds:number;
 readonly sustain:number;readonly releaseSeconds:number;
 readonly cutoffHz:number;readonly gain:number;
}
export const SOUND_PRESETS:Readonly<Record<SoundPresetId,PresetSpec>>={
 basic_triangle:{id:'basic_triangle',kind:'melodic',wave:'triangle',attackSeconds:.008,decaySeconds:.05,sustain:.85,releaseSeconds:.02,cutoffHz:14000,gain:.12},
 synth_bass:{id:'synth_bass',kind:'melodic',wave:'sawtooth',attackSeconds:.006,decaySeconds:.13,sustain:.65,releaseSeconds:.09,cutoffHz:820,gain:.12},
 synth_pluck:{id:'synth_pluck',kind:'melodic',wave:'sawtooth',attackSeconds:.004,decaySeconds:.09,sustain:.1,releaseSeconds:.08,cutoffHz:2200,gain:.09},
 synth_pad:{id:'synth_pad',kind:'melodic',wave:'sawtooth',attackSeconds:.17,decaySeconds:.25,sustain:.62,releaseSeconds:.45,cutoffHz:1650,gain:.065},
 saw_lead:{id:'saw_lead',kind:'melodic',wave:'sawtooth',attackSeconds:.008,decaySeconds:.12,sustain:.73,releaseSeconds:.14,cutoffHz:3600,gain:.1},
 drum_kit:{id:'drum_kit',kind:'drums',wave:null,attackSeconds:.002,decaySeconds:.08,sustain:0,releaseSeconds:.13,cutoffHz:10000,gain:.18}
};
export interface TrackSoundPreset {
 readonly trackId:string;
 readonly presetId:SoundPresetId;
 readonly gainDb?:number;
 readonly pan?:number;
 readonly cutoffHz?:number;
}
export interface SoundDesignPlan {
 readonly version:'sound-design-v1';
 readonly trackPresets:readonly TrackSoundPreset[];
}
const validKey=new Set(Object.keys(SOUND_PRESETS));
const isFiniteNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function validateSoundDesignPlan(value:unknown,project:Pick<MusicProject,'tracks'>):SoundDesignPlan{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_sound_plan');
 const p=value as Record<string,unknown>;
 if(p.version!=='sound-design-v1'||Object.keys(p).some(k=>!['version','trackPresets'].includes(k))||
  !Array.isArray(p.trackPresets)||p.trackPresets.length>128)throw Error('invalid_sound_plan');
 const ids=new Set(project.tracks.map(t=>t.trackId)),seen=new Set<string>();
 const items:TrackSoundPreset[]=[];
 for(const raw of p.trackPresets as unknown[]){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_sound_preset');
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['trackId','presetId','gainDb','pan','cutoffHz'].includes(k))||
   typeof r.trackId!=='string'||!ids.has(r.trackId)||seen.has(r.trackId)||
   typeof r.presetId!=='string'||!validKey.has(r.presetId)||
   (r.gainDb!==undefined&&(!isFiniteNumber(r.gainDb)||r.gainDb< -48||r.gainDb>6))||
   (r.pan!==undefined&&(!isFiniteNumber(r.pan)||r.pan< -1||r.pan>1))||
   (r.cutoffHz!==undefined&&(!isFiniteNumber(r.cutoffHz)||r.cutoffHz<40||r.cutoffHz>16000)))
   throw Error('invalid_sound_preset');
  const track=project.tracks.find(t=>t.trackId===r.trackId)!;
  if(track.instrument?.kind==='drums'&&r.presetId!=='drum_kit'||
   track.instrument?.kind==='melodic'&&r.presetId==='drum_kit')throw Error('sound_preset_track_type_conflict');
  seen.add(r.trackId);
  items.push({trackId:r.trackId,presetId:r.presetId as SoundPresetId,
   ...(r.gainDb!==undefined?{gainDb:r.gainDb as number}:{}),
   ...(r.pan!==undefined?{pan:r.pan as number}:{}),
   ...(r.cutoffHz!==undefined?{cutoffHz:r.cutoffHz as number}:{})});
 }
 return {version:'sound-design-v1',trackPresets:items};
}
export function defaultPresetForTrack(track:MusicTrack):SoundPresetId{
 if(track.instrument?.kind==='drums')return 'drum_kit';
 const p=track.instrument?.program;
 if(p===38||p===39)return 'synth_bass';
 if(p!==undefined&&p>=80&&p<=87)return 'saw_lead';
 if(p!==undefined&&p>=88&&p<=95)return 'synth_pad';
 if(p!==undefined&&p>=24&&p<=31)return 'synth_pluck';
 return 'basic_triangle';
}
export function chooseTrackPreset(track:MusicTrack,plan?:SoundDesignPlan):TrackSoundPreset{
 const configured=plan?.trackPresets.find(x=>x.trackId===track.trackId);
 return configured??{trackId:track.trackId,presetId:defaultPresetForTrack(track)};
}
/** Non-persistent suggestions for audition only. Never edits the source project. */
export function suggestArrangementSoundPlan(project:MusicProject,ids:{
 readonly harmony:string;readonly bass:string;readonly accompaniment:string
}):SoundDesignPlan{
 for(const id of Object.values(ids))if(!project.tracks.some(t=>t.trackId===id))throw Error('track_not_found');
 const plan:SoundDesignPlan={version:'sound-design-v1',trackPresets:[
  {trackId:ids.harmony,presetId:'synth_pad',gainDb:-2},
  {trackId:ids.bass,presetId:'synth_bass',gainDb:-1},
  {trackId:ids.accompaniment,presetId:'synth_pluck',gainDb:-2}
 ]};
 return validateSoundDesignPlan(plan,project);
}
