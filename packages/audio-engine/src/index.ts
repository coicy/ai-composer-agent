export {playProject} from './playback/preview.js';
export type {PlaybackHandle} from './playback/preview.js';

export {PRESETS,inferPreset,createProductionPlan,validateProductionPlan} from './planning/production.js';
export type {ProductionPlan,TrackSound,PresetId} from './planning/production.js';

export {validatePlaybackAutomation,scheduleAutomation} from './playback/automation.js';
export type {PlaybackAutomation,PlaybackAutomationCurve,AutomationLane} from './playback/automation.js';
