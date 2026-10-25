import {describe,it,expect} from 'vitest';
import {assessMotifRealization} from './motif-realization.js';
import type {MotifIdentity,DevelopmentWindow} from '../planning/motif-development.js';
const motif:MotifIdentity={id:'A',sourceTrackId:'lead',noteIds:['a','b','c'],anchorIntervals:[2,-1],rhythmRatios:[1,1,1]};
const window:DevelopmentWindow={startTick:0,endTick:1920,motifId:'A',operation:'thematic_return',targetRole:'lead',preserve:'interval_contour',instruction:'Return the theme'};
const track=(pitches:number[])=>[{trackId:'test',name:'test',locked:false,notes:pitches.map((pitch,i)=>({noteId:String(i),pitch,startTick:i*480,durationTicks:240,velocity:80}))}];
describe('conservative motif evidence',()=>{
 it('observes a matching contour',()=>expect(assessMotifRealization(motif,window,track([67,69,68])).state).toBe('observed'));
 it('rejects unmatched contour',()=>expect(assessMotifRealization(motif,window,track([67,65,68])).state).toBe('not_observed'));
 it('refuses to certify musical harmony from contour alone',()=>expect(assessMotifRealization(motif,{...window,operation:'harmonic_recontextualization'},track([67,69,68])).state).toBe('not_evaluable'));
});
