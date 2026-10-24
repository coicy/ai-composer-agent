# AI Composer Agent：编曲基本手法与技法引擎调研（提案）

> 2026-10-24。**研究与设计提案，非已批准产品裁决，未实现新技法引擎。** 核验对象是功能分支 `feat/seeded-musical-inspiration` 的提交 `aefc79da78736088ed572b3ec0776e49e9fc86cc`，不是 `main` 当前已发布能力。独立文档 PR 不修改已批准的 D-005 / D-006 / D-007。

## 1. 核心诊断：音高合规 ≠ 会编曲

现有工程有音符级数据、`HarmonyPlan` 和弦事件、候选生成及 dry-run 验证、三轨分配与种子变体，却仍缺少在 **同样和弦材料之上形成可控音乐织体** 的显式中间层。

| 层次 | 现有能力与确切证据 | 缺口 |
|---|---|---|
| 和声材料与时序 | `packages/composition/src/planning/harmony-plan.ts`：tonic/mode、degree、三和弦/七和弦、timeline、转位、音阶/和弦检查 | 仅 major/minor；timeline 以四分音符为单位，最多四小节 4/4；缺独立和弦 VoicingPlan |
| 声部分配 | `packages/composition/src/arrangement/arrange.ts`：harmony / bass / accompaniment 三角色，受限音符候选、原子预览 | role 是**职责**，不是 “琶音 / 柱式 / 走句 / 分解伴奏”等可审核演奏技法；三轨音符数最大各 64、全体 128 |
| 演示生成 | `packages/composition/src/arrangement/seeded-arranger.ts` 第 69–105 行：timeline 时每拍一个音，否则每两拍一个音；按相近音高、合法音级和随机力度取样 | 没有有序音型循环、乐句间变化、真实四声部连接、演奏法/重音模型；这是离线规则演示，不是可代替通用 LLM 的作曲引擎 |
| 随机灵感 | `packages/composition/src/planning/inspiration.ts`：六维文本创意卡 | 卡只要求 Agent 试用某手法，不保证 MIDI 符合该手法，且目前没有“选中技法—应用—检查”的结构化协议 |
| MCP 创作要求 | `services/agent-api/src/mcp/composition-guide.ts`：用户声明调式 / 拍号 / groove、附参考和灵感，验证音符及时间目标 | **没有** technique id、style pattern、note order、重复周期、hand/role、填充策略或可追溯的技法检测结果 |
| 静态评价 | `packages/composition/src/evaluation/arrangement.ts`：音区、声部交错、紧张音程、跳进等 | 不能判断「声部真的形成琶音/固定音型/反复音型/问答结构」；也不能评判审美 |

**建议的结构：** `HarmonicMaterial → VoicingPlan → TechniquePlan / RhythmPattern → LLM MIDI Candidate → Music Core Validation → Listening Review`。其中 `TechniquePlan` 是对通用 LLM 的有类型要求和可解释核验，并非新增专用音乐模型，也不应通过随机 MIDI 生成取代模型。

## 2. 技法分类：不能把“手法”简单等同于风格

优先度是**建议开发顺序**，不是音乐艺术价值排名。

| 层级 | 技法与英文 | 典型用途 | 初版最小控制项 | 优先级 |
|---|---|---|---|---|
| 和弦演奏 | 分解和弦、琶音 Broken chord / Arpeggio | 竖琴、钢琴、合成器流动伴奏、动机铺垫 | chord tones、order、rate、gate、octave、restart | P0 |
| 和弦演奏 | 阿尔贝蒂低音 Alberti bass、交替低音 | 古典/轻快键盘音型 | pattern=low–high–mid–high、register、meter | P0 |
| 和弦演奏 | 柱式和弦 Block chords、节奏击奏 Comping | 明确和声重音、吉他或键盘伴奏 | voicing、attack pattern、gate、accent | P0 |
| 和声织体 | 持续和弦 Pad、持续低音 Pedal point / Drone | 氛围/悬念/调式中心 | sustain、change policy、range、dynamic arc | P0 |
| 重复织体 | 固定音型 Ostinato | 游戏音乐循环、持续运动感 | motif length、repeat count、variation policy | P0 |
| 低音写法 | Root–Fifth、Octave bounce、Walking bass | 低频脉冲、Shuffle/摇摆、和声衔接 | onsets、root/inversion、approach rules、groove | P0–P1 |
| 节奏/演奏 | Syncopated stab、Anticipation、Fill | 切分、预示和声、段落衔接 | onset mask、phase/beat accent、fill window | P0–P1 |
| 多声部 | Voice leading、近距离与开放排列、声部交换 | 减少声部无目的跳动，清晰和声层次 | voicing assignment、max leap、common tones | P1 |
| 多声部 | Countermelody、Call and response | 第二旋律、主题回答、旋律接力 | occupied register、rest windows、motif relation | P1 |
| 旋律加工 | Passing/neighbor tones、Suspension、Appoggiatura | 装饰、悬置解决、乐句运动 | dissonance context、resolution、scope | P1 |
| 结构发展 | Sequence、Augmentation/Diminution、Inversion、Reprise | 动机发展与段落推进 | motif id、interval/rhythm transform、bar plan | P1–P2 |
| 音色编配 | Doubling、Hocket/hand-off、Register contrast | 旋律分配、厚度与分离度 | instrument capabilities、part roles、doubling | P2 |
| 表现处理 | Strum、Articulation、Grace/ghost notes、Dynamics | 降低机械感但保持可奏性 | ordered delays、gate、velocity contour、limits | P2 |

