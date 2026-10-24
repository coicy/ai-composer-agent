# AI Composer Agent：基础编曲技法、组合规则和第一版实施规格

> 2026-10-24。**设计提案，不是已实现功能或新的用户产品裁决。** 延续 [编曲技法调研](ARRANGEMENT_TECHNIQUES_RESEARCH.md)。本方案适用于通用 LLM + MCP + Music Core，不引入独立专用音乐生成模型，不绕过人工审批。实验 B、C 的听感较好是用户的初步反馈，并非因果检验。

## 一、目标：从“会选音符”走向“会组织音乐”

现有工程有 HarmonyPlan（四小节 4/4、major/minor、和弦 Timeline）、bass/harmony/accompaniment 三轨候选、调式简报、带证据的 MIDI 参考，以及种子随机灵感卡；缺少将素材编织成琶音、节奏伴奏、固定音型、声部应答等**可复用技法**的规划层。

**不直接让算法凭模板决定完整乐曲。** 采用四层分离：

1. **素材层 Material**：用户权威调式/和弦/节拍与主旋律（推测和弦必须标记为未证实）。Chord tones、Voicing、Register、允许的装饰音。
2. **技法层 Technique**：琶音、柱式、低音型等；给出操作对象、顺序/时值/密度、音域、作用乐句。
3. **组合层 ArrangementPlan**：同一时段的主角/背景/脉冲/低频/填充，定义搭配、让位、密度与乐句切换；将纯灵感卡转为**可选**建议，而不是自动提升为硬约束。
4. **候选与验收**：外部通用 LLM 根据上述规划创作 MIDI；机器核验明确要求，Music Core dry-run；试听与批准依旧由用户完成。

这四层应独立更新，避免将“Shuffle 风格”“八分音符”“琶音”当成一个互斥标签。

## 二、首版技法词表（按声部用途组织）

下面的 P0/P1 代表**开发先后**，不是技法的重要性排序。一个技法可以由不同乐器演奏；不要硬编码为固定音色。

