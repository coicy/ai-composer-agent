export interface MidiNote {readonly noteId:string;readonly pitch:number;readonly startTick:number;readonly durationTicks:number;readonly velocity:number;readonly locked?:boolean;}
export interface MusicTrack {readonly trackId:string;readonly name:string;readonly locked:boolean;readonly notes:readonly MidiNote[];}
/** Historical provenance, not an automatically binding score rule. The JSON plan is validated by composition on reuse. */
export interface GenerationRecord {
 readonly recordId:string;
 readonly kind:'three_track'|'scoped';
 readonly sourceTrackId:string;
 readonly targetTrackIds:readonly string[];
 readonly startTick:number;
 readonly endTick:number;
 readonly seed?:number;
 readonly seedsByRole?:Readonly<Record<string,number>>;
 readonly providerId:string;
 readonly instruction:string;
 /** Auditable hard editing mode for a scoped approved candidate. */
 readonly editConstraint?:'pitch_only';
 readonly planJson?:string;
}
export interface MusicProject {readonly generationHistory?:readonly GenerationRecord[];readonly projectId:string;readonly revision:number;readonly ppq:number;readonly tracks:readonly MusicTrack[];}
export type NoteOperation =
 |{readonly type:'add_track';readonly track:MusicTrack}
 |{readonly type:'add_note';readonly trackId:string;readonly note:MidiNote}
 |{readonly type:'update_note';readonly trackId:string;readonly noteId:string;readonly changes:Partial<Pick<MidiNote,'pitch'|'startTick'|'durationTicks'|'velocity'>>}
 |{readonly type:'delete_note';readonly trackId:string;readonly noteId:string};
export interface ChangeSet {readonly baseRevision:number;readonly operations:readonly NoteOperation[];readonly generationRecord?:GenerationRecord;}
export type ApplyResult={readonly ok:true;readonly project:MusicProject}|{readonly ok:false;readonly reason:string};