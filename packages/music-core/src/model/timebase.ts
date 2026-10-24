import type {MusicProject,Meter} from '../model/types.js';
export const LEGACY_TEMPO_BPM=120;
export const LEGACY_METER:Meter={numerator:4,denominator:4};
export function resolveTempoBpm(project:Pick<MusicProject,'tempoBpm'>):number{
 return project.tempoBpm??LEGACY_TEMPO_BPM;
}
export function resolveMeter(project:Pick<MusicProject,'meter'>):Meter{
 return project.meter??LEGACY_METER;
}
export function ticksPerBar(ppq:number,meter:Meter):number{
 const result=ppq*4*meter.numerator/meter.denominator;
 if(!Number.isSafeInteger(result)||result<1)throw new Error('unsupported_meter_ppq');
 return result;
}
export function tickToSeconds(tick:number,ppq:number,bpm:number):number{
 if(!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(ppq)||ppq<1||
 !Number.isFinite(bpm)||bpm<20||bpm>300)throw new Error('invalid_timebase');
 return tick*60/(ppq*bpm);
}