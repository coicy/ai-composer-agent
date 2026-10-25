export {composeMelody} from './generators/melody.js';
export {continueMelody} from './generators/continue.js';
export {proposeWithProvider} from './contracts/validate.js';
export {SeededProvider} from './providers/seeded-provider.js';
export type {CompositionProvider,CompositionMode,EditConstraint,CompositionRequest,ProviderContext,ValidatedComposition} from './contracts/provider.js';
export type {MelodyRequest,MelodyCandidate,MelodyStyle} from './generators/melody.js';
export type {ContinueRequest} from './generators/continue.js';
export {proposeTranspose} from './transformations/transpose.js';
export type {TransposeCandidate} from './transformations/transpose.js';
export {proposeArrangement,ARRANGEMENT_ROLES} from './arrangement/arrange.js';
export type {ArrangementRole,ArrangementRequest,ArrangementContext,ArrangementProvider,ArrangementCandidate} from './arrangement/arrange.js';
export {SeededArranger} from './arrangement/seeded-arranger.js';
export {analyzeTonality,suggestChords} from './analysis/tonality.js';
export type {KeyHypothesis,TonalProfile,ChordSuggestion,ScaleMode} from './analysis/tonality.js';
export {evaluateArrangement} from './evaluation/arrangement.js';
export type {ArrangementFinding,ArrangementAssessment,ArrangementMetrics} from './evaluation/arrangement.js';
export {validateHarmonyPlan,checkHarmonyPlan,chordPitchClasses,chordLabel,scalePitchClasses,DEFAULT_REGISTERS} from './planning/harmony-plan.js';
export type {HarmonyPlan,PlanConstraint,PlanFinding,PlanRegister,DiatonicDegree} from './planning/harmony-plan.js';
export {effectiveChordEvents,chordAtBeat,chordPitchClassesAtBeat,chordEventLabel,isStepwisePassingTone} from './planning/harmony-plan.js';
export type {ChordEvent} from './planning/harmony-plan.js';
export {deriveArrangementSeed,proposeArrangementVariants,combineArrangementVariants,MAX_ARRANGEMENT_VARIANTS} from './arrangement/variants.js';
export type {ArrangementPartChoices,MixedArrangementCandidate} from './arrangement/variants.js';
export {proposeRegionRegeneration} from './arrangement/regenerate-region.js';
export type {RegionRegenerationRequest,RegionRegenerationCandidate} from './arrangement/regenerate-region.js';
export {proposeRegionVariants} from './arrangement/region-variants.js';
export {findReusableHarmonyPlan} from './arrangement/reuse-plan.js';
export type {ReusablePlan} from './arrangement/reuse-plan.js';
export {createArrangementEditingContext} from './arrangement/editing-context.js';
export type {ArrangementEditingContext,ArrangementEditingIntent,ProtectedPartContext} from './arrangement/editing-context.js';
export {proposeSingleRole} from './arrangement/single-role.js';
export type {SingleRoleProposal} from './arrangement/single-role.js';
export {interpretFeedbackRules,validateFeedbackInput,validateFeedbackInterpretation,hasActionableFeedback,reconcileFeedbackInterpretation} from './feedback/feedback.js';
export type {FeedbackInterpretation} from './feedback/feedback.js';
export {compareRegionCandidate} from './arrangement/compare-region.js';
export type {RegionCandidateComparison} from './arrangement/compare-region.js';
export {proposeRegionVariantBatch} from './arrangement/region-variants.js';
export type {RegionVariantBatch,FailedRegionVariant} from './arrangement/region-variants.js';

export {listElectronicTechniques,recommendElectronicTechniques,proposeElectronicTechniqueVariations} from './planning/electronic-techniques.js';
export type {ElectronicStyle,TechniqueId,TechniqueSlot,TechniquePlan,TechniqueRequest,TechniqueChoice,VariationGesture} from './planning/electronic-techniques.js';

export {buildElectronicCompositionBlueprint,locateBlueprintSection} from './planning/electronic-blueprint.js';
export type {CompositionBlueprint,PlannedSongSection,BlueprintRequest,SongSectionKind} from './planning/electronic-blueprint.js';

export {planPhraseAutomation} from './planning/phrase-automation.js';
export type {AutomationLane,AutomationRole,AutomationPoint,AutomationCurve,AutomationRequest,AutomationPlan} from './planning/phrase-automation.js';

export {auditSignatureTechniques} from './evaluation/signature-audit.js';
export type {SignatureAudit} from './evaluation/signature-audit.js';

export {prepareDrumContext,checkDrumEvidence,proposeDrumCandidate} from './arrangement/drum-candidate.js';
export type {DrumRequest,DrumContext,DrumProvider,DrumEvidence,DrumCandidate} from './arrangement/drum-candidate.js';

export {proposeDrumWithRetry} from './arrangement/drum-retry.js';
export type {DrumRetryResult} from './arrangement/drum-retry.js';

export {extractMotifIdentity,validateMotifDevelopmentPlan,buildRuinsDevelopmentPlan} from './planning/motif-development.js';
export type {MotifIdentity,DevelopmentWindow,MotifDevelopmentPlan,DevelopmentOperation} from './planning/motif-development.js';

export {assessMotifRealization} from './evaluation/motif-realization.js';
export type {MotifRealizationEvidence} from './evaluation/motif-realization.js';
