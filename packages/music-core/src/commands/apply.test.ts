import {describe,it,expect} from 'vitest';
import {applyChangeSet} from './apply.js';
import type {MusicProject} from '../model/types.js';
const base:MusicProject={projectId:'p',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]};
const note={noteId:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90};
describe('atomic note operations',()=>{
 it('creates an editable note',()=>{const r=applyChangeSet(base,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}]});expect(r.ok).toBe(true);if(r.ok){expect(r.project.tracks[0]?.notes[0]?.pitch).toBe(60);expect(base.tracks[0]?.notes).toHaveLength(0);}});
 it('rejects stale revision',()=>{expect(applyChangeSet(base,{baseRevision:1,operations:[{type:'add_note',trackId:'melody',note}]})).toMatchObject({ok:false,reason:'stale_revision'});});
 it('rejects invalid pitch without partial commit',()=>{const r=applyChangeSet(base,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note},{type:'add_note',trackId:'melody',note:{...note,noteId:'n2',pitch:140}}]});expect(r.ok).toBe(false);expect(base.tracks[0]?.notes).toHaveLength(0);});
 it('enforces track lock',()=>{const locked={...base,tracks:[{...base.tracks[0]!,locked:true}]};expect(applyChangeSet(locked,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}]})).toMatchObject({ok:false,reason:'track_locked'});});
});
