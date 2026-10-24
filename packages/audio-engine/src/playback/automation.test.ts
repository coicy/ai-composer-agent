import {describe,it,expect,vi} from 'vitest';
import {validatePlaybackAutomation,scheduleAutomation} from './automation.js';
import type {MusicProject} from '@ai-composer/music-core';
import type {PlaybackAutomation} from './automation.js';
const project:MusicProject={projectId:'test',revision:0,ppq:480,tracks:[{trackId:'bass',name:'Bass',locked:false,notes:[]}]};
const plan:PlaybackAutomation={version:'playback-automation-v1',curves:[{trackId:'bass',lane:'gain',points:[{tick:0,value:1},{tick:480,value:.7},{tick:960,value:1}]}]};
describe('playback automation',()=>{
 it('schedules exact linear ramps in project tick time',()=>{
  const gain={setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()};
  const filter={setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()};
  scheduleAutomation(plan,project,2,.001,new Map([['bass',{gain,filter}]]) as never);
  expect(gain.setValueAtTime).toHaveBeenCalledWith(1,2);
  expect(gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(1,.7,2.48);
  expect(gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(2,1,2.96);
  expect(filter.setValueAtTime).not.toHaveBeenCalled();
 });
 it('rejects unknown tracks and unsafe gain/filter values',()=>{
  expect(()=>validatePlaybackAutomation(project,{...plan,curves:[{...plan.curves[0]!,trackId:'missing'}]})).toThrow();
  expect(()=>validatePlaybackAutomation(project,{...plan,curves:[{...plan.curves[0]!,points:[{tick:0,value:1},{tick:10,value:2}]}]})).toThrow();
  expect(()=>validatePlaybackAutomation(project,{...plan,curves:[{...plan.curves[0]!,points:[{tick:10,value:1},{tick:10,value:.5}]}]})).toThrow();
 });
 it('does not mutate project or plan',()=>{
  const before=JSON.stringify({project,plan});
  validatePlaybackAutomation(project,plan);
  expect(JSON.stringify({project,plan})).toBe(before);
 });
});
