# 基于成熟开源方案的 AI 编曲能力升级实施方案（提案）

> 状态：**Proposed / 待产品与工程评审**，但必须遵守已批准的 D-005：**仅由 LLM 生成 AI 音乐，不引入专用音乐生成模型**。
>
> 基准：`main@08301c5ddf0f6c41ddd8d4b485414b3bf77491ba`（2026-10-22）；本文件记录拟实施增量，**不代表已实现或已通过音乐听评**。
>
> 目的：在保留现有可编辑 MIDI / Piano Roll / Music Core 事务安全架构的前提下，通过开源项目的经过验证的处理方法，提高**可控生成、配器试听、结构化音乐分析和真实质量评测**的能力。各外部项目仅作为设计及实验参照；依赖或权重的引入需要独立许可证与技术验证。

## 0. 决策边界与执行原则

1. **产品权威保持原状。** 用户裁决、`docs/DECISIONS.md` accepted、`docs/PRODUCT.md` 及仓库 `AGENTS.md` 优先于本提案。任何新增正式产品规则需用户明确批准并单独记录，不因本文档自动生效。
2. **Piano Roll 仍是唯一主音符编辑器**；不引入五线谱、DAW 插件、VST、音频转录、多人协作，也不将完整 DAW 当本轮交付目标。
3. **MusicProject 是唯一权威工程状态。** 新生成器只提议音符/ChangeSet，原有 `baseRevision`、锁、作用域、稳定 Note ID、dry-run、候选预览、显式确认、undo/redo 和 provenance 约束全部保留。生成器、音乐分析器、音频引擎均不得直接提交项目。
4. **区分三种证据**：结构/权限测试通过、真实模型 API 可运行、人工听评显示音乐质量改进。任何一种不能冒充另一种。
5. **先做无破坏性验证，后拓展数据模型。** 新的拍号、tempo map、乐器映射、曲式元数据将触及 schema / MIDI I/O / core，必须先做单独 ADR 和兼容性评审；此提案不直接改变任何已有 schema。
6. **技术许可不是音乐内容许可。** 模型代码、预训练权重、训练素材、SoundFont、附带曲谱分别核查，不把开源代码误判为全部素材都可商用。
7. **D-005 已定生成引擎：仅用 LLM 创作音乐。** 不接入 MIDI-GPT 等专用音乐生成模型、权重、推理服务、适配器与 PoC；仅参照开源工具的工作流和控制设计。music21、MusPy 及音源合成器等不属于生成模型，作为非 AI 分析/试听工具可评估采用；现有 SeededArranger 仅作离线规则演示和测试。
8. 开发遵循 `docs/DEVELOPMENT.md`：功能分支 -> PR -> `check` 和 `e2e` 完整成功 -> 人工审查 -> 合并。不得直接向 main 推送未经验证的中间代码。

## 1. 当前基线：哪些已具备，哪些未被证明

| 领域 | 已有代码/测试证据 | 对本提案的重要缺口 |
| --- | --- | --- |
| 安全编辑 | `packages/music-core/src/commands/apply.ts`、`history/session.ts` | 不应改写这条提交流程；新模型必须服从它 |
| 选区重写 | `packages/composition/src/arrangement/regenerate-region.ts`、`single-role.ts` | 目前偏结构约束，缺少广义音乐属性控制 |
| Seed 与候选 | `region-variants.ts`、`compare-region.ts`、`region-variants.test.ts` | Remote Seed 不保证复现；缺统一候选质量实验 |
| 编曲分析 | `analysis/tonality.ts`、`evaluation/arrangement.ts`、HarmonyPlan | 调性是假说；缺真实和声/织体解释与听评 |
| LLM 接入 | `services/agent-api/src/providers/openai*.ts` | 已输出 MIDI JSON，但缺可验证的音乐规划、Prompt 优化与真实 LLM 听评 |
| 试听与 MIDI | `audio-engine/src/playback/preview.ts`、`midi-io/src/mapping/midi.ts` | 单三角波、固定 120 BPM，无法客观评估配器 |
| 质量验证 | unit tests、Chromium Playwright CI | 真实模型生成与固定听评语料尚无通过记录 |
| 持久化 | JSON 工程导出、generationHistory | 无自动保存；MIDI 不保留工程专用元数据 |

