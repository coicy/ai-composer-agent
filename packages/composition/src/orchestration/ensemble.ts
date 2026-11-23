import type {MidiNote, MusicTrack} from '@ai-composer/music-core';

/** Advisory orchestration layer over the existing melody + three arrangement roles.
 * A voice is a musical responsibility, not an instrument program or MIDI track ID.
 * v1 maps one voice to each legacy role; this is not yet a general multi-voice track model.
 */
export type EnsembleTrackRole = 'source' | 'harmony' | 'bass' | 'accompaniment';
export type EnsembleVoiceFunction = 'lead' | 'answer' | 'harmonic' | 'foundation' | 'rhythmic' | 'texture';
export type EnsembleRelationKind = 'call_response' | 'lead_follow' | 'rhythmic_interlock';
export interface EnsembleVoice {
  readonly id: string;
  readonly trackRole: EnsembleTrackRole;
  readonly purpose: EnsembleVoiceFunction;
  readonly instrumentHint?: string;
}
export interface EnsembleRelation {
  readonly id: string;
  readonly fromVoiceId: string;
  readonly toVoiceId: string;
  readonly kind: EnsembleRelationKind;
  /** Absolute MIDI ticks, half-open. Relations may change across phrases. */
  readonly startTick: number;
  readonly endTick: number;
}
export interface EnsemblePlan {
  readonly version: 1;
  readonly voices: readonly EnsembleVoice[];
  readonly relations: readonly EnsembleRelation[];
}
export interface EnsembleCue {
  readonly relationId: string;
  readonly kind: EnsembleRelationKind;
  readonly fromRole: EnsembleTrackRole;
  readonly toRole: EnsembleTrackRole;
  readonly startTick: number;
  readonly endTick: number;
  readonly availableWindows: readonly {readonly startTick: number; readonly endTick: number}[];
  readonly guidance: string;
}
export interface EnsembleFinding {
  readonly relationId: string;
  readonly code: 'no_response_window' | 'missing_response' | 'foreground_conflict' | 'onset_collision';
  readonly count: number;
  readonly inspected: number;
  readonly severity: 'review';
  readonly message: string;
}
export interface EnsembleAssessment {
  readonly findings: readonly EnsembleFinding[];
  readonly cues: readonly EnsembleCue[];
  readonly disclaimer: string;
}

const ROLES: readonly EnsembleTrackRole[] = ['source', 'harmony', 'bass', 'accompaniment'];
const PURPOSES: readonly EnsembleVoiceFunction[] = ['lead', 'answer', 'harmonic', 'foundation', 'rhythmic', 'texture'];
const RELATIONS: readonly EnsembleRelationKind[] = ['call_response', 'lead_follow', 'rhythmic_interlock'];
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keysOnly = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).every(k => keys.includes(k));

