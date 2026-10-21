import type {MusicProject,ChangeSet,MidiNote} from '@ai-composer/music-core';
export interface CompositionRequest {
 readonly project:MusicProject;
 readonly trackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly instruction:string;
 readonly maxNotes?:number;
}
export interface ProviderContext {
 readonly trackId:string;
 readonly startTick:number;
 readonly endTick:number;
 readonly ppq:number;
 readonly existingNotes:readonly MidiNote[];
 readonly instruction:string;
}
export interface CompositionProvider {
 readonly id:string;
 generate(context:ProviderContext,signal?:AbortSignal):Promise<unknown>;
}
export interface ValidatedComposition {
 readonly providerId:string;
 readonly label:string;
 readonly notes:readonly MidiNote[];
 readonly changes:ChangeSet;
}
