export type {MidiNote,MusicTrack,MusicProject,NoteOperation,ChangeSet,ApplyResult} from './model/types.js';
export {validateNote,validateProject} from './validation/notes.js';
export {applyChangeSet} from './commands/apply.js';