/** Strictly validate user/LLM-supplied plan before it can enter a provider prompt. */
export function validateEnsemblePlan(raw: unknown, startTick: number, endTick: number): EnsemblePlan {
  if (!Number.isSafeInteger(startTick) || !Number.isSafeInteger(endTick) || startTick < 0 || endTick <= startTick)
    throw new Error('invalid_ensemble_scope');
  if (!object(raw) || !keysOnly(raw, ['version', 'voices', 'relations']) || raw.version !== 1 ||
      !Array.isArray(raw.voices) || raw.voices.length < 2 || raw.voices.length > 4 ||
      !Array.isArray(raw.relations) || raw.relations.length < 1 || raw.relations.length > 12)
    throw new Error('invalid_ensemble_plan');
  const voices: EnsembleVoice[] = [];
  const ids = new Set<string>();
  const roles = new Set<EnsembleTrackRole>();
  for (const v of raw.voices as unknown[]) {
    if (!object(v) || !keysOnly(v, ['id', 'trackRole', 'purpose', 'instrumentHint']) ||
        typeof v.id !== 'string' || !ID.test(v.id) || ids.has(v.id) ||
        !ROLES.includes(v.trackRole as EnsembleTrackRole) || roles.has(v.trackRole as EnsembleTrackRole) ||
        !PURPOSES.includes(v.purpose as EnsembleVoiceFunction) ||
        (v.instrumentHint !== undefined && (typeof v.instrumentHint !== 'string' ||
          v.instrumentHint.length > 80 || !v.instrumentHint.trim())))
      throw new Error('invalid_ensemble_voice');
    ids.add(v.id);
    roles.add(v.trackRole as EnsembleTrackRole);
    voices.push({id: v.id, trackRole: v.trackRole as EnsembleTrackRole,
      purpose: v.purpose as EnsembleVoiceFunction,
      ...(v.instrumentHint === undefined ? {} : {instrumentHint: v.instrumentHint as string})});
  }
  if (!roles.has('source')) throw new Error('invalid_ensemble_voice');
  const relations: EnsembleRelation[] = [];
  const relationIds = new Set<string>();
  for (const r of raw.relations as unknown[]) {
    if (!object(r) || !keysOnly(r, ['id', 'fromVoiceId', 'toVoiceId', 'kind', 'startTick', 'endTick']) ||
        typeof r.id !== 'string' || !ID.test(r.id) || relationIds.has(r.id) ||
        typeof r.fromVoiceId !== 'string' || !ids.has(r.fromVoiceId) ||
        typeof r.toVoiceId !== 'string' || !ids.has(r.toVoiceId) || r.fromVoiceId === r.toVoiceId ||
        voices.find(v => v.id === r.toVoiceId)?.trackRole === 'source' ||
        !RELATIONS.includes(r.kind as EnsembleRelationKind) ||
        !Number.isSafeInteger(r.startTick) || !Number.isSafeInteger(r.endTick) ||
        (r.startTick as number) < startTick || (r.endTick as number) > endTick ||
        (r.startTick as number) >= (r.endTick as number))
      throw new Error('invalid_ensemble_relation');
    relationIds.add(r.id);
    relations.push({id: r.id, fromVoiceId: r.fromVoiceId, toVoiceId: r.toVoiceId,
      kind: r.kind as EnsembleRelationKind, startTick: r.startTick as number, endTick: r.endTick as number});
  }
  return {version: 1, voices, relations};
}

type VoiceNotes = Partial<Record<EnsembleTrackRole, readonly MidiNote[]>>;
const trimmed = (notes: readonly MidiNote[], from: number, to: number) => notes
  .filter(n => n.startTick < to && n.startTick + n.durationTicks > from)
  .map(n => ({startTick: Math.max(n.startTick, from), endTick: Math.min(n.startTick + n.durationTicks, to)}))
  .sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);

/** Find real silences following source notes; leading silence is not a response. */
function responseWindows(notes: readonly MidiNote[], start: number, end: number, ppq: number) {
  const spans = trimmed(notes, start, end);
  const gaps: {startTick: number; endTick: number}[] = [];
  let cursor = start;
  let heard = false;
  const minGap = Math.max(1, Math.round(ppq / 2));
  for (const span of spans) {
    if (heard && span.startTick - cursor >= minGap)
      gaps.push({startTick: cursor, endTick: span.startTick});
    cursor = Math.max(cursor, span.endTick);
    heard = true;
  }
  if (heard && end - cursor >= minGap) gaps.push({startTick: cursor, endTick: end});
  return gaps.slice(0, 32);
}

