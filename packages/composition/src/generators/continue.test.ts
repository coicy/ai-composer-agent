import {describe,it,expect} from 'vitest';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
import {continueMelody} from './continue.js';
const original={noteId:'human-1',pitch:67,startTick:0,durationTicks:480,velocity:96,locked:true};
const project:MusicProject={projectId:'p',revision:3,ppq:480,tracks:[{trackId:'a',name:'Melody',locked:false,notes:[original]}]};
describe('continue melody',()=>{
 it('uses existing notes without changing them',()=>{const candidate=continueMelody({project,trackId:'a',bars:2,style:'motif',seed:19501});expect(candidate.notes).toHaveLength(16);expect(candidate.notes[0]?.startTick).toBe(1920);expect(candidate.changes.operations.every(o=>o.type==='add_note')).toBe(true);const result=applyChangeSet(project,candidate.changes);expect(result.ok).toBe(true);if(result.ok)expect(result.project.tracks[0]?.notes[0]).toEqual(original);});
 it('deterministic for seed and snapshot',()=>{const input={project,trackId:'a',bars:2,style:'steps' as const,seed:23};expect(continueMelody(input).notes).toEqual(continueMelody(input).notes);});
 it('rejects empty context and locked track',()=>{const empty={...project,tracks:[{...project.tracks[0]!,notes:[]}]};expect(()=>continueMelody({project:empty,trackId:'a',bars:1,style:'motif',seed:1})).toThrow('no_context_notes');const locked={...project,tracks:[{...project.tracks[0]!,locked:true}]};expect(()=>continueMelody({project:locked,trackId:'a',bars:1,style:'motif',seed:1})).toThrow('track_locked');});
 it('fails stale candidate after intervening edit',()=>{const candidate=continueMelody({project,trackId:'a',bars:1,style:'motif',seed:1});const changed={...project,revision:4};expect(applyChangeSet(changed,candidate.changes)).toMatchObject({ok:false,reason:'stale_revision'});});
});