| 编号 | 稳定 ID（建议） | 技法 | 主要职责 / 典型处理 | 最小必要参数 | 阶段 |
|---|---|---|---|---|---|
| 01 | \`arp\` | 分解和弦/琶音 | 横向展开和弦音 | ascending/descending/pingpong/custom、rate、octaves、gate、restart | P0 |
| 02 | \`alberti\` | 阿尔贝蒂低音 | 低–高–中–高循环（三和弦常见） | voicing/order、rate、accent、register | P0 |
| 03 | \`block_comp\` | 柱式/节奏和弦 | 强拍、弱拍或切分击奏 | voicing、onsetMask、gate、accent | P0 |
| 04 | \`pad\` | 长音和弦铺底 | 悬浮、气氛、低密度支撑 | voicing、sustain/chordChange、dynamicArc | P0 |
| 05 | \`pedal\` | 持续低音/固定音 | 调式锚点、张力、持续稳定性 | tonic/scale tone、register、holdPolicy | P0 |
| 06 | \`ostinato\` | 固定音型 | 周期性韵律、游戏循环识别性 | motifTicks、repeatCount、variationCycle、density | P0 |
| 07 | \`root_fifth_bass\` | 根音–五度/八度低音 | 低频框架，支撑和弦根 | intervalPattern、onsets、inversionHandling | P0 |
| 08 | \`rhythm_pulse\` | 直拍/摇摆节奏骨架 | 明确拍感，可使用鼓/拨弦/合成器 | accentGrid、grooveId、velocityContour | P0 |
| 09 | \`syncopated_comp\` | 切分与和声预示 | 律动张力、避免“全在强拍” | offbeatMask、anticipation、gate | P0 |
| 10 | \`walking_bass\` | 走句低音 | 步进连接和弦、维持流动 | targetChord、approachNotes、noteRate | P1 |
| 11 | \`voice_leading\` | 声部连接 | 共同音、最小移动、合理换位 | voicingRoles、maxLeap、commonTones | P1 |
| 12 | \`countermelody\` | 副旋律/反向运动 | 和主旋律对话，形成次级关注点 | leadRestWindows、register、motifRelation | P1 |
| 13 | \`call_response\` | 问答接力 | 乐句互动、避免全部声部齐奏 | leadBars、answerBars、motifLink | P1 |
| 14 | \`motif_transform\` | 序进/扩缩时值/节奏变形 | 主题发展、乐段再现 | sourceMotifId、transformType、returnPolicy | P1 |
| 15 | \`fill_transition\` | 过门/Fill | 段落转换、局部能量变化 | lastBeatWindow、densityPeak、resolution | P1 |
| 16 | \`passing_neighbor\` | 经过音/辅助音/倚音 | 丰富水平旋律与和弦连接 | accentPosition、direction、resolution | P1 |
| 17 | \`doubling\` | 同度/八度/三六度叠加 | 厚度、焦点强化（允许的调式内） | interval、register、onsetLock | P2 |
| 18 | \`strum\` | 扫弦/错开发音 | 弦乐分散发音、动感 | noteOrder、spreadTicks、gate、velocity | P2 |
| 19 | \`ornament\` | 装饰音/倚音/颤音 | 局部表现力（需乐器能力） | ornamentType、duration、resolution | P2 |
| 20 | \`articulation_arc\` | 断/连奏、力度曲线 | 人性化、乐句表达 | gateCurve、accentContour、instrumentRange | P1–P2 |

**区别：** \`arp\` 是和弦纵向音高被安排成连续起音；\`ostinato\` 是更宽的重复概念，可以是单音节奏、旋律碎片、琶音或打击乐。两者可以关联（\`ostinato\` 包含 \`arp\` 的音型），不能在同一事件里因为两个名称而自动复制两遍音符。\`alberti\` 是特定次序的分解和弦，可复用琶音计划的执行/审核接口，但应保留独立 techniqueId。

## 三、组合模型：按“声部职责 × 时间窗口”选技法

### 3.1 功能槽位（不是一槽一种固定乐器）

| 槽位 | 主要任务 | 常见技法 | 首版建议 |
|---|---|---|---|
| **Lead（焦点）** | 听众应当关注的旋律 / 主题 | melodic motif、countermelody（应答时）、doubling | 同一时刻通常一个主焦点 |
| **Harmony motion（运动和声）** | 产生可听见的音型流动 | arpeggio、alberti、syncopated comp、ostinato | 一般只安排一种主运动模式 |
| **Harmony sustain（持续和声）** | 铺底、留白、维持调式 | pad、pedal、slow block chords | 与运动声部分离音区或力度 |
| **Bass（低频）** | 和弦根、低频脉冲与鼓互动 | root–fifth、walking、pedal | 同一低音轨同一时段选一种主型 |
| **Pulse（脉冲）** | 让节拍与细分易于感知 | straight/swing/shuffle groove、鼓或节奏乐器 | 与 Bass 协调强拍，避免相互争抢 |
| **Fill（过渡）** | 在留白/段落末端短暂提升张力 | fill、answer、short arpeggio run | 限定时段，其他声部适当让位 |
| **Expression（演奏修饰）** | 赋予已有技法自然起伏 | accent arc、strum、gate、ornament | 可以叠加，但不能无限增加音符 |

最小模型：**每个轨道、每个非重叠时间段，一项 primary technique；可选一个 expression modifier。** 不同轨可同时演奏不同技法，但所有声部共享一个 \`ArrangementWindow\` 关注点、能量曲线和音符密度预算。

### 3.2 基本兼容关系

**优先推荐的搭配**：

| 主导技法 | 配合技法 | 必要的编排条件 |
|---|---|---|
| 琶音 \`arp\` | 持续和弦 \`pad\` | 不同音区/力度，pad 不重复琶音起音 |
| 琶音 \`arp\` | 根–五度低音 | 低音稳住和弦，琶音负责中高频运动 |
| 琶音 \`arp\` | 句末 Fill | Fill 仅占句末小窗口，琶音该窗口适当减密 |
| 阿尔贝蒂 \`alberti\` | 歌唱性主旋律 + 持续低音 | 主旋律突出，循环键盘型不与主旋律争抢重音 |
| 柱式伴奏 \`block_comp\` | Walking bass + swing/shuffle 脉冲 | 吉他/键盘重音错开低音行进时值，不强求机械 2:1 |
| 固定音型 \`ostinato\` | 持续低音 \`pedal\` + 稀疏主旋律 | 保留循环识别性；中高频避免多条同密度 ostinato |
| 和弦铺底 \`pad\` | 副旋律 \`countermelody\` | 主旋律留白时，副旋律进入不同音区 |
| 切分和弦 \`syncopated_comp\` | Root–fifth bass + 节拍骨架 | 切分针对低音/鼓的稳定拍形成张力，互补而非随机错乱 |
| 柱式和弦 \`block_comp\` | 单音旋律 + 短音填充 | 主旋律持续音时可回应，主旋律密集时减少击奏 |
| 6/8 分解和弦 | 复合拍脉冲 + drone | 尊重 6/8 内在分组；不可用“四分拍 + 固定 Shuffle”替代 |
| 八度/齐奏叠加 \`doubling\` | 主旋律 + pad | 只在高潮区间增厚，避免整曲音量/密度不变 |
| 段落减法 \`fill_transition\` | 任何节奏/和声技法 | 过门前主动腾出音频空间，随后再现主音型 |

**首版应当拦截或要求显式选择的情况**（对艺术例外给出 warning 而非擅自删音）：

| 搭配 | 风险 | 首版处理 |
|---|---|---|
| 同一键盘同一时段 \`arp\` + \`alberti\` | 两种 primary note-order 相互冲突 | **硬冲突**：拆段或用户显式选择一种 |
| 同一贝斯同段 \`walking_bass\` + \`root_fifth_bass\` | 两套低音主型竞争 | **硬冲突**：分段使用，不能自动双写 |
| 高频琶音 + 连续副旋律 + 密集主旋律 | 高频遮蔽、主旋律焦点模糊 | **软告警**：减一层、降音区或选错位窗口 |
| 长时值 pad + 高频率 block comp（同音域） | 混浊或持续和声压过短重音 | **软告警**：不同音区、音色、力度或交替演奏 |
| 多轨都在每拍重击 / 毫无留白 | 声部互不让位、听感机械 | **软告警**：重音互补和密度错峰 |
| 和声快速转换时琶音跨和弦保持旧和弦音 | 可能违反用户和弦计划 | 按用户 \`allowSuspension\` / 跨段延音策略判断；硬和弦约束时拒绝 |
| 无音高鼓轨要求 Alberti / 调式音阶 | 功能/材料不匹配 | **硬冲突**：返回理由，不把鼓音高当和声音级 |

组合规则不应强迫“每段都有 5 层”。稀疏、减法与声部让位本身也是有效的编曲决定。

### 3.3 组合求解优先级

1. **用户硬约束**：作用范围、音域、轨道锁、ChordPlan（若明确）、Meter、Mode、Tempo、乐器可奏性、音符上限。
2. **主导角色**：谁是焦点？谁负责稳定脉冲和低音？谁可以休止？
3. **音型与和声**：琶音顺序/节奏分型、和弦分配、重复周期；跨事件是否重启必须显式。
4. **兼容过滤**：同轨 primary 冲突拒绝；多轨 masking/同频密度问题提示或重试。
5. **种子随机灵感**：在兼容的 technique combinations 中随机**推荐**变体，不允许跳过硬约束或隐式写项目。
6. **LLM 创作 + 检查 + 听评**：通过技术校验不代表音乐质量更高。

## 四、推荐的 8 套“技法配方”（可改场景，不等于固定风格）

| Recipe ID | 用途 / 目标 | 典型组合（从焦点到背景） | 核心控制点 |
|---|---|---|---|
| \`floating_exploration\` | 探索、朦胧、休闲游戏 | 稀疏主旋律 + 8 分琶音 + Pad + Pedal | 琶音中高频、Pad 软起、保留呼吸 |
| \`classical_motion\` | 轻快键盘 / 古典语言 | 旋律主题 + Alberti bass + 和声变化 + 句末装饰 | Alberti 遵循实际三音排列、转位、乐句句法 |
| \`shuffle_band\` | B/C 测试方向、活跃 Shuffle | 主旋律 + 切分 Comping + Root–Fifth/Walking bass + Shuffle 鼓 | bass/drums 同步骨架，不能把 2:1 当唯一证据 |
| \`adventure_ostinato\` | 冒险/行动循环音乐 | 动机主旋律 + Ostinato + 八度根音低音 + 简洁打击乐 | 连续重复需在 4/8 小节出现一次有目的变化 |
| \`suspense_drone\` | 悬疑、紧张、环境铺垫 | 分散音型 + 低持续音 + 少量短击奏 + 留白 | 色彩集中于变化点，减少连续密集音符 |
| \`warm_theme\` | 温暖、叙事性主题 | 歌唱主旋律 + Soft Pad + 句间副旋律 + 低音锚定 | 主旋律优先，副旋律只在留白时介入 |
| \`dance_syncopation\` | 明确节拍的律动音乐 | 短主题 + Syncopated Comp + Root/Octave Bass + Pulse | syncopation 相对于基础拍构成对照，非随机偏移 |
| \`compound_folk\` | 6/8 或其他复拍情境 | 短旋律 + 分解伴奏 + drone/root bass + 复合拍轻打击 | 使用复合拍分组的内在重音，不强制 4/4 网格 |

这些是**组合初始条件**而非“流派精确定义”。它们适用于对照试验；真实风格与审美需要听评，不可用 recipe id 伪装权威认证。

## 五、可重复验收例子：4 小节 D Dorian / 112 BPM / 4/4

### 用户固定的音乐素材与轨道

- 选定 \`D Dorian\`：D E F G A B C，特征为 B 自然；主旋律的音高和乐句边界**固定不变**。
- 明确的 4 小节和弦事件：**Dm7 → G7 → Cmaj7 → Dm7**。四个和弦音均属于 D Dorian；其中 Cmaj7 是经过性和声，结尾回 Dm7 以建立 D 作为中心。**和弦方案是本实验建议，不是自动推测的权威。**
- \`ppq=480\`，每小节 1920 ticks，四小节 [0,7680)，每小节 8 个八分起音点时刻 [0,240,…,1680]（具体 swing phase 另行处理）。
- 轨道：Lead（锁定，用户现有旋律）、Rhodes、Bass、Drums。工程中当前三轨 arranger 的 \`ARRANGEMENT_ROLES\` 不包含鼓轨；这四轨示例是**目标多轨组织**，不表示旧 API 已支持直接四轨提交。

### 同一素材的三个技法对照

| 版本 | Lead | Rhodes（主伴奏技法） | Bass | Drums | 验证重点 |
|---|---|---|---|---|---|
| **T0** | 锁定同一主旋律 | 每小节和弦柱式起音 | Root–Fifth | Shuffle pulse | 基线，较少内在运动 |
| **T1** | 不变 | 有序八分音符 \`arp_pingpong\` | Root–Fifth | 同一 Shuffle pulse | 是否改善连续运动感而不遮蔽旋律 |
| **T2** | 不变 | 切分 \`syncopated_comp\`，乐句间留白 | Root–Fifth | 同一 Shuffle pulse | 是否提升鼓/贝斯协同与节奏反差 |

每个版本设置相同响度目标、和弦事件和发声乐器，第一轮只改变 Rhodes 的主技法。后续再比较：
- **T1b**：T1 的最后半小节让位给 Fill；
- **T1c**：T1 的后两小节改为 \`pad\`（分段 \`arp → pad\`），验证乐句对比；
- **T2b**：T2 保持 Rhodes，Bass 从 Root–Fifth 改为 Walking（仅在允许时段）。
不得一次改变鼓速、和弦、主旋律和所有轨道后声称“琶音提高了质量”。

### 容量和边界验收

- T1 每小节 8 音，4 小节 32 音，低于目前 64 音/角色限制；**16 小节则单轨 128 音，不能通过旧的单次 64 音候选**，需分成 4 小节候选并保留同一 pattern identity、全局 beat phase 和跨窗口的 chord continuity。
- 4 小节同时使用多个密集三轨有可能超过旧总 128 音上限；应该汇总预算，而不是悄悄裁掉重音/音符。
- \`Music Core\` 必须再次检查轨道锁、revision、note bounds、时间窗、批准和撤销；dry-run 不改变项目。
- 和弦切换时，上一个琶音音符的持续跨边界是否允许，取决于用户 \`crossChordPolicy\`，硬和弦音政策不能静默豁免。

## 六、最小数据契约：technique 可组合，但不可擅自重写工程

建议与已有 \`HarmonyPlan\` 并列新增 \`TechniquePlan\` 及 \`TechniqueCombinationPlan\`，不要一次性替换所有现有接口：

\`\`\`json
{
  "version": "arrangement-techniques-v1",
  "scope": {"startTick": 0, "endTick": 7680},
  "meter": {"numerator": 4, "denominator": 4, "ppq": 480},
  "chordSource": {"kind": "user-approved", "revision": 7},
  "slots": [
    {
      "trackId": "rhodes",
      "role": "harmony_motion",
      "primary": {
        "techniqueId": "arp",
        "pattern": "pingpong",
        "rate": {"numerator": 1, "denominator": 8},
        "gatePercent": 78,
        "octaveRange": 1,
        "restartOn": "chord_change"
      },
      "modifiers": [{"techniqueId": "articulation_arc", "velocityShape": "gentle-accent"}],
      "startTick": 0,
      "endTick": 7680
    },
    {
      "trackId": "bass",
      "role": "bass",
      "primary": {"techniqueId": "root_fifth_bass", "rate": {"numerator": 1, "denominator": 4}},
      "startTick": 0,
      "endTick": 7680
    }
  ],
  "focus": "lead",
  "maximumTechniqueLayers": 3,
  "conflictPolicy": "reject_same_track_primary_conflicts"
}
\`\`\`

**以上仅是技术规范草案**。生成/解析后，服务器必须自行加载已有 MusicProject 的轨道锁和版本信息，不能仅相信 JSON 中的 trackId、chord revision 或写入许可。源和弦计划不足/冲突时要求用户明确确认，不把推测和弦自动当成已批准和弦。

### 机器可审核而不伪称能评判音乐性的项目

1. **强制拒绝**：未知 techniqueId / 非法参数、未授权轨道/作用域、单轨同段多个 primary、音符超过容量、硬约束音级/和弦/音域违规、过期 revision、无批准的提交。
2. **可检测偏离**：\`arp\` 预期顺序与实际 note onset/pitch class 比较（跨八度、同音异名、过门另作处理）、节奏子分格与 groove 时间相位偏离、\`ostinato\` 是否出现可识别周期、\`pedal\` 是否保持选定音、Bass 目标音级是否落在规定窗口。
3. **软提示**：多声部频段遮蔽、过度重复、Fill 过密、缺乏留白、调式中心不清晰。**单纯 pitch-class 合法并不等于调式建立，swing 2:1 也不等于真实 Shuffle。**
4. **人耳判断**：听感自然度、旋律注意力、和声质感、律动合理性、变奏连贯性和游戏场景适配，必须听评，不能由技术分数替代。

## 七、实现顺序与验收出口

| 步骤 | 内容 | 验收 |
|---|---|---|
| M0：设计冻结（当前） | catalog、组合槽位、冲突规则、示例、参数契约 | 至少覆盖上述 20 种技法、12 条搭配、7 类冲突和 3 个对照版本；未改动生产音乐逻辑 |
| M1：基础技法计划 | \`packages/composition/src/planning/technique-catalog.ts\`、\`technique-plan.ts\`、\`combination-plan.ts\` | arpeggio/alberti/block/pad/ostinato/root-fifth/pulse 有类型参数与运行时验证；3/4、4/4、6/8 和多种 PPQ 的时间语义正确 |
| M2：候选检验 | \`evaluation/technique-findings.ts\`；现有 MCP brief / evaluate 工具增加可选 techniquePlan | pitch order、rhythm pattern、chord boundary、scope/track/revision/容量测试可复查；旧调用向后兼容 |
| M3：用户可选转换（独立） | \`Arpeggiate Selection\` 在 UI 选择和弦选区后生成 MIDI 候选 | 有预览、人工审批、undo；不是第二个音乐模型 |
| M4：组合试听实验 | 使用 B/C 获得较好听评的共同素材做 T0/T1/T2 对照 | 同旋律/和弦/音色、技术校验与盲听分离记录；不能仅靠 MIDI 符合率宣称质量 |

### 研究依据与边界

- Berklee Online [Arranging 1: Rhythm Section](https://online.berklee.edu/courses/arranging-1-rhythm-section) 把鼓、低音、键盘/吉他伴奏、intro/ending、articulation 与 dynamics 作为不同需要协作的职责。
- Berklee College of Music [Contemporary Arranging](https://college.berklee.edu/courses/ar-511) 将 melody、rhythm、harmony、form 以及 groove-driven / melody-driven 编配结合考虑。
- Berklee [Jazz Arranging](https://online.berklee.edu/courses/jazz-arranging) 覆盖主次焦点、comping、voice leading、pads 与 countermelody 的分工。
- Gates Thomas, [Basic Arranging for the Rhythm Section](https://he.kendallhunt.com/product/basic-arranging-rhythm-section) 特别强调多种 comping 乐器之间避免相互冲突。
- Ableton Live 12 MIDI Tools 对琶音等 MIDI Transformation 的设计可借鉴，但**用户明确触发且可预览的转换**应与 LLM 新创作分开。

**许可**：新 TechniqueCatalog、Recipe 和 MIDI 技法说明是原创工程文字；现有参考 MIDI 的 CC BY 4.0 / CC0 / Public Domain 许可由专门参考库继续独立保留。未复制商业 DAW 专有代码或第三方技法卡片。
