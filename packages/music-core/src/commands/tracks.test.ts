import {describe,it,expect} from 'vitest';
import {applyChangeSet} from './apply.js';
import type {MusicProject} from '../model/types.js';
const project:MusicProject={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'a',name:'A',locked:false,notes:[]}]};
describe('track operations',()=>{
 it('adds tracks atomically',()=>{const r=applyChangeSet(project,{baseRevision:0,operations:[{type:'add_track',track:{trackId:'b',name:'B',locked:false,notes:[]}}]});expect(r.ok).toBe(true);if(r.ok)expect(r.project.tracks).toHaveLength(2);});
 it('rejects duplicate track IDs',()=>{const r=applyChangeSet(project,{baseRevision:0,operations:[{type:'add_track',track:{trackId:'a',name:'dup',locked:false,notes:[]}}]});expect(r).toMatchObject({ok:false,reason:'invalid_or_duplicate_track'});expect(project.tracks).toHaveLength(1);});
});