export interface MidiNote {readonly noteId:string;readonly pitch:number;readonly startTick:number;readonly durationTicks:number;readonly velocity:number;readonly locked?:boolean;}
export interface MusicTrack {
 readonly trackId:string;readonly name:string;readonly locked:boolean;readonly notes:readonly MidiNote[];
 /** General MIDI program 0..127; optional for legacy projects. */
 readonly program?:number;
 /** Channel is 0-based MIDI (channel 10 percussion = 9); optional for legacy projects. */
 readonly channel?:number;
 readonly isDrum?:boolean;
}
export interface Meter {readonly numerator:number;readonly denominator:2|4|8|16;}

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
 readonly protectedPrefixCount?:number;
 readonly protectedNoteIds?:readonly string[];
 readonly maxLeapSemitones?:number;
 readonly planJson?:string;
}
export interface MusicProject {
 readonly generationHistory?:readonly GenerationRecord[];
 readonly projectId:string;readonly revision:number;readonly ppq:number;readonly tracks:readonly MusicTrack[];
 /** Initial constant tempo, 20..300 BPM. Absence means legacy default 120. */
 readonly tempoBpm?:number;
 /** Initial constant meter. Absence means legacy 4/4. Changes need a future map contract. */
 readonly meter?:Meter;
}
export type NoteOperation =
 |{readonly type:'add_track';readonly track:MusicTrack}
 |{readonly type:'add_note';readonly trackId:string;readonly note:MidiNote}
 |{readonly type:'update_note';readonly trackId:string;readonly noteId:string;readonly changes:Partial<Pick<MidiNote,'pitch'|'startTick'|'durationTicks'|'velocity'>>}
 |{readonly type:'delete_note';readonly trackId:string;readonly noteId:string};
export interface ChangeSet {readonly baseRevision:number;readonly operations:readonly NoteOperation[];readonly generationRecord?:GenerationRecord;}
export type ApplyResult={readonly ok:true;readonly project:MusicProject}|{readonly ok:false;readonly reason:string};