**两种必须分开的琶音能力：**

1. **琶音技法的计划与验收**：用户或 Agent 选择“上行 / 下行 / 上下往返 / 阿尔贝蒂 / 有规律的自定义顺序”，通用 LLM 写出原始 MIDI，再验证它是否在对应和弦事件内按计划使用音符。这是当前 MIDI 作曲 Agent 最需要的。
2. **钢琴卷帘的确定性转换工具**：对用户明确选择的和弦音符进行 `Arpeggiate Selection`，将柱式和弦按 pattern 展开成可编辑 MIDI；原始数据只在用户批准后被替换/新增，锁、时间范围和 undo 不变。它是可选 MIDI 编辑功能，不是第二个 AI 作曲引擎。业内 Ableton Live 12 的 Arpeggiate MIDI Transformation 采用这种能力划分。

## 3. 琶音最小可行规格

### 示例：D minor seventh（D–F–A–C）的不同伴奏形态

480 PPQ、4/4、一小节、8 个八分音符；这里仅展示**音符顺序**，所有具体时值和音域另由演奏方案确定。

| Technique ID | 八个音的示例序列 | 音乐含义 |
|---|---|---|
| `arp_ascending` | D F A C D F A C | 上行循环；可设置跨八度后再回落 |
| `arp_descending` | C A F D C A F D | 下行循环 |
| `arp_pingpong` | D F A C A F D F | 上下往返；拐点是否重复必须明确 |
| `alberti` | D A F A D A F A | 低–高–中–高；三音/四音和弦需指定简化/扩展法 |
| `broken_custom` | D A C F D A C F | 自定义音级索引循环 |
| `block_comp` | Dm7 同时发音（若干次） | 与琶音互为对照，重音位置和和弦排列更重要 |
| `pedal_d` | 低音 D 持续 + 可选上方运动 | 与其他声部形成恒定基底，不等于频繁弹根音 |

核心音级顺序可以抽象为 `[0,1,2,3]`、`[0,3,2,1]`、`[0,1,2,3,2,1]` 或 `[0,2,1,2]`。但**索引不是实际 pitch**；需要与当前 `ChordEvent`、转位、VoicingPlan、音域与跨和弦的 voice leading 绑定。简单拼接 pitch class 并不能保证连续性。

### 推荐的中间契约（仅设计示意）

```json
{
  "techniqueId": "arpeggio",
  "version": "1",
  "role": "accompaniment",
  "trackId": "selected-unlocked-track",
  "chordSource": "user_harmony_timeline",
  "scope": {"startTick": 0, "endTick": 1920},
  "pattern": {
    "order": "pingpong",
    "rate": {"n": 1, "d": 8},
    "gatePercent": 82,
    "octaveRange": 1,
    "restartOn": "chord_change",
    "velocityContour": "accent_first"
  },
  "constraintPolicy": "hard_when_user_selected"
}
```

*不建议*在第一版加入无限长自由脚本 pattern、隐藏的 MusicProject 变更、任意音符复制或未批准的“自动修复”。自定义复杂 pattern 后置，先让少数可验证的手法可靠。

### 必须解释和验证的边界

- **拍号**：`6/8` 的分组常是两个附点四分音符拍，不应被无条件当作“每拍一个四分音符”的 4/4 处理；pattern 时值必须是有理数/整数 Tick 且有明确的适用范围。
- **调式**：现有 `HarmonyPlan.mode` 仅 `major | minor`，但 MCP brief 已可描述 Dorian/Mixolydian 等模式；应先统一调式素材或通过显式用户定义的和弦音集和音阶计划，避免 D Dorian 在底层被误释为 D natural minor。
- **和弦事件变换**：切换和弦时可重启、继续相位或连音，但必须显式选择；跨事件音符要符合用户设定的保留音/悬置政策。
- **和弦排列**：三度、七度、转位、开放/密集位置与各个声部的音域相互独立，不能用仅有 `ChordEvent.inversion` 的低音约束假装完整 Voicing。
- **真实 groove**：rate（八分/十六分）与摆动相位、accent、velocity、articulation 是不同维度。2:1 后半拍不能证明完整 Shuffle 感。
- **固定容量**：当前三轨默认各 1–64 音、总计最多 128 音，每次 `ArrangementRequest` 最长 4 小节。四小节十六分琶音已有 64 音；三轨同时密集化会触及总量上限，需确定逐段候选或非破坏性分层策略。
- **输入来源**：选择 `HarmonyPlan` 明确和弦优先；音高直方图推测出的和弦仅是弱证据，不能被自动升级为用户已批准的权威和弦。
- **编辑安全**：用户选择轨道、范围、technique；操作先候选预览，再经过原有 `Music Core` 的锁、revision、范围、幂等、确认/撤销。不能绕过原有代码的核验流程。

