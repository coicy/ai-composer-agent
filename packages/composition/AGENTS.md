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
