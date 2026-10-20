export interface MidiNote { readonly noteId:string; readonly pitch:number; readonly startTick:number; readonly durationTicks:number; readonly velocity:number; readonly locked?:boolean; }
export interface MusicTrack {readonly trackId:string;readonly name:string;readonly locked:boolean;readonly notes:readonly MidiNote[];}
export interface MusicProject {readonly projectId:string;readonly revision:number;readonly ppq:number;readonly tracks:readonly MusicTrack[];}
export type NoteOperation =
 | {readonly type:'add_note';readonly trackId:string;readonly note:MidiNote}
 | {readonly type:'update_note';readonly trackId:string;readonly noteId:string;readonly changes:Partial<Pick<MidiNote,'pitch'|'startTick'|'durationTicks'|'velocity'>>}
 | {readonly type:'delete_note';readonly trackId:string;readonly noteId:string};
export interface ChangeSet {readonly baseRevision:number;readonly operations:readonly NoteOperation[];}
export type ApplyResult={readonly ok:true;readonly project:MusicProject}|{readonly ok:false;readonly reason:string};
