import type {MusicProject,ChangeSet,MidiNote} from '@ai-composer/music-core';

export type CompositionMode = 'append' | 'replace';
export interface CompositionRequest {
 readonly project:MusicProject;
 readonly trackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
 readonly mode?:CompositionMode;
 readonly maxNotes?:number;
}
export interface ProviderContext {
 readonly trackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly ppq:number;
 readonly mode:CompositionMode;
 readonly existingNotes:readonly MidiNote[];
 readonly targetNotes:readonly MidiNote[];
 readonly instruction:string;
}
export interface CompositionProvider {
 readonly id:string;
 generate(context:ProviderContext,signal?:AbortSignal):Promise<unknown>;
}
export interface ValidatedComposition {
 readonly providerId:string;
 readonly label:string;
 readonly mode:CompositionMode;
 readonly notes:readonly MidiNote[];
 readonly removedNotes:readonly MidiNote[];
 readonly changes:ChangeSet;
}
