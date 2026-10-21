import {describe,it,expect} from 'vitest';
import {composeMelody} from './melody.js';
import {applyChangeSet} from '@ai-composer/music-core';
import type {MusicProject} from '@ai-composer/music-core';
const project:MusicProject={projectId:'test',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]};
describe('candidate generator',()=>{
 it('generates deterministic valid MIDI notes',()=>{const x=composeMelody({project,trackId:'melody',bars:4,startBar:0,style:'motif',seed:19501});const y=composeMelody({project,trackId:'melody',bars:4,startBar:0,style:'motif',seed:19501});expect(x.notes).toEqual(y.notes);expect(x.notes).toHaveLength(32);expect(applyChangeSet(project,x.changes).ok).toBe(true);});
 it('refuses replacing locked notes',()=>{const locked={...project,tracks:[{...project.tracks[0]!,notes:[{noteId:'locked',pitch:60,startTick:0,durationTicks:480,velocity:90,locked:true}]}]};expect(()=>composeMelody({project:locked,trackId:'melody',bars:1,startBar:0,style:'steps',seed:1})).toThrow('locked_note_in_range');});
 it('does not cross selected range',()=>{const x=composeMelody({project,trackId:'melody',bars:1,startBar:2,style:'steps',seed:5});expect(x.notes[0]?.startTick).toBe(3840);expect(x.notes.at(-1)!.startTick+x.notes.at(-1)!.durationTicks).toBe(5760);});
});
