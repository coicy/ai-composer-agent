import type {MusicProject,TempoPoint,MeterPoint} from '../model/types.js';

export const DEFAULT_BPM=120;
export const DEFAULT_METER=[4,4] as const;

export function validateTempoMap(map:unknown):map is readonly TempoPoint[]{
 if(!Array.isArray(map)||map.length===0||map.length>1024)return false;
 let last=-1;
 for(const p of map){
  if(!p||typeof p!=='object'||Array.isArray(p)||
   !Number.isSafeInteger(p.tick)||p.tick<0||p.tick<=last||
   typeof p.bpm!=='number'||!Number.isFinite(p.bpm)||p.bpm<10||p.bpm>600)return false;
  last=p.tick;
 }
 return map[0]?.tick===0;
}
export function validateMeterMap(map:unknown,ppq:number):map is readonly MeterPoint[]{
 if(!Array.isArray(map)||map.length===0||map.length>1024)return false;
 let last=-1;
 for(const p of map){
  if(!p||typeof p!=='object'||Array.isArray(p)||
   !Number.isSafeInteger(p.tick)||p.tick<0||p.tick<=last||
   !Number.isSafeInteger(p.numerator)||p.numerator<1||p.numerator>32||
   ![1,2,4,8,16,32].includes(p.denominator)||
   !Number.isSafeInteger(ppq*p.numerator*4/p.denominator))return false;
  last=p.tick;
 }
 return map[0]?.tick===0;
}
/** Treat absent metadata as legacy 120 BPM/4/4 without mutating the project. */
export function effectiveTempos(project:Pick<MusicProject,'tempoMap'>):readonly TempoPoint[]{
 return project.tempoMap??[{tick:0,bpm:DEFAULT_BPM}];
}
export function effectiveMeters(project:Pick<MusicProject,'meterMap'>):readonly MeterPoint[]{
 return project.meterMap??[{tick:0,numerator:4,denominator:4}];
}
export function tempoAtTick(project:Pick<MusicProject,'tempoMap'>,tick:number):number{
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('invalid_time_tick');
 let bpm=DEFAULT_BPM;
 for(const item of effectiveTempos(project)){if(item.tick>tick)break;bpm=item.bpm;}
 return bpm;
}
export function meterAtTick(project:Pick<MusicProject,'meterMap'>,tick:number):MeterPoint{
 if(!Number.isSafeInteger(tick)||tick<0)throw Error('invalid_time_tick');
 let meter:MeterPoint={tick:0,numerator:4,denominator:4};
 for(const item of effectiveMeters(project)){if(item.tick>tick)break;meter=item;}
 return meter;
}
/** Exact piecewise-constant tempo integration, expressed in seconds. */
export function secondsAtTick(project:Pick<MusicProject,'tempoMap'|'ppq'>,tick:number):number{
 if(!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(project.ppq)||project.ppq<=0)throw Error('invalid_time_tick');
 let cursor=0,seconds=0,bpm=DEFAULT_BPM;
 for(const item of effectiveTempos(project)){
  if(item.tick>=tick)break;
  if(item.tick>cursor){seconds+=(item.tick-cursor)*60/(project.ppq*bpm);cursor=item.tick;}
  bpm=item.bpm;
 }
 // Account for a tempo event at tick 0 or exactly the queried boundary.
 if(cursor===0){const first=effectiveTempos(project)[0];if(first&&first.tick===0)bpm=first.bpm;}
 return seconds+(tick-cursor)*60/(project.ppq*bpm);
}
export function barTicksAt(project:Pick<MusicProject,'meterMap'|'ppq'>,tick:number):number{
 const m=meterAtTick(project,tick);
 return project.ppq*4*m.numerator/m.denominator;
}
