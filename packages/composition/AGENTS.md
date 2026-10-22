# composition — 作曲生成，不拥有工程
```text
src/
  contracts/   # ComposeRequest、Candidate、约束与上下文
  planning/    # 风格、动机、乐句和曲式计划
  generators/  # LLM/规则/符号模型的替换接口
  harmony/     # 和声与低音方案
  variations/  # 续写、模进和局部变奏
  evaluation/  # 结构/音域/重复等可解释检查
  orchestration/ # 后续配器扩展（非 MVP 先不实现）
  index.ts
```
必须输出可编辑结构化音符或候选 MusicOperation；绝不直接调用 core commit。不得覆盖锁定区间，不把概率或美学评分当确定性事实。LLM 调用通过注入 Provider 接口，密钥及 HTTP 实现不放这里；所有模型结果二次验证。候选保持可比较与可溯源。
## 强制音乐编辑约束
- `editConstraint: 'pitch_only'` 要求明确的选中 Note IDs；对候选音符验证原有的 (startTick,durationTicks) 多重集合完全相等，输出只能是原稳定 ID 的 `update_note.pitch`。绝不能通过重建 noteID 或只写提示词代替约束。
- 对不能满足节奏、音高边界、锁定或选区合法性的模型输出必须拒绝，不自动放宽约束。
- 确定性移调必须作为 Transformation 候选，而非模型臆测；先预览再提交。具体见 docs/MUSIC_EDIT_CONSTRAINTS.md。

## 多轨编配合同
- ArrangementProvider 只读一个源 MusicTrack 的投影音符；输出仅能包含 harmony、bass、accompaniment 三个新角色，每个恰好一次。
- 任何原轨道的修改、删除或跨范围输出不得放行。通过三项 `add_track` 构建同一个 ChangeSet，验证/预览/批准后原子提交；不得绕过 Music Core。
- Provider 不能生成稳定项目/音符 ID 或调用提交函数；ID 由确定性 validator 分配，验证规模和音高、Tick、力度。见 docs/MULTITRACK_ARRANGEMENT.md。

## 调性分析与编配质量提示
- `analysis/tonality.ts` 只计算 pitch-class 假设，明确不足或歧义；不可输出“已证实调性”。
- `evaluation/arrangement.ts` 的检查仅为软诊断，不可绕过 Music Core 或作为无授权的修复/拒绝原因。
- 必须保留统计证据、计数与免责声明；没有经过听评/人工标注的数据，不得报出“音乐质量分数”或宣称行业级准确率。见 docs/ARRANGEMENT_DIAGNOSTICS.md。

## 可控 HarmonyPlan（v0.1）
- 用户显式的 tonic/mode/degrees/registers 和三个独立 enforcement 策略才是编配规划权威；不能将 `tonalProfile` 推测默认升级为强制音阶。
- `hard` 必须校验所有新增轨道音符（包括跨小节延音），任何违规立即拒绝整个候选，绝不静默降级或自动修复。
- `soft` 只生成含明确计数的 PlanFinding，不禁止音乐性合理的外音与非典型声部布局。
- HarmonyPlan 仍必须作为单次三轨原子操作预览、显式用户批准和 revision 检查；参考 docs/HARMONY_PLANNING.md。

## HarmonyPlan timeline (v0.2)
- Quarter-note `ChordEvent` ranges must be contiguous and cover the full requested bar span. A note crossing event boundaries must pass every chord check.
- A selected seventh extends the current scale-stacked triad with degree+6; bass `inversions: hard` is checked at first onset per chord window, including missing bass onset.
- `passingTones: stepwise` is a narrow, deterministic harmony/accompaniment nonchord exception, never permission to bypass `scale: hard`; no silent repairs or weakening enforcement.
- Maintain backward compatibility when `timeline` and `inversions` are omitted. See docs/HARMONY_TIMELINE.md.

## Seeded arrangements and candidate banks
- `seed` is an optional unsigned 32-bit integer; validate it before provider invocation. Batch count must be 2–4, with deterministic derived-seed scheduling; local PRNG state must not depend on global `Math.random`, clock, or previous requests.
- Provider model seeds are only variation guides; never claim deterministic reproduction for remote model outputs without a supported, measured guarantee.
- Candidate role mixing must rebuild a fresh proposal and rerun *all* MIDI/harmony/source/revision checks. Never splice independently generated ChangeSets or bypass explicit preview and commit.
- Preserve backwards compatibility with an omitted seed and legacy one-shot arrangement APIs. See docs/ARRANGEMENT_VARIANTS.md.

## Scoped region regeneration
- 局部变奏只更新目标已存在的轨道与明确范围；源旋律只读、其他声部不变。
- 拒绝锁定轨道或音符、跨选区音符和模型未验证输出；在域层 dry-run 并通过工程 revision 进行最终检查。参见 docs/SCOPED_ARRANGEMENT_REGENERATION.md。

## Project provenance & local variants
- Region candidate bank derives 2–4 uint32 Seeds and validates every candidate before publishing any bank. Preview/cancel never writes project notes or provenance.
- A persisted plan is reused only when an explicit approved history record matches source and target and completely covers the selected window. Parse/validate and slice to local chords; never guess a missing plan or infer an old plan from bare MIDI.
- Generating/committing a candidate must atomically append a provenance record with the actual Seed and plan; avoid misleading assertions about remote model reproducibility. See docs/PROJECT_PROVENANCE.md.

## Scoped arrangement read-only context
- Build neighbor and protected-part context exclusively from validated MusicProject; never trust client-supplied note arrays or apply model-proposed modifications to protected tracks.
- Bound target before/after/original notes and other-part note counts. Keep original note IDs internal; serialize only musical note properties to provider inputs.
- Lock and cross-boundary checks must occur before requesting a model completion. Scoped proposals may change only the chosen target track and time range.

## Single-role output boundary
- Initial three-track arrangement **must** retain `{tracks:[harmony,bass,accompaniment]}`.
- A scoped edit **must** return exactly `{role,notes}` matching the requested existing target role; never implicitly accept or project three-track model outputs.
- Apply only the selected role's hard music-plan checks, and rerun all preflight/MIDI validations before a dry-run; the source and protected tracks remain read-only. No model-owned IDs or ChangeSets.

## Scoped pitch-only hard constraint
- When `editConstraint:'pitch_only'` is selected, require nonempty <=32 unlocked original target notes fully within the window **before provider calls**.
- Model output timing, durations, velocity and note count must match the exact multiset of original notes. Preserve original Note IDs and commit only `update_note` operations whose sole changed key is `pitch`, with no-op changes rejected.
- Never repair a timing violation, relax harmony hard rules, or transform full regeneration into rhythm-locked mode implicitly. Explicit user opt-in only.

## Iterative feedback hard constraints
- `protectedPrefixCount` is a count of chronological original target notes, not a note ID list. Protected pitches must not change; the value must be less than original target note count.
- `maxLeapSemitones` bounds adjacent **non-overlapping** pitches in a pitch-only passage (including nearest untouched boundary notes). Do not interpret it as a complete harmonic voice-leading guarantee.
- Both require `editConstraint:'pitch_only'`, are checked before provider invocation where possible and again after MIDI output, and must not be weakened to improve a sample. Persist approved feedback settings in provenance.