/** Gives providers a time-aware relationship brief, never editing authority. */
export function buildEnsembleCues(plan: EnsemblePlan, sourceNotes: readonly MidiNote[], ppq: number): readonly EnsembleCue[] {
  if (!Number.isSafeInteger(ppq) || ppq < 1) throw new Error('invalid_ensemble_ppq');
  const byId = new Map(plan.voices.map(v => [v.id, v.trackRole] as const));
  return plan.relations.map(relation => {
    const fromRole = byId.get(relation.fromVoiceId)!;
    const toRole = byId.get(relation.toVoiceId)!;
    const availableWindows = relation.kind === 'call_response' && fromRole === 'source'
      ? responseWindows(sourceNotes, relation.startTick, relation.endTick, ppq) : [];
    const guidance = relation.kind === 'call_response'
      ? '在前一声部的乐句空隙中引用或变化其动机；没有空隙时不要强行挤入。'
      : relation.kind === 'rhythmic_interlock'
        ? '错开两声部的重音与音符起点，形成节奏互补，而非机械齐奏。'
        : '前景声部演奏时降低从属声部的密度或力度；在前景停顿时可增强。';
    return {relationId: relation.id, kind: relation.kind, fromRole, toRole,
      startTick: relation.startTick, endTick: relation.endTick, availableWindows, guidance};
  });
}

/** Evidence-counted findings. Never a quality score or hard MIDI validator. */
export function assessEnsembleRelations(
  plan: EnsemblePlan, source: readonly MidiNote[], tracks: readonly MusicTrack[], ppq: number
): EnsembleAssessment {
  if (tracks.length !== 3) throw new Error('ensemble_requires_three_tracks');
  const available: VoiceNotes = {source, harmony: tracks[0]?.notes ?? [],
    bass: tracks[1]?.notes ?? [], accompaniment: tracks[2]?.notes ?? []};
  const cues = buildEnsembleCues(plan, source, ppq);
  const findings: EnsembleFinding[] = [];
  const add = (cue: EnsembleCue, code: EnsembleFinding['code'], count: number, inspected: number, message: string) => {
    findings.push({relationId: cue.relationId, code, count, inspected, severity: 'review', message});
  };
  for (const cue of cues) {
    const from = (available[cue.fromRole] ?? []).filter(n => n.startTick < cue.endTick && n.startTick + n.durationTicks > cue.startTick);
    const to = (available[cue.toRole] ?? []).filter(n => n.startTick >= cue.startTick && n.startTick < cue.endTick);
    if (cue.kind === 'call_response') {
      const windows = cue.fromRole === 'source' ? cue.availableWindows : responseWindows(from, cue.startTick, cue.endTick, ppq);
      if (windows.length === 0) {
        add(cue, 'no_response_window', 0, 0, '当前声部几乎没有可用于呼应的乐句空隙；建议先检查主旋律休止。');
        continue;
      }
      const missed = windows.filter(w => !to.some(n => n.startTick >= w.startTick && n.startTick < w.endTick)).length;
      if (missed > 0) add(cue, 'missing_response', missed, windows.length,
        '在 ' + windows.length + ' 个可回应空隙中，有 ' + missed + ' 个没有目标声部起音；请核听是否有意留白。');
    } else if (cue.kind === 'rhythmic_interlock') {
      const tolerance = Math.max(1, Math.round(ppq / 8));
      const collisions = to.filter(n => from.some(f => Math.abs(f.startTick - n.startTick) <= tolerance)).length;
      if (to.length >= 2 && collisions / to.length >= 0.5)
        add(cue, 'onset_collision', collisions, to.length,
          collisions + '/' + to.length + ' 个目标声部起音与参考声部接近；节奏可能过于同步，需听评。');
    } else {
      const competing = to.filter(n => from.some(f =>
        f.startTick < n.startTick + n.durationTicks && n.startTick < f.startTick + f.durationTicks &&
        n.velocity >= Math.max(1, Math.round(f.velocity * 0.85)))).length;
      if (competing >= 2) add(cue, 'foreground_conflict', competing, to.length,
        competing + '/' + to.length + ' 个从属声部音符与前景声部重叠且力度接近；可能缺少让位。');
    }
  }
  return {findings, cues, disclaimer: '声部关系诊断只统计时值、起音和力度；不代表混音响度、真实对位品质或审美评分。'};
}
