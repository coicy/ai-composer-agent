# AI Composer Agent：电子音乐三层能力研究与落地路线（2026-10-24）

> **状态：研究性工程提案，未获得独立产品裁决；无新代码或音频生成。** 源码核验基准：main = \`bd425b50f1586e856aa0c2334d79f506c4490f1a\`；尚未合并的 MCP/参考/随机灵感 PR #18–#23（尤其 #19 \`a06a9ed7\`、#21 \`de79e7ac\`、#23 \`aefc79da\`）。沿用已批准 D-005/D-006/D-007：通用 LLM 是 AI 音乐创作主体；MCP First；Music Core 锁、作用域、revision、预览、人工批准、撤销不可跳过。
>
> **重要边界：** “电子乐”是多风格、多制作工艺集合，不存在一套等价于所有电子流派的鼓型/音色。以下曲风示例是工程验收目标，不是声称具有精确音乐学鉴定能力。曾获得用户积极试听反馈的是 B/C 的 D Dorian + Shuffle 作品，不能当作 House/Trance/Techno 能力证据。

## 总判断

| 领域 | 仓库已经确实具有的能力 | 缺失/受限 | 后果 |
|---|---|---|---|
| **作曲 Composition** | 可编辑 MIDI 旋律；单轨续写/局部变体；种子演示；HarmonyPlan；三角色伴奏；LLM 创作协议草案/部分 MCP | 主分支未拥有完整的节/段、反复/发展、能量曲线和可靠的跨段风格组织；HarmonyPlan 只接受 \`major/minor\` 且最多 4 小节、4/4 语义；未实现完整段落一致性评估 | 可能在短句音级正确，但无法生成连续且可识别的长段落电子音乐 |
| **技法 Technique** | 声部角色 /音级与和弦检查；实验分支中通过真实 stdio 实现参考检索与确定性调式、offbeat 检查；PR #23 有原创种子灵感卡 | 正式的 ARP / Ostinato / Drum Pattern / Bass Pattern / Groove Map / Fill / 与声部互让的 TechniquePlan 缺席 | “House、Shuffle、Techno”等词汇缺少对应的可执行音乐组织机制 |
| **制作 Production** | \`audio-engine\` 用 Web Audio \`OscillatorNode\` 进行最小试听；MIDI 基础读写；实验 PR #22 经 FluidSynth 渲染 MP3 | 所有音符固定三角波音色，无独立鼓机/合成器预设、音频路由、滤波包络、自动化、Sidechain/ducking、离线一致性渲染。MusicProject 未存乐器、FX、automation、tempo/time-signature map；MIDI 导出固定 120 BPM | 电子乐最关键的音色、运动和动态混音难以表现甚至难以重现 |

**三个层面的成功必须分别判定：** 作曲结构合规不是技法运用；技法相位符合不是 groove 自然；MIDI 合规不是声音制作成功。

---

## 第一部分：作曲能力（写什么音乐）

### A1. 当前核验

1. \`packages/music-core/src/model/types.ts\`：MusicProject 只有 projectId、revision、ppq、tracks、generationHistory；MidiNote 只有 pitch/start/duration/velocity/lock，没有正式的 Song Sections、TempoMap 或 TimeSignatureMap。
2. \`packages/composition/src/planning/harmony-plan.ts\`：\`mode:'major'|'minor'\`；和声事件为 quarter-note beat；\`validateHarmonyPlan(barCount)\` 限制 1–4 小节，常量小节长度 4 拍。跟实验 PR #21 的 Dorian 和 6/8 约束并未统一。
3. \`packages/composition/src/generators/melody.ts\`：现有本地 seed 三类旋律 \`steps/leaps/motif\` + 固定八分音符时值/固定大调音级；属于离线规则示范，不是风格化 LLM 能力证明。
4. \`packages/composition/src/arrangement/arrange.ts\`：三个固定 \`harmony,bass,accompaniment\` 角色、最多 4 小节/候选、每轨 1–64 音符、最多 128 音符总量；并不等于全曲 Kick/Bass/Lead/Pad/FX 编制。
5. PR #19 44 条参考只含 **28 条鼓组**、8 条 Public Domain 乐谱和 8 条 CC0 Chiptune；其中明确标记 \`dance/disco\` 1 条与 \`dance/breakbeat\` 1 条，**缺少多独立作者的完整电子乐编曲与声音特征资料**。不可把乐谱 PD 或 Chiptune 用途标签直接推断为 Techno/Trance 的听感类别。

### A2. 缺口不在“电子乐流派标签”，而是结构化创作语义

引入版本化的 \`CompositionBlueprint\`（拟议数据契约，**先作为待批准会话的计划对象**，不立刻写 MusicProject）：

- \`intent\`：用户指定的 genre / substyle / mood / game-use（相互独立），允许 \`unspecified\`，一切来源标签携带 evidence 与 provenance；风格只作为偏好，未经批准不升格为硬约束。
- \`timeline\`：TempoMap、MeterMap、Bars、Sections 的同一 Tick 基准；支持固定速度为首版的向后兼容口径，然后迁移到正式 map。
- \`sections\`：intro / groove / development / transition / climax-or-drop / break / outro，自由命名、起止 tick、能量曲线、声部加入与退出、重复/变化关系；**不是规定每首 House 都必须 Drop**。
- \`motifLinks\`：动机 ID、复现方式、节奏/音程变奏，附可审核的乐句上下文；用户保留对旋律/和声的权威修改权。
- \`harmony\`：借用/已确认的和弦进程，和每事件 ChordPitchSet、Voicing 与调式区分；Dorian 是音乐要求，不能被旧 major/minor Plan 默认为 D natural minor。
- \`energyPlan\`：以声部活动数、节奏密度、音区、力度与**制作层滤波/音色参数**分解音乐发展；不要把“更强烈”简单解释为添加音符。

**建议两层规划：** 全曲意图（8–32 小节或用户指定）+ 受控的 1–4 小节局部生成。现有短窗口保留，靠持续 section/motif ID + 相邻上下文实现连续性，避免一次让 LLM 输出大量音符导致超限。

### A3. 作曲侧的具体电子乐能力

| 子能力 | House 简化用例 | Synthwave 简化用例 | 可观察验收 |
|---|---|---|---|
| 节拍/和声功能规划 | 循环和弦与反拍和声/低音互动 | 稳定和声与大范围音区衬底 | 预期和弦事件与实际 MIDI 区间对应 |
| 主题与动机发展 | 2/4/8 小节 riff 的小幅变化 | 重复琶音与歌唱 lead 的问答 | motif ID 可追踪、反复中有明确变奏与回归 |
| 段落组织 | groove-A / variation / break / return | intro / theme / contrasting phrase / reprise | 各段有声部和密度对比，连续性不被重置 |
| 能量塑形 | 更改鼓组、Bass 与和声音型互动 | Layer 的加入/移除与 Pad 强弱 | 结构化层数/起音密度/能量演进曲线有证据 |
| 风格完整性 | 不能只靠来源标签声称“House” | 不能只靠 saw 波称“80s” | 独立听评，不用模型自评取代 |

**验收基准 A：** 两个独立题目，各生成 16 小节 / 4–6 声部的完整可编辑 MIDI（依照分段候选推进）；同题目有“无蓝图”与“有蓝图”隔离实验；记录结构断裂、旋律重复/变化、合法率和不通过次数；人工盲听按段落逻辑、主题辨识度评分。

---

## 第二部分：技法能力（如何组织音符/声部）

### B1. 引入可组合的 \`TechniquePlan\`

沿用 [基础技法搭配提案](ARRANGEMENT_TECHNIQUE_COMBINATIONS_V1.md)：单轨每个非重叠窗口至多一项 Primary 技法（例如 Arp 或 Comping），可叠加 ExpressionModifier；不同轨通过 \`ArrangementCombinationPlan\` 设定负责脉冲、低频、运动和声、持续和声、旋律主焦点、Fill 的职责。软审美冲突报警，硬权限/占位冲突拒绝。

电子乐 P0 最小清单（全都是计划/校验器，**不是另一个 AI MIDI 生成模型**）：

| 技法族 | 模式/控制项 | 主用途 | 可验证证据 |
|---|---|---|---|
| \`drum_pattern\` | kick/snare(or clap)/closedHat/openHat/percussion lanes；16/32 step、meter、accent、fill windows | House、Synthwave、简化 Techno | GM drum map/语义 drum lane、发音时间与预期 mask 对齐 |
| \`bass_pattern\` | root/offbeat/octave/syncopated/approach、note length、sub register、kick clearance | Kick/Bass 互补 | 起音格、和弦根/目标音、重叠风险 |
| \`arpeggio\` | ascending/descending/pingpong/Alberti、rate、octave、gate、restartOnChord | Synthwave/Trance/Chiptune | 和弦音集合、pitch order、和弦事件转换 |
| \`ostinato\` | motif ID、cycleTicks、repeat/variation windows | Techno/游戏 loop、Arp 骨架 | 周期/重复一致性与指定变奏窗口 |
| \`syncopated_comp\` | offbeatMask、gate、voicing、velocity contour | House/R&B 等切分和声 | onset grids/重音、声部音域 |
| \`pad_pedal\` | sustained chord vs single-note drone、start/end/change policy | Synthwave 氛围/持续张力 | 时长/根音/和弦改变后的延音策略 |
| \`fill_transition\` | transitionWindow、allowedPattern、densityBudget、resolution | 进出段/Build-up/Break | Fill 限定窗口、下一段边界恢复 |
| \`groove_template\` | per-lane timing offsets and velocities、sourceEvidence、strength、seed | 不同鼓组独立微时差、Shuffle/Breakbeat | 逐声部起音相位及力度偏移；**绝不视为“风格证明”** |

关键工程点：

- 将时值表示为以 \`ppq\`、有效 \`meter\` 为基准的 tick 网格，避免所有网格写死四分拍。4/4、6/8 和非默认 PPQ 都必须做单元测试。
- 强化 \`drum lane\` 身份，解决当前 MusicTrack 没有 instrument / channel / drum marker 的问题。仅靠某些 pitch 数字无法判断当前 MIDI 是否在 percussion channel；DAW 渲染需要显式鼓组映射。
- 同一轨道同一时间的 arp 与 Alberti、两个 bass primary 是**硬冲突**；多轨 Lead + Dense Arp + Dense Fill 为**软报警**；将跨和弦、力度密度、声部侵入与现场试听分开处理。
- \`rhythm_pulse\` 与 \`groove_template\` 是不同层：前者规定 kick/hat/snare 的实际节奏；后者规定 timing/velocity 微偏移。Swing/Shuffle 不能仅由 2:1 检定。
- 技法可由种子 \`music.draw_inspiration\` 提示，但 soft card 不自动转换为 hard 的 \`TechniquePlan\`，否则创意随机会突破授权。

### B2. 三个具体、可听的技法验证案例（不是固定音乐风格定义）

**T-House（4/4，480 PPQ，示例小节 tick [0,1920)）：**
- Kick 起音 0/480/960/1440；
- Clap/Snare 以 480/1440 为基础选择；Closed Hat 可以用八分格，Open Hat 可在 240/720/1200/1680；
- Bass 只在用户确认的范围选择与 Kick 互补的短起音；Rhodes/Synth Stab 在指定 offbeat 窗口击奏；
- 用户固定的主题 Lead 保留，四小节末可以小 Fill 并降低其他声部的占用；
- 验收：真实四声部不同轨的 timing、段落、合法音域/音符数量，不把这些模板误称为专家判断的 House。

**T-Synthwave（4/4，480 PPQ）：**
- 音符基本素材/和弦固定；Synth Pluck 的有序八分琶音在音区中高部分流动，Pad 长音、Octave Bass 与 Lead 跨段接力；
- 允许一个清晰的 4/8-bar 反复和低密度 break，而不是各轨同刻持续繁忙；
- 后续制作层需要 saw/pulse 波形、滤波器包络、chorus/delay 等才能评价实际音色。

**T-Drum/Break（独立于鼓机音色）：**
- 来源引用只提供一个 \`dance/breakbeat\` 的标签样本；不能得出“完整 DnB 参考库”；
- 检查交错 kick/snare 与 16th subgrid 的确切位置、短 Fill、声部节奏偏移，后续增加不同演奏者和制作人独立参考；禁止版权不明的经典 Break 音频未经授权纳入发行。

**验收基准 B：** 每个 TechniquePlan 具有 stable id、schema/参数上下限、适用 meter、register / onset mask / intensity、主技法冲突表、来源许可字段（若借用参考），以及至少一项正例、边界例、违规例。分四小节运行，不以增加音符数量作为效果得分。

---

## 第三部分：制作能力（如何真正发声）

### C1. 当前无法被 MIDI 表示的制作信息

\`audio-engine/src/playback/preview.ts\` 对每个音符新建 triangle oscillator + gain，默认 120 BPM；无乐器区分、鼓组采样、滤波器、FX、控制器及可重复的离线渲染。\`midi-io/src/mapping/midi.ts\` 导出强制 \`midi.header.setTempo(120)\`，不会保留原 tempo/time-signature/program-change/CC。工程模型不存这些属性。实验 PR #22 的 FluidSynth/FFmpeg 仅为外部离线试听实验，不等于浏览器制作功能已实现。

**这对电子乐最严重：** Techno 的发展可以主要来自滤波和音色变化；House 需要 Kick/Sub 与带 ducking 的 Bass/Pad 关系；Synthwave 需要合成器与 Chorus/Delay 的音色组合。只有合法的 MIDI note events 并不能呈现这些制作特征。

### C2. 两条并行而不互相拖累的制作路径

**路径 1 — 外部 DAW，最快获得可信音色结果：**
- 由 Composer Agent 输出多轨 MIDI、正式 tempo/meter header、GM 兼容乐器/鼓 lane 或可映射 stem role，以及 \`ProductionPlan.json\` 描述预设和效果意图；导入 Ableton/Reaper/Bitwig 等，由人选定合法音源渲染。
- 优势：不需要立刻内建专业合成器/混音平台；让 AI 作曲与可听质量评测更快获得有效反馈。
- 限制：标准 MIDI 文件不包含 DAW 独有 VST 插件参数、效果链、自动化语义等，必须输出 sidecar JSON，或受控导出相应 DAW 工程格式（后者是独立长期工作）。

**路径 2 — 浏览器内的基础可重复试听，作为可选的产品发展：**
1. \`Transport/Scheduler\`：Tick ↔ seconds 基准、节拍与拍号（先固定值可回退，扩展版本化 map）、播放/暂停/循环/停止、候选/撤销时取消旧调度；同轨/跨轨同时事件按确定顺序。
2. \`InstrumentPresetRegistry\`：精简内置 Oscillator Synth（sine/saw/square/pulse；ADSR；单声/多声；portamento）、简单 Drum Kit（可审核的轻量样本或合成鼓）、Synth Bass、Pluck、Pad、Lead、Noise FX。每个 Preset 带版本、音域、参数范围和授权状态。
3. \`SoundDesignPlan\`：对安全的 typed 参数引用 \`{trackId,presetId,params}\`；同一 track 增益/pan/mute/solo、基础 Filter 与 envelope、必要的 Chorus/Delay/Reverb。
4. \`AutomationPlan\`：节/拍/tick 关键点，参数 \`cutoffHz\`、\`gainDb\`、\`resonance\`、\`delayWet\` 等白名单、范围、插值 \`step|linear|exp\`；段落 Build-up/Break 可复现。区分自动化（时间线上存点）与 modulation（LFO 等额外调制）。
5. \`Kick/Bass ducking\`：第一版可用用户明确选中的 Kick 时间表创建 tempo-synced **gain envelope ducking**（不声称是 audio-triggered compressor）；第二版在底层能力成熟后建立真正 sidechain compressor。提供峰值增益下降/恢复 envelope 可测，声学效果仍试听。
6. \`OfflineRender\`：固定 samplerate、presets、renderer version、seed、bpm、peak guard、分轨渲染和最终音频；跨次试听采取合理响度匹配。SoundFont/采样必须先审版权，内部示例可自合成不依赖限制不明的二进制素材。

Web Audio 原生 \`OscillatorNode\`、\`GainNode\`、\`BiquadFilterNode\`、\`DynamicsCompressorNode\`、\`AudioParam\`、\`OfflineAudioContext\` 已足以实现初级音色、滤波与自动化；可在 Audio Adapter 层评估 Tone.js 的 FMSynth/PolySynth/Sampler/Effects，**但不直接把 Tone 对象存到 Music Core JSON**。

### C3. 建议数据边界（研究契约示意）

\`\`\`json
{
  "version": "production-plan-v1",
  "scope": {"startTick": 0, "endTick": 30720},
  "timebase": {"ppq": 480, "tempoBpm": 120, "meter": [4, 4]},
  "trackPresets": [
    {"trackId": "kick", "presetId": "drum-kick-basic-v1", "gainDb": -8},
    {"trackId": "bass", "presetId": "mono-bass-saw-v1", "params": {"cutoffHz": 750, "attackMs": 5, "releaseMs": 150}},
    {"trackId": "arp", "presetId": "pluck-analog-v1", "params": {"filterQ": 0.7}}
  ],
  "automation": [
    {"target": {"trackId": "arp", "param": "cutoffHz"}, "points": [
      {"tick": 0, "value": 650},
      {"tick": 15360, "value": 3600}
    ], "interpolation": "linear"}
  ],
  "ducking": [
    {"sourceTrackId": "kick", "targetTrackId": "bass", "mode": "scheduled_gain_envelope", "depthDb": -4, "releaseMs": 190}
  ]
}
\`\`\`

仅为 **AI 提议并由服务器和用户审查的声明式计划**；不得允许任意 JavaScript、URL 或 VST 路径由模型自由执行。参数 ID、范围、预设和版本均需白名单。轨道锁、revision、有效时区（Tick）、数字边界、NaN/Infinity、循环依赖和音频资源释放必须在 apply 前检查。此方案不自动写入 MusicProject，核心 schema 扩展要独立 ADR/迁移测试。

**验收基准 C：**
- MIDI roundtrip：BPM/meter、drum lane/program 和以音符为主的基本内容无意外漂移；不支持的 CC/automation 明确标注“不保留”，不静默丢弃。
- Track presets：相同 MIDI 的 Pad/Bass/Pluck 可以听出明显不同的发音包络与音色；同一配置可离线重新渲染。
- Automation：cutoff/keyframes 在准确 Tick 生效；停播、撤销、切换候选没有残余滤波/失效 oscillator。
- Ducking：Kick 触发相关时间窗 Bass Gain 可记录到明确下降和恢复；区分预计算鸭音量和真实 Sidechain 压缩。
- 允许用户导出多轨 MIDI + 可选单独 stem/参考 WAV，不允许不清楚授权的音源被自动打包分发。

---

## 三层综合设计与推进顺序

\`\`\`text
User Intent (genre facets / mood / game scene / instrument expectations)
          |
          v
CompositionBlueprint    (sections, harmony, motifs, energy, tempo/meter)
          |
          v
TechniqueCombinationPlan  (groove, drum, bass, arp, pad, fill, conflicts)
          |                            |
          v                            v
EXTERNAL general-purpose LLM       ProductionPlan (preset, FX, automation)
          |                            |
          v                            v
MIDI candidate + diagnostics   Approved/preset-resolved render context
          |                            |
          +--------------+-------------+
                         v
           MUSIC CORE dry-run / USER approval
                         |
                         v
           Audio preview / external DAW export
                         |
                         v
           Technical metrics + blinded listening
\`\`\`

**原则：** 技法是音乐组织手段；制作参数是可重复的音色与自动化数据；LLM 负责实际创造音乐。每一层可独立通过/失败与回退；所有输出带 schemaVersion/provenance/seed（若有）且遵守批准边界。

### 交付 PR 切片（建议依赖先后，不是并行大改）

| 顺序 | 模块 | 最小交付 | 不通过时回退 |
|---|---|---|---|
| S0（先行） | \`MusicTimebase\` 与 instrument metadata ADR | 审核 MusicProject Schema v2；tempo/meter/role/drum/patch/CC 在 JSON/MIDI 的可保留性与迁移口径；原文件回归 | 暂时只用固定 120 BPM 4/4 且明确显示限制；不假装已修复 |
| S1 | \`TechniquePlan\` | Kick/Snare/Hat、Bass、Arp/Alberti/Comp/Pad/Ostinato/Fill、槽位冲突与 4/4/6/8 测试 | 退回文本创作提示，不擅自改写 |
| S2 | \`CompositionBlueprint\` | 16 小节分段、主题 ID、和声/密度/能量规划，短窗口连续创作 | 局部 1–4 小节候选单独批准 |
| S3 | \`SoundDesignPlan\` + Audio Adapter | 4–6 个内置合成/打击乐预设、gain/filter、可听 A/B、多轨 MIDI/DAW 导出 | 退回已有三角波试听及外部 DAW 渲染 |
| S4 | \`AutomationPlan\` + Ducking | cutoff ramp、LFO、简单 Delay/Chorus、time-aligned gain ducking；license checklist | 无自动化安全预设和固定效果器 |
| S5 | 电子乐曲风基准 | House/Synthwave 2 个风格，各无结构 / 结构 / 技法 / 完整制作组合隔离比较 | 只有基础 MIDI 与盲听不足结论 |

**关键依赖图：** timebase 和 track identity 是三个层面共同前置条件；TechniquePlan 和 Blueprint 能先独立设计，但实际渲染/导出必须使用同一个权威 Tick timebase；SoundDesignPlan 不应硬编码进 MIDI 音符结构中；自动化离开有版本的 preset/renderer 就不可复现。

### 推荐实验——先两条风格，而不是立即扩大风格标签

**House 验收（电子节奏/制作基础）：**
- 16 小节 4/4，固定 120–125 BPM（用户最终决定）、Kick/Clap/Hat/Bass/ChordStab/Lead 至少角色明确；核心四拍 groove、Bass-offbeat 与和弦声部互动；中间一次明确编配减法和回归。
- 比较 E0：仅 MIDI 和原试听；E1：启用 TechniquePlan；E2：加有版本的 synth preset；E3：加已获批准的滤波与 scheduled ducking。先检测每个阶段独立收益，再进行匿名听评。
- 验收目标：节拍及 Bass 严守 tick 与已声明的和弦/范围；补充每轨独立音色，可独立导出；音乐是否真正像 House，由听者评价。

**Synthwave 验收（和声/音色/琶音基础）：**
- 16 小节，固定主旋律与和弦，Pluck Arp + sustained Pad + Mono/Octave Bass + Synth Lead + 鼓组；一段对比或短休止。
- 比较无明示技法、有琶音/Pad组合、有真实合成器预设、有 Chorus/Delay/filter automation；主旋律和和弦固定以避免假效果。
- 不以演示里的三角波 MIDI 试听判定完整电子音色品质。

**风格对照资料计划：**
- MIDI：独立按 Drum Groove、Bassline、Chord/Arpeggio、Arrangement Form、Automation/Sound Preset 五维寻找 CC0/CC BY 或许可明确的真实数据；\`license\`、URL、原作者、哈希和引用修改范围单独记录。不能只拿 1 首 Disco MIDI 假定 House 数据够用。
- 制作参考必须和 MIDI 标注分开：**MIDI 通常不携带合成器补丁细节**。音色/FX 预设的开源许可与演奏作品版权还需要独立审核。
- 电子乐风格“典型”不能由 LLM 自我判断；独立试听者标注风格贴近度及作品适用性，保留评分差异。

## 衡量结果与验收门槛

| 一级类别 | 确定性机器指标 | 不可替代的主观指标 | 推荐 Gate |
|---|---|---|---|
| 作曲 | 时间轴、段落起止、主题 ID、和弦/调式音、跨段变奏及有效候选率 | 旋律记忆性、段落逻辑、能量起伏 | 至少一首 16 小节作品与对应结构对照；全段可编辑与撤销 |
| 技法 | Kick/snare mask、Arp 订单、Bass 相位与音区、衔接、单轨冲突、合法 MIDI | groove 自然度、配器分工与律动贴合 | 两种实际技法、固定素材对照；不因技术过关宣布“好听” |
| 制作 | 合成器/鼓样本选择、音色参数、Tick automation、gain/duck envelopes、渲染版本/资产许可 | 音色质量、低频干净度、空间/响度与风格贴近度 | 同一 MIDI 可以用两个显著不同的 presets 重渲染，自动化可听且参数曲线可复查 |
| 系统 | 用户锁、session、scope、revision、dry-run、显式 approval、undo/redo、非可信 LLM 参数拒绝 | 创作可控性和用户工作流 | 所有已存在 MCP/Core/Playwright 回归不退化 |

## 研究依据（官网 / 已核验源码）

- Web Audio API (MDN): <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>；高级合成/滤波/调度：<https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques>
- Tone.js v15 API：<https://tonejs.github.io/docs/15.0.4/index.html>。提供 Synth、FMSynth、Sampler、Filter、Envelope、Compressor、Chorus、Distortion 等可作为 Adapter PoC。
- Ableton Live 12: MIDI Tools <https://www.ableton.com/en/live-manual/12/midi-tools/>，区分 Arpeggiate/Strum 等 MIDI Transformations 与 Rhythm/Seed/EUclidean 等 Generators。
- Ableton Live 12: Grooves <https://www.ableton.com/en/live-manual/12/using-grooves/>，Groove 可施加 Timing/Velocity，单独对鼓组声部应用；对应时间偏移 ≠ 单一 Swing 标签。
- Ableton Live 12: Automation <https://www.ableton.com/en/live-manual/12/automation/>，曲目参数随时间变化是正式的制作数据。
- Ableton Live 12: Racks <https://www.ableton.com/en/live-manual/12/instrument-drum-and-effect-racks/>，信号链与并联设备架构。
- Ableton Live 12: Compressor sidechain <https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/>，Kick/Bass ducking 的真实声学作用。
- 项目源码：\`packages/music-core/src/model/types.ts\`、\`packages/midi-io/src/mapping/midi.ts\`、\`packages/audio-engine/src/playback/preview.ts\`、\`packages/composition/src/planning/harmony-plan.ts\`、\`packages/composition/src/arrangement/arrange.ts\`、\`docs/DECISIONS.md\`（当前 main 和 PR23 分支，经 GitHub API 校验）。
- 既有设计：[ARRANGEMENT_TECHNIQUES_RESEARCH.md](ARRANGEMENT_TECHNIQUES_RESEARCH.md) 和 [ARRANGEMENT_TECHNIQUE_COMBINATIONS_V1.md](ARRANGEMENT_TECHNIQUE_COMBINATIONS_V1.md)。

**没有发生的工作：** 未实现 \`CompositionBlueprint\`、\`TechniquePlan\`、\`SoundDesignPlan\` 或 \`AutomationPlan\`；未引入 Tone.js；未生成新的 House/Synthwave 音频；未修改 MusicProject Schema、未合并已有 PR、未进行新的独立盲听。所有规划为待用户审核的设计建议。
