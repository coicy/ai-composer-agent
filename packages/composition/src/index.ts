export {composeMelody} from './generators/melody.js';
export {continueMelody} from './generators/continue.js';
export {proposeWithProvider} from './contracts/validate.js';
export {SeededProvider} from './providers/seeded-provider.js';
export type {CompositionProvider,CompositionRequest,ProviderContext,ValidatedComposition} from './contracts/provider.js';
export type {MelodyRequest,MelodyCandidate,MelodyStyle} from './generators/melody.js';
export type {ContinueRequest} from './generators/continue.js';