注意：README 中旧的“尚无可运行应用”等描述与当前原型不一致；文档维护可独立修正，但不得把“能启动”描述为“音乐质量已验证”。本提案聚焦新增工作的验收。

## 2. 开源对标：只迁移处理方法，不盲目迁移依赖

| 项目及证据 | 可借鉴机制 | 本仓库落点 | 采用界限 |
| --- | --- | --- | --- |
| [Composer's Assistant 2](https://github.com/m-malandro/composers-assistant-REAPER)（[v2 release](https://github.com/m-malandro/composers-assistant-REAPER/releases)） | 多轨指定范围补写；全局/轨道级参数；音符密度、跨度、跳进倾向、保留节奏等细粒度控制 | `composition/contracts`、`arrangement` 与 Web 审批 UI | **先借鉴控制逻辑**；不依赖 REAPER、不复制 JSFX/UI；模型/发布资产另核许可证 |
| [music21](https://github.com/cuthbertLab/music21) | 调性分析、和弦归纳、声部上下文的专业分析基础 | 可选后端只读分析服务 | Python 与自身语料分开；软件 BSD-3-Clause，内置 corpus/外部谱例另行核许可 |
| [MusPy](https://github.com/salu133445/muspy)（[指标](https://github.com/salu133445/muspy/blob/main/doc/source/metrics.rst)） | 音高范围、复调率、pitch-class entropy、空拍率、律动/节奏指标 | 离线评估脚本与基准报告 | 软件 MIT；**这些是描述性指标，不是审美得分** |
| [Tone.js](https://github.com/Tonejs/Tone.js)（[Transport](https://github.com/Tonejs/Tone.js/wiki/Transport)） | 音乐时间调度、统一传输时钟、起停/循环与合成器适配 | `packages/audio-engine` 的可替换 Adapter | 软件 MIT；验证 tick->seconds、播放生命周期，不把 Tone 对象写进 core |
| [FluidSynth](https://github.com/FluidSynth/fluidsynth) / [js-synthesizer](https://github.com/jet2jet/js-synthesizer) | SoundFont 乐器试听、AudioWorklet / 可离线渲染 | Audio adapter 的受控实验实现 | libfluidsynth LGPL-2.1；js-synthesizer 自身 BSD-3-Clause 但附带 externals 另有许可；SoundFont 授权必须独立核查 |
| [LMMS](https://github.com/LMMS/lmms) | Song Editor / Piano Roll / Mixer 的职责和用户工作流分层 | UX 原则参考 | GPL-2.0，**不复制实现代码**，不将 Web 应用变成完整 DAW |

### 为什么不直接把所有模块换成第三方库

- Composer's Assistant 2 依赖 REAPER 环境；本项目是浏览器单一 Piano Roll，无需移植它的宿主集成。
- D-005 已排除 MIDI-GPT 等专用音乐模型；即使仅为对照实验，也不规划接入、训练、推理或下载相关权重。
- music21/MusPy 属 Python 生态；如果需要采用，先以离线评估或可选本地 HTTP sidecar 隔离，前端不直接运行 Python。
- FluidSynth 提供合成器，不等于附赠可安全分发的完整音色库。先在授权明确的测试音色上验证，再判断发行形态。

### 双入口依赖（D-006 已批准，具体实现待开发）

此方案中的通用 LLM 创作能力必须同时支持两类接入：**外部 Agent 经 MCP 调用本工具**，以及**用户输入 API 地址、API Key 后由本工具内部调用 LLM**。两者共享同一 composition + Music Core 候选校验/预览/批准流程；不能用后端环境变量配置代替内部用户配置，也不能让 MCP 直接访问用户的内部 Key。浏览器权威 MusicProject 与 MCP 的授权会话桥接、密钥安全会话等详细建议见 [LLM_ACCESS_MODES.md](LLM_ACCESS_MODES.md)。本文原阶段 A–E 仍为待审议实施提案，本段仅同步已裁定的双入口边界。

## 3. 建议的增量架构

```text
用户说明 / 用户显式选择可控属性
        |
        v
Web: Intent Draft & Review（只读；未授权不得升级为 hard）
        |
        v
agent-api / composition orchestration
  ├── Project Snapshot + Selection + Locks + Revision
  ├── Optional Analysis Context（仅建议，不写工程）
  ├── LLM capability negotiation + bounded musical context
  │      ├── Existing OpenAI structured MIDI (LLM)
  │      ├── Optional other general-purpose LLM endpoint
  │      └── Existing SeededArranger (offline rules/demo/tests only)
  └── Existing server-side preflight/validation
        |
        v
composition: hard validation -> music-core dry-run -> Candidate
        |
        +----> Offline metrics / diagnostics（不自动选“最佳”）
        +----> audio-engine audition（只读临时快照）
        |
        v
用户显式批准 -> Music Core 单次原子 commit
                      -> generationHistory/undo/redo
```

**依赖约束**：`music-core` 不依赖第三方音频、Python 或模型 SDK；`composition` 仅管理领域规则和 Provider 接口；LLM HTTP 适配置于 `services/agent-api`；可选 Python sidecar 仅作 music21/MusPy 等非模型分析/评估，不承载音乐生成模型；`audio-engine` 只读取 MusicProject；`apps/web` 只做编排与交互。

### 3.1 建议新增的契约（示意，尚未批准）

```ts
type ControlStrength = 'hard' | 'advisory';

interface NumericMusicControl {
  kind: 'note_density' | 'polyphony_limit' | 'duration_bias'
      | 'register_range' | 'rhythmic_activity';
  value: number | { min: number; max: number };
  strength: ControlStrength;
  scope: { trackId: string; startTick: number; endTick: number };
  evidence: 'explicit_user' | 'accepted_draft';
}
interface GenerationIntent {
  mode: 'new_melody' | 'continue' | 'scoped_infill' | 'add_parts';
  instruction: string;
  controls: readonly NumericMusicControl[];
  // sourceTrackId / targetTrackId / existing edit constraints remain in
  // the established request contracts, NOT delegated to a model.
}
interface ProviderCapabilities {
  supportsScopedInfill: boolean;
  supportsPreserveRhythm: boolean;
  supportsCrossPartContext: boolean;
  supportedControls: readonly NumericMusicControl['kind'][];
  maxBars: number;
  maxNotesPerPart: number;
}
```

- 本段是**接口草案而非新的 accepted 协议**。第一步仅在 `composition/contracts` 内建兼容层，不改变现有 `ArrangementRequest` 或 `MusicProject` 的必填字段。
- `hard` 只能来自明确的用户选择/批准，并由**项目本地的确定性校验器**支持；若某项不具备可靠 hard 检查，**禁止标注 hard**，只能标注 advisory。
- Provider 不支持请求的 hard 控制时：在调用前返回 `unsupported_control`，不悄悄转为 prompt；advisory 可作为上下文并附“无法保证”的报告。
- 密度、复调、音域等统计的精确定义必须在实现 PR 中固定（计算范围、休止、重叠计数、拍号兼容性、四舍五入），防止 server/client 不一致。
- 自然语言反馈仍沿用“解释 -> 用户审核 -> 复制控件 -> 生成 -> 候选审批”两道确认机制；不能将“更丰满”直接换算成未经授权的具体数值硬规则。

### 3.2 兼容性策略

1. 默认 Provider 与现有三轨编配 `{tracks:[harmony,bass,accompaniment]}`、单声部局部编配 `{role,notes}` 协议保持不变；新控制可先编译为老协议的明确提示或条件，**但 hard 必须外部验证**。
2. 不动 `proposeRegionVariantBatch` 的候选独立校验、允许部分失败、全局 Abort 丢弃、失败原因脱敏等语义。
3. 只允许目标窗口内受许可的 `update_note` / `delete_note` / `add_note`；保持其他轨道和保护音符字节级等价的核心测试。
4. 不向外部模型发送 stable Note ID；服务端重新从 MusicProject 投影生成最小必要音乐上下文；模型输出不能指定操作/工程 ID。
5. 所有分析性附加字段先保持在临时候选或外部实验报告；持久化需要单独 versioned schema 迁移与 JSON 往返测试。

## 4. 分阶段实施与可验证交付

以下按**前置依赖**排序。P0/P1 是首批建议；其余必须受前阶段证据约束。时间投入不作无依据的承诺。

### Phase A — 建立可复现的音乐质量基线（最高优先级）

**目的**：在调整模型前，先知道现有编曲在哪些音乐维度存在问题；防止“CI 全绿”代替听觉效果。

**建议改动路径**
- `tests/music-fixtures/`：少量**自编或已获明确许可**的 MIDI/JSON 输入（独立保留来源和许可证）；初始可按单旋律、复调、多轨、弱拍、非和弦音、跨段衔接设计至少 8 个结构多样的样例。
- `tests/music-benchmarks/`：固定输入需求、源工程 hash、生成参数、provider/model 版本、seed（仅作为 hint）、审核元数据。
- `packages/composition/src/evaluation/`：最小只读指标接口；若采用 MusPy，先以离线脚本生成报告，不将 Python 做成 core 运行时依赖。
- `docs/MUSIC_EVALUATION_PROTOCOL.md`：与阶段 A 同批提交的人工听评和结果报告协议。

**建议基准字段**：`scenarioId`、`inputProjectHash`、`providerId`、`modelVersion`、`requestedScope`、`controls`、`seedHint`、`candidateHash`、`structuralViolations`、`objectiveMetrics`、`listenRatings`、`renderConfig`、`errorReason`。只存脱敏统计和授权样本；用户私有音乐默认不上传实验仓库。

**自动结构验证**：非法 pitch/tick/velocity、缺失/重复角色、锁破坏、跨选区编辑、版本冲突、protected Note ID、HarmonyPlan hard 违例、无权限修改、模型输出污染等必须继续**全部拒绝**。算法允许诊断“信息不足”；禁止自动生成“音乐好坏总分”。

**人工听评最小流程**：
- 同一源输入生成 A/B（现有 Provider vs 新候选）；盲化名称、统一速度/音源/响度/播放区间，随机化 A/B 顺序；
- 维度分别记录旋律连贯、节奏/律动、和声适配、配器层次、段落衔接、总体可用性，1–5 分及自由文本；保留“无法判断”；
- 优先至少 2 位听评人，对照结果显示分歧，不用单次主观意见宣称质量提升；
- 先报告分布、样本数和失败率；“超过基线”阈值由实际试验前声明，不事后改门槛；
- 真实 API key 不提交仓库，CI 不调用收费模型；可保存**已授权**的固定结果作回归样例。

**验收门槛 A**
- 有可重复的离线基准入口和机器可读结果，覆盖至少 8 个不同设计场景；
- 所有结构非法样例必须被既有验证器拒绝；差异报告标注只读性质；
- 至少一次双人盲听演练形成报告、使用同一渲染设置；**未实际完成不得宣称此项通过**；
- CI 维持 `pnpm check`、Chromium `test:e2e` 成功。

### Phase B — 试听与配器判别力（最高优先级）

**分两步，而非一次替换整个音频模块。**

**B1 / 可替换的 Transport + Audio Adapter**
- 在 `packages/audio-engine/src/transport/` 内封装 `tick -> seconds`、`seek`、`loop`、`stop` 和状态转换；第一版保持现行固定 120 BPM / 4/4 映射，**禁止假装已经支持 tempo map**。
- `scheduler/` 使用统一时间基准进行精确调度；解决重复 play/stop、seek、撤销后预览失效、项目变化取消旧音符事件、AudioContext 资源释放。
- `adapters/` 可选 Tone.js Adapter，与原三角波 Web Audio Adapter 并存，便于 A/B 回退；UI 不直接操作第三方 transport。
- Playwright 验证用户手势触发、停止后无残留声音请求、候选取消后安全停止；虚拟时钟单元测试验证 tick/秒转换与同刻不同轨事件顺序。

**B2 / 音色与可重复渲染**
- 在 `instruments/` 建立“轨道 -> 音色 preset”的本地映射（初期仅试听配置，是否写入 MusicProject 另议）；设置独立增益、mute/solo，避免所有轨共享一种音色。
- 优先使用**授权明确的简单采样或合成 preset**；FluidSynth/js-synthesizer + SoundFont 另做 PoC 和 license review，不要自动打包未知来源 SF2。
- 固定渲染 `renderPresetId/version`、bpm、gain、sampleRate、起止位置；A/B 尽量做响度匹配而不是绝对波形逐字节一致。
- 现有 `midi-io` 导出头部固定 tempo 120，支持 tempo map 之前必须把该限制展示清楚；**不能由音频适配层私自修改导出语义**。

**验收门槛 B**：同一 Project 的多轨 Note On/Off 在虚拟时钟测试中按精确 tick 顺序执行；停止/取消/切换候选无悬挂调度；使用不同可授权音色完成听评重放；无额外修改 revision。任何需要新增 tempo/time-signature/core 字段的需求转入 Phase E 的独立 ADR。

### Phase C — 音乐上下文分析（高优先级）

- 现有 `tonality.ts` 保留为轻量快速分析；新增可选 `MusicAnalysisReport`（仅只读结果），标明 `method/version/confidence/evidence/insufficientData`。
- 先用纯 TS 明确 pitch-class、和弦窗口、声部密度、重叠音程的定义及 snapshot 测试。
- 若验证获益，再在本地独立进程/离线分析脚本引入 music21：调性候选、基于和弦聚合的段落特征、可解释的声部关系；**不把 music21 猜测的调性升格为硬规则**。
- Python sidecar 使用限量的音符 JSON 或 MIDI 快照；严格请求/响应 schema、超时、输入上限、音乐日志脱敏、拒绝模型或分析器回传工程命令。
- 分析失败时保留原有生成流程，展示“分析不可用/证据不足”，不得伪造和弦结论。

**验收门槛 C**：至少 8 个带人工说明的正反例中能输出可追溯的统计；无依据的调性返回 uncertain；analysis 不改变 Project、revision 或锁；sidecar 离线不可用时不会阻止现有 MIDI 编辑。

### Phase D — Composer's Assistant 式 LLM 可控补写与迭代优化（高优先级）

**D1 / 建立独立于模型的音乐属性及其可验证语义**
- 首批建议：`note_density`（每拍/小节起音密度）、`polyphony_limit`（最大同时发声数）、`register_range`（音域）、`duration_bias`（时值偏好）、`rhythmic_activity`（节奏活跃度偏好）。
- 所有 hard 控制需要确定性验证器和严格定义（计数、范围、时间边界）；不支持的 hard 控制在请求 LLM 前拒绝，不降级为提示词；advisory 只产生建议。
- 维持现有 `pitch_only`、protectedPrefix、protectedNoteIds、maxLeap、source/target、锁、HarmonyPlan、revision 与候选审批边界。
- UI 先允许用户审阅 LLM 提出的音乐属性草案；“更丰满”“更激昂”等主观表达不能自动变为未经用户批准的数值硬规则。

**D2 / LLM 音乐创作编排与有限反馈回路**
- 继续使用现有 `CompositionProvider` / `ArrangementProvider` 边界，AI 推理实现**仅使用通用 LLM**；可支持不同通用 LLM 服务，禁止引入专用音乐模型及 `SymbolicMusicProvider` 等独立模型接口。
- 将项目快照、源旋律、目标轨道与小节、上下文乐句、HarmonyPlan、受保护声部映射为有界的结构化 LLM 输入；将乐曲规划意图与 MIDI 音符生成分为可审核阶段。
- LLM 不可输出可信 note ID 或 ChangeSet，不得获得提交权限；继续使用 server/client 的 Schema 检查、Music Core dry-run 和显式批准流程。
- 失败时可按有限次数再请求 **LLM 新候选**，记录脱敏失败原因、时延与费用；不得放松 hard 约束、扩大范围、自动提交、无限重试或覆盖已批准轨道。
- 同一 LLM、同一输入和同一渲染设定下对比旧/新提示词、规划上下文与反馈循环；评测结构通过率、属性命中率、费用/时延与人工盲听结果，Seed 只作为变奏提示。
- 已有 SeededArranger 保留为规则演示与测试工具，不作为第二种 AI 模型或实际 LLM 音乐质量证据。

**验收门槛 D**：在单轨局部补写和三轨编配下，LLM 产出合规、可试听、可撤销候选；非法、越权和不受支持的 hard 要求被拒绝；提供真实 LLM 调用和盲听 A/B 证据；**不得引入、训练、部署任何专用音乐生成模型**。

### Phase E — 整曲曲式规划（在前序评测通过后）

- 借鉴高层结构控制的思想，先建立 `CompositionPlan` **候选草案**：`sections`（A/B/A' 等）、动机关系、各段能量走向、每声部角色、和声计划、配器意图、过渡策略。不要把生成器写成固定“先旋律后和声”的唯一流水线。
- 规划分两层：全曲纲要（段落）和局部 1–4 小节约束；结合现有 HarmonyPlan / generationHistory 逐段修订。跨段连接至少使用前后相邻的只读动机/节奏/和声上下文。
- **初期 Plan 只存在于待批准会话中**。若需长久保留曲式与乐器配置，先提出单独的 MusicProject schema 版本、JSON 迁移、MIDI 丢失字段声明、undo/provenance 语义，再获用户批准。
- 6/8、变拍号、tempo map、延长音/跨段编辑需要先实现正确时间轴，不能仅修改 prompt 或写一个“6/8”字符串。
- 按小段逐次生成、校验、试听及人审，而不是一次请求输出无界长度 MIDI。

**验收门槛 E**：至少一首有明确 A/B/A' 或等价段落结构的完整 MIDI 演示；段落重复/变化和过渡有可追踪标记，局部改写不破坏其他段落，工程 JSON 导入导出及撤销均可复现；人工听评单独报告是否达到目标。

## 5. 推荐 PR 切片（每一条是可独立评审的任务，不是已经完成）

| 顺序 | PR 建议标题 | 主要文件/职责 | 完成定义 / Gate |
| --- | --- | --- | --- |
| 01 | `test: add licensed MIDI evaluation fixtures and baseline reports` | `tests/music-fixtures/`、`tests/music-benchmarks/`、评测脚本与协议 | 可复现样本、授权记录、结构测试报告；不修改生产 Provider |
| 02 | `refactor(audio): isolate transport from WebAudio preview` | `audio-engine/src/transport/`、`scheduler/`、unit tests | 固定 120 BPM 行为等价；取消/停止资源正确释放 |
| 03 | `feat(audio): add preview instrument presets and A/B rendering` | `audio-engine/src/instruments/`、`adapters/`、少量 UI | 不改变 MusicProject；试听有独立音色与一致混音基准 |
| 04 | `feat(evaluation): export objective MIDI metrics with limitations` | `composition/evaluation/` 或离线脚本 | 指标定义/边界齐全、报告不输出伪审美分数 |
| 05 | `feat(composition): introduce capability-gated generation intents` | `composition/contracts/`、客户端控件、schema 检查 | 不支持 hard 的 Provider 在调用前拒绝；旧 API 全通过 |
| 06 | `feat(composition): add validated density and polyphony constraints` | arrangement validators、unit/E2E | 约束验证、冲突拒绝，锁/Note ID/undo/redo 回归全通过 |
| 07 | `feat(agent): add bounded LLM composition review and retry loop` | `services/agent-api`、`composition/contracts/`、测试报告 | 仅 LLM；错误解释、有限重试、不降级硬约束；同模型新旧 Prompt A/B 评测 |
| 08 | `docs(design): propose multi-section composition plan and migration ADR` | `docs/`，待批准后再变 core | 拍号/tempo/计划存储兼容性与测试矩阵；未批准不写运行时 schema |

每个 PR 应填写：需求与证据、授权范围、修改文件、协议变化、回滚开关、测试实际运行记录和仍未验证事项。建议早期**不要将上述八项合并为单个巨型 PR**。

## 6. 跨模块强制测试矩阵

| 类别 | 必须覆盖的用例 | 判定 |
| --- | --- | --- |
| 授权与安全 | 改动 locked track/note、选区边界外、source track、protected Note ID | 模型前可预检的先拒，所有非法候选在 commit 前拒 |
| 时间与音乐结构 | PPQ 非默认值；同 tick 和弦；重叠和跨边界音；休止；力度边界；长持续音 | tick 不丢失，权限不绕过，硬规则不被放宽 |
| 候选/撤销 | 两候选切换、重新混轨、stale revision、Abort 中断、局部 Seed 失败 | 不写入预览，合法候选仍可选，cancel 不改工程 |
| Provider | 输出格式错误、额外角色、输出 note IDs、截断超时、不支持 hard 控制 | 固定错误码或脱敏失败，不回传原始敏感消息 |
| 音频 | play/stop/seek/loop、预览切换、资源释放、同刻多轨调度 | 虚拟时钟验证；可重复听评 |
| 工程 I/O | JSON 含历史、MIDI 不含专用字段；导入后再次编辑；大密度边界 | roundtrip 一致，schema 版本明确，未支持字段显式说明 |
| 音乐听评 | 同输入、同渲染、盲化候选、不同听评人 | 留存原始结果和分歧，不将主观分数塞入 hard validator |
| 许可证 | 每个引入包、二进制、权重、SoundFont、测试 MIDI 的许可与来源 | 不明来源不得随发行物分发 |

**现有 CI**：`pnpm install --no-frozen-lockfile`、`pnpm check`、`pnpm --filter @ai-composer/web test:e2e`。本 PR 仅新增文档，不声称执行任何模型实际调用、音乐听评或本地安装。后续若加入 Python sidecar，应新增单独的可缓存离线测试 Job（禁止下载大型模型或使用真实密钥作为常规 CI 依赖）。

## 7. 明确的技术/许可风险与回退

1. **专用音乐模型禁令**：D-005 已禁止 MIDI-GPT 等专用音乐生成模型、权重、推理 sidecar 和相关实验。仅比较通用 LLM 生成策略；音乐分析、MIDI 工具和音源合成可根据其技术与资源许可独立选择。
2. **SoundFont 与库分开**：FluidSynth [LGPL FAQ](https://github.com/FluidSynth/fluidsynth/blob/master/doc/wiki/LicensingFAQ.md) 明确库与输入文件许可是两回事。js-synthesizer 发行的 externals 另核；改用预设合成器/授权采样作为回退。
3. **music21 corpus**：代码 BSD-3-Clause，但 bundled scores 不一定统一许可；测试先用原创乐段，报告不携带不明来源原始 MIDI。
4. **GPL 参照污染**：只学习 LMMS 产品交互，不复制 GPL-2.0 源码、资源或 UI 资产；引入代码前必须做法务/许可证兼容审查。
5. **复杂拍号和项目格式迁移**：现阶段 `MusicProject` 只有 PPQ/轨道，不存在正式 tempo/time-signature map。未通过独立 ADR 时仅支持已有 4/4、固定 tempo 口径；对不支持输入明确拒绝或告知限制，绝不“猜测换算”。
6. **分析 sidecar 可用性**：music21/MusPy 等只读分析/评价工具以超时、限量、脱敏和功能开关隔离；分析服务宕机不得影响现有 LLM 编曲或 MIDI 编辑，且不得部署专用音乐生成模型。
7. **质量不确定性**：更严格的结构规则可能压制部分音乐风格；默认把复杂音乐建议当软诊断。只有明示的用户 hard 约束才能触发硬拒绝，且必须能被完整机器验证。
8. **性能**：分轨/分窗增量检查；离线指标异步调用但不影响 Music Core 的审批一致性；不要在主线程进行耗时模型推理或海量 SoundFont 初始化。
9. **安全**：服务维持 loopback 原型限制；公网部署需鉴权、CSRF/Origin、配额、Rate-limit、音乐数据脱敏和用户数据处理规则；更换通用 LLM 服务提供方亦须遵守。

## 8. 推荐下一步与决策点

- **先做 PR 01（基线 + 评测协议）和 PR 02（音频时间轴隔离）**，这是后续模型效果有无改善的证据基础。
- **待审议的问题，不擅自裁决**：
  1. 正式验收主要目标是“游戏 BGM 的可编辑 MIDI 编曲”还是更通用的多风格音乐工作台？两者的音色、曲式与评测语料不同。
  2. 是否接受**仅在可选分析/离线评测服务**中使用 Python（music21、MusPy），核心与 Web 仍保持 TypeScript？这些服务不得用于音乐模型生成。
  3. 音色是纯本地授权采样、用户自行导入 SoundFont，还是将来配套分发经审查的 SoundFont？
  4. 是否允许将乐器配置、曲式及 tempo/time-signature map 纳入未来版本的 `MusicProject`？需要另做 schema/兼容性决策。
- 即使上述问题尚未裁定，**不阻塞 Phase A 的只读测试基线工作**；但不要把未定事项写成 accepted。

## 9. 参考与溯源（2026-10-22 核验）

- 本仓库：[Music Core](../packages/music-core/src/model/types.ts)、[局部重编](../packages/composition/src/arrangement/regenerate-region.ts)、[批量候选](../packages/composition/src/arrangement/region-variants.ts)、[AI adapter](../services/agent-api/src/providers/openai-arranger.ts)、[音频试听](../packages/audio-engine/src/playback/preview.ts)、[实施状态](IMPLEMENTATION_STATUS.md)、[AGENTS](../AGENTS.md)。
- [Composer's Assistant v2 项目](https://github.com/m-malandro/composers-assistant-REAPER) 及发行说明：针对多轨 MIDI infilling 的参数控制（MIT 源码；发行资产需另核）。
- [music21 BSD-3-Clause 与 corpus 说明](https://github.com/cuthbertLab/music21)。
- [MusPy metrics](https://github.com/salu133445/muspy/blob/main/doc/source/metrics.rst) 与 [MIT license](https://github.com/salu133445/muspy/blob/main/LICENSE)。
- [Tone.js](https://github.com/Tonejs/Tone.js)、[Transport](https://github.com/Tonejs/Tone.js/wiki/Transport)。
- [FluidSynth LGPL](https://github.com/FluidSynth/fluidsynth)、[许可 FAQ](https://github.com/FluidSynth/fluidsynth/blob/master/doc/wiki/LicensingFAQ.md)、[js-synthesizer](https://github.com/jet2jet/js-synthesizer)。
- [LMMS](https://github.com/LMMS/lmms)：作为 GUI/工作流参考，不移植其 GPL-2.0 实现。

**本文实施阶段均为待评审提案，但“仅用 LLM 生成 AI 音乐、不引入专用音乐生成模型”已按 D-005 正式确定。本次修订不涉及应用代码、依赖或真实听评。**
