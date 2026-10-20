import {applyChangeSet} from '../commands/apply.js';
import type {ApplyResult,ChangeSet,MusicProject} from '../model/types.js';
export interface EditSession {readonly project:MusicProject;readonly past:readonly MusicProject[];readonly future:readonly MusicProject[];}
export function createSession(project:MusicProject):EditSession {return {project,past:[],future:[]};}
export function commitSession(session:EditSession,changeSet:ChangeSet):{readonly ok:true;readonly session:EditSession}|{readonly ok:false;readonly reason:string}{
 const result:ApplyResult=applyChangeSet(session.project,changeSet);
 if(!result.ok)return result;
 return {ok:true,session:{project:result.project,past:[...session.past,session.project],future:[]}};
}
export function undoSession(session:EditSession):EditSession{
 const previous=session.past.at(-1);if(!previous)return session;
 return {project:{...previous,revision:session.project.revision+1},past:session.past.slice(0,-1),future:[...session.future,session.project]};
}
export function redoSession(session:EditSession):EditSession{
 const next=session.future.at(-1);if(!next)return session;
 return {project:{...next,revision:session.project.revision+1},past:[...session.past,session.project],future:session.future.slice(0,-1)};
}
