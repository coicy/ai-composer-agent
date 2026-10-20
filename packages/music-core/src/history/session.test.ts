import {describe,it,expect} from 'vitest';
import {createSession,commitSession,undoSession,redoSession} from './session.js';
import type {MusicProject} from '../model/types.js';
const project:MusicProject={projectId:'demo',revision:0,ppq:480,tracks:[{trackId:'melody',name:'Melody',locked:false,notes:[]}]};
const note={noteId:'n1',pitch:60,startTick:0,durationTicks:480,velocity:90};
describe('edit history',()=>{
 it('undoes and redoes without rolling revision backwards',()=>{
  const added=commitSession(createSession(project),{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note}]});
  expect(added.ok).toBe(true);if(!added.ok)return;
  const undone=undoSession(added.session);expect(undone.project.tracks[0]?.notes).toHaveLength(0);expect(undone.project.revision).toBe(2);
  const redone=redoSession(undone);expect(redone.project.tracks[0]?.notes[0]?.noteId).toBe('n1');expect(redone.project.revision).toBe(3);
 });
 it('rejects locked note mutation',()=>{
  const lockedProject={...project,tracks:[{...project.tracks[0]!,notes:[{...note,locked:true}]}]};
  const result=commitSession(createSession(lockedProject),{baseRevision:0,operations:[{type:'delete_note',trackId:'melody',noteId:'n1'}]});
  expect(result).toMatchObject({ok:false,reason:'note_locked'});
 });
 it('invalid edit does not change session',()=>{
  const session=createSession(project);
  const result=commitSession(session,{baseRevision:0,operations:[{type:'add_note',trackId:'melody',note:{...note,pitch:128}}]});
  expect(result.ok).toBe(false);expect(session.past).toHaveLength(0);
 });
});
