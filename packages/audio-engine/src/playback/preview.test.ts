import {afterEach,describe,expect,it,vi} from 'vitest';
import type {MusicProject} from '@ai-composer/music-core';
import {playProject} from './preview.js';

class FakeParam{
 value=0;events:{method:string;value:number;time:number}[]=[];
 setValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'set',value,time});return this;}
 linearRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'linear',value,time});return this;}
 exponentialRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'exponential',value,time});return this;}
}
class FakeNode{connect(_other:unknown){return _other;}}
class FakeGain extends FakeNode{gain=new FakeParam();}
class FakeFilter extends FakeNode{type='';frequency=new FakeParam();Q=new FakeParam();}
class FakePan extends FakeNode{pan=new FakeParam();}
class FakeSource extends FakeNode{
 type='';frequency=new FakeParam();
 startTimes:number[]=[];stopTimes:number[]=[];
 buffer:unknown=null;
 start(time:number){this.startTimes.push(time);}
 stop(time=0){this.stopTimes.push(time);}
}
class FakeCtx{
 currentTime=1;sampleRate=1000;destination=new FakeNode();closed=false;
 sources:FakeSource[]=[];filters:FakeFilter[]=[];
 async resume(){return;}
 async close(){this.closed=true;}
 createGain(){return new FakeGain();}
 createBiquadFilter(){const f=new FakeFilter();this.filters.push(f);return f;}
 createStereoPanner(){return new FakePan();}
 createOscillator(){const s=new FakeSource();this.sources.push(s);return s;}
 createBufferSource(){const s=new FakeSource();this.sources.push(s);return s;}
 createBuffer(_channels:number,length:number){const data=new Float32Array(length);return {
  getChannelData(_channel:number){return data;}
 };}
}
afterEach(()=>vi.unstubAllGlobals());

describe('S3 actual WebAudio graph scheduling',()=>{
 it('schedules mixed synth and drum voices and stops their resources',async()=>{
  const instances:FakeCtx[]=[];
  vi.stubGlobal('AudioContext',class extends FakeCtx{constructor(){super();instances.push(this);}});
  const project:MusicProject={
   projectId:'audio',revision:0,ppq:480,tempoMap:[{tick:0,bpm:120},{tick:960,bpm:60}],
   tracks:[
    {trackId:'bass',name:'Synth Bass',locked:false,
     instrument:{kind:'melodic',program:38,channel:0},
     notes:[{noteId:'a',pitch:36,startTick:0,durationTicks:240,velocity:100},
      {noteId:'b',pitch:40,startTick:960,durationTicks:480,velocity:92}]},
    {trackId:'drums',name:'Drums',locked:false,
     instrument:{kind:'drums',program:0,channel:9},
     notes:[{noteId:'kick',pitch:36,startTick:0,durationTicks:120,velocity:100},
      {noteId:'snare',pitch:38,startTick:480,durationTicks:120,velocity:96}]}
   ]
  };
  const handle=await playProject(project);
  const ctx=instances[0]!;
  const bass=ctx.sources.filter(s=>s.type==='sawtooth');
  const kick=ctx.sources.find(s=>s.type==='sine');
  const noise=ctx.sources.find(s=>s.buffer!==null);
  expect(bass).toHaveLength(2);
  expect(bass[0]!.startTimes).toEqual([1.06]);
  // 960 ticks @120 BPM = 1 second; the second note respects tempo-map time.
  expect(bass[1]!.startTimes).toEqual([2.06]);
  expect(kick?.frequency.events.some(x=>x.method==='exponential'&&x.value===48)).toBe(true);
  expect(noise?.startTimes[0]).toBeCloseTo(1.56);
  expect(ctx.filters).toHaveLength(3); // Two track filters + the snare noise filter.
  handle.stop();
  handle.stop();
  expect(ctx.closed).toBe(true);
  expect(ctx.sources.every(s=>s.stopTimes.length>=1)).toBe(true);
 });
});