## 4. 推行步骤与验收

### P0 — 可审查的技法词表与琶音 MVP

1. 在 `packages/composition/src/planning/` 新增 `TechniquePlan` / `PatternSpec`，独立于 `HarmonyPlan` 但可引用权威和弦事件，统一 `meter`、`rate`、`gate`、`voicing`、`register`、`restart` 和 `scope`。
2. 先实现上行/下行/往返琶音、阿尔贝蒂低音、柱式节奏伴奏、持续音/Pad、root–fifth、短循环固定音型 **六族**；这些都是通用 LLM 的创作技法说明及 MIDI 候选审查（可按族分 PR），不生成假定优质的固定旋律。
3. 建立 `TechniqueFinding` 的可解释审查，例如：和弦音外比例、重启/跨和弦不匹配、琶音顺序偏离、每小节密度、过多同期攻击、音域越界。要区分可证明的硬约束与审美性软提示。
4. 增加 `music.list_arrangement_techniques` / `music.prepare_technique_brief` **建议接口**；若与旧 `music.prepare_composition_brief` 复用，应明确可选版本和向后兼容。先做只读选择和 dry-run；实际浏览器修改仍待授权桥接完成。
5. 每种技法提交 4/4、6/8、和弦变更、转位、locked、stale revision、全时长边界等验收样例；原始 MIDI 与参考许可证不可丢失。

### P1 — 连接 HarmonyPlan、调式与完整声部组织

补 VoicingPlan、声部连接、对位/副旋律、Walking bass、琶音与用户已批准和声结构的兼容。解决 major/minor 与 Dorian 的不一致，以及 4/4 限制。提供可听的 4–16 小节多轨方案（分段、共享曲式身份），不要为达成小节数量而偷偷放宽 MIDI 音符数量和授权边界。

### P2 — 风格、乐器与人性化

按照可审计的乐器音域、典型奏法、groove 特征和声部功能进行节奏伴奏、拨弦、装饰音、转接 Fill、重音和 articulation 的独立控制。风格与 MIDI 来源标签是证据之一，不是技法正确性的充分条件。

### 与上一轮实验相衔接

现有 A/B/C 试听结果中，用户认为 B、C 表现较好；但它们并非隔离的多个外部 LLM 调用。下一轮在计划内的 A/B/C/D 四组基础上，应追加 **C0（结构化参考，无明确技法）/ C1（同一结构化参考 + 明确选择琶音、节奏伴奏等技法）** 的配对消融，以判别“技法约束”是否改善声音，而不是从音符密度直接推测。

最低样本建议：同一和弦进行、速度、调式、SoundFont、主旋律/可编辑范围，至少两种伴奏技法各出不同候选；记录全部候选的合法率和盲听分布。机器约束的通过率与审美评分应分开报告。

## 5. 主要研究依据

- Berklee Online, *Keyboard Technique for Songwriters*: 二音 broken chord、voice-led arpeggios、drone/pedal、节奏同步、ostinato/counterpoint、和声预示。<https://online.berklee.edu/courses/keyboard-technique-for-songwriters>
- Berklee Online, *Arranging 1: Rhythm Section*: Swing/Latin/pop 低音、comping、fills、anticipation、articulation 等节奏组技法。<https://online.berklee.edu/courses/arranging-1-rhythm-section>
- Berklee Online, *Arranging for Songwriters*: rhythmic/harmonic doubling、counterpoint、bass/drums、guitar/keys 角色。<https://online.berklee.edu/courses/arranging-for-songwriters-instrumentation-and-production-in-songwriting>
- Berklee Online, *Orchestration*: 琶音素材、持续和弦/音色叠加、声部和乐器职责的不同。<https://online.berklee.edu/takenote/orchestration-how-to-write-for-an-orchestra/>
- Open Music Theory, *Improvising a sentence with galant schemata*: Alberti bass 的实际伴奏用途。<https://openmusictheory.github.io/schemata-improv.html>
- Ableton Live 12 Reference Manual, *Arpeggiate MIDI Transformation*: 18 种音型、rate/gate、note transposition，与实时 Arpeggiator 相区别。<https://www.ableton.com/en/live-manual/12/midi-tools/>
- Ableton Live 11 Reference Manual, *Arpeggiator MIDI Effect*: up/down/random、groove、Hold/Rate/Gate。<https://www.ableton.com/en/live-manual/11/live-midi-effect-reference/>
- Open Music Theory, *Keyboard-style voice-leading schemata*: 换声、平行十度与多声部声部连接。<https://openmusictheory.github.io/KBVLschemata.html>

### 决策保留

该设计不改变已获批准的“通用 LLM 负责 AI 作曲、MCP 优先、所有写入需用户显式批准”。实施任一新增接口或更改 HarmonyPlan/Music Core Schema 前仍需要进一步设计审查与兼容测试。