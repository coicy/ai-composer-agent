# MIDI 参考库分类与覆盖审查（提案，非产品裁决）

> 2026-10-22。基于 PR #19 构建出的 `reference-output/manifest.json` 和 39 个 MIDI 原始文件进行审计。**本文件是修正建议，不代表新的产品规则已获用户批准；当前 17 个文件夹仅是来源标签和筛选单元，不是正式风格本体。**

## 1. 实际缺口

| 核验项 | 当前测得 | 局限 |
|---|---:|---|
| 样本总量 | 39 | 仅为第一批锚点 |
| 风格文件夹 | 17 | 9 种鼓组来源风格 + 4 种游戏使用场景 + 4 种历史/演奏体裁，分类层级混杂 |
| 鼓组专项 Groove MIDI | 23/39 | 这些文件对鼓律动有价值，但无法证明 Jazz、Blues、Latin 等风格的和声/调式 |
| 游戏 Chiptune | 8/39 | 全部来自同一位作者的一组作品，适合场景和结构参考，不可代表游戏配乐全谱系 |
| Mutopia 乐谱 MIDI | 8/39 | 侧重音高、织体和曲式；不是可靠的人类律动样本 |
| 4/4 拍 | 32/39 | 6/8、12/8、5/4、7/8 全部为零 |
| 3/4、3/8、2/4 | 3、2、2 | 不能替代复合拍和不规则拍 |
| 音符力度标准差为零 | 7/39 | 这些文件不宜充当力度动态的正样本 |

**分类错误示例：**
- `dance` 下将 Disco 与 Breakbeat 合并；它们不能共享同一节奏原型。
- `latin` 的三个例子均是巴西节奏标签，不能宣称覆盖 Afro-Cuban、Salsa 或 Bossa Nova 等不同传统。
- `blues` 的两个 Groove 样本都出自 `drummer4` 的 Shuffle，演奏者覆盖不足。
- `classical_form` 将奏鸣曲乐章与《Für Elise》混为一个曲式分类；《Für Elise》并不是奏鸣曲式代表。
- `romantic_piano` 仅有肖邦圆舞曲，不能代表浪漫主义夜曲、叙事曲、练习曲等不同组织方式。
- `game_battle`、`game_town` 等描述的是使用场景，而不是与 Rock、Jazz 同一级的音乐流派。

## 2. 采用分面而非互斥风格列表

建议保留一个可见的主标签，同时给每首参考曲赋予**允许多值、允许未知的独立分面**。下列字段是候选结构，尚未实施：

| 维度 | 候选信息 | 证据要求 |
|---|---|---|
| 风格谱系 `genre` | family、subgenre、tradition、era，多标签 | 作品来源/人工标注；风格归属不要仅由鼓声推断 |
| 节拍 `meter` | 拍号、分组、强拍、tempo map、换拍 | MIDI 拍号/速度事件可测；分组或感知节拍必要时人工复核 |
| 律动 `groove` | straight/swing/shuffle、切分、重音轮廓、微时值、半拍/双倍感 | 通过演奏 MIDI 的 onset/velocity 提取；不能使用量化乐谱假装自然演奏 |
| 音高语言 `tonality` | 主音、调式、音阶、调性游移、和弦功能、转调 | 需有音高材料；鼓组数据一律 `unknown`，算法推断须标置信度 |
| 织体与配器 `texture` | 声部数量、角色、复调/主调、乐器编制、音域 | MIDI Track/Channel/Program 证据；音色结论须音频或器乐标注辅助 |
| 曲式 `form` | 乐句、动机、终止、段落、循环点、变化方式 | 结构标注或人工复核；音符密度不等于曲式 |
| 表情 `performance` | 力度、连断奏、CC、rubato、发音延迟 | 只有演奏数据才能较可靠推断；缺乏表达时写 `unknown` |
| 叙事用途 `usage` | 城镇、战斗、地牢、叙事、菜单、Boss、探索等 | 场景标签不能推出固定调式或拍号 |

每个条目同时保留 `source_url`、`license`、`sha256`、`evidence_type` 和标注来源/置信度。**禁止把 unknown 误写为否定或推定值。**

### 示例：一个跨维度创作指令

> `usage=boss_battle` + `genre=symphonic_metal` + `meter=6/8` + `mode=D_dorian` + `texture=orchestral_and_drums` + `groove=compound_duple`

这是目标约束组合，不是一个需新增的单体风格类。检索可以分别使用：6/8 节拍样本、Dorian 调式作品、多轨配器参考和战斗循环参考，再由通用 LLM 综合创作。各维度的硬约束来自用户，参考曲提供的是可选择的软约束。

## 3. 第二批采样优先级

**P0：必须先补齐的音乐语言（应优先于增加常见 4/4 流派）**

| 缺口 | 正样本建议 | 测试内容 |
|---|---|---|
| 复合拍 | 6/8 双拍复合、12/8 Shuffle | 分组 `3+3`、四组三连音脉冲与强拍差别 |
| 不规则拍 | 5/4、7/8（含至少两种分组） | 不可只按等间隔网格量化 |
| Straight/Swing/Shuffle | 相近 BPM 各 2–3 首 | 不混淆三连摆动与自由的人性化微偏移 |
| 调式 | Ionian/Major、Aeolian/Minor、Dorian、Mixolydian、五声音阶 | 识别调式特征音和和声边界，不用调号代替完整调式 |
| 调性变化 | 转调、短暂离调、持续调式中心 | 不把所有非调内音视为非法 |
| 演奏表情 | 自然力度层次、rubato、弱起、重音层次 | 只使用有演奏证据的 MIDI 作为金标准 |

**P1：把目前过宽的流派拆到可解释的节奏/编曲原型**

- Jazz：Swing / Bebop / Modal Jazz / Jazz Fusion（每类需包含和声音高材料，不只鼓组）。
- Latin 和非洲相关节奏：Samba / Baião / Afro-Cuban Clave / Bossa Nova / Afrobeat（需辨认不同文化传统与演奏编制）。
- Rock 及衍生：Rock Backbeat / Punk / Metal、Progressive（分开鼓/吉他/贝斯组织，不以鼓点替代完整风格）。
- Funk、Soul、R&B、Hip-hop：16 分切分 / Neo-soul Harmony / Boom-bap / Trap（独立鼓与和声证据）。
- Electronic：House / Techno / Trance / Drum & Bass / Synthwave / Ambient（注意 MIDI 不充分表达音色、音效和侧链）。
- 历史/作曲技法：Baroque Invention、Fugue、Classical Sonata、Waltz、Romantic Nocturne、Ragtime、Impressionist Harmony。
- 游戏场景仍独立成 `usage`，再增加 Chiptune / Orchestral / Electronic Hybrid 等**风格与织体标签**。

以上只是分支候选，**并非每项已有 2–3 首可验证版权的 MIDI**。宁可将叶节点置为 `pending_reference`，也不要给不匹配的样本贴标签。

## 4. 采样与代表性标准

- 对已收录的每个**叶节点原型**先挑 2–3 条有效 MIDI，用于说明定义和开始测试；高变异类别应增加 4–6 条，而非强行三条截断。
- 两个样本最好体现核心共性、一个样本体现合理变化；同时增加至少一个**容易混淆的负样本**用于区分，如 Disco vs Breakbeat、Straight 8ths vs Swing 8ths。
- 尽可能跨不同作者/演奏者/作品数据集选择，避免同一人和同一配器造成错误归纳。
- 对声部、调式、拍号、节奏等属性分别计算覆盖，而非通过总文件数量认定丰富。
- MIDI 的文件扩展名不能证明其音乐元信息完整；仅有鼓点的文件不计入调式覆盖，有固定力度的文件不计入演奏力度覆盖。
- 将简单的每类计数扩展为 **Coverage Matrix**，其中正/负样本、可测量字段、置信度和许可证全部可审计。

## 5. 验收目标（提议）

**短期**：现有 39 首全部重新打多标签；对 P0 八种关键语言能力补齐交叉覆盖；首轮再引入约 30–50 条具备清晰许可且与现有曲目不重复的 MIDI。**不要先规定必须凑满 N 个流派**。

**中期**：构建具有独立标注来源的 25–35 个流派/编曲叶原型，至少 80–120 条代表 MIDI；额外覆盖 6/8、12/8、5/4、7/8 及 Swing/Shuffle / 人性化对照。数字是规划目标，不是已完成数据。

**产品验收**：同一创作提示下对比 (A) 无参考 (B) 仅风格标签 (C) 多维参考检索，分别统计硬约束达标率、节奏偏差、调式和谐度、结构性，以及盲听选择率；不能只用文件是否正确导入判定“音乐风格学会了”。

## 来源

- [Groove MIDI Dataset](https://magenta.withgoogle.com/datasets/groove)：演奏者给出的 style 元数据、beat/fill、BPM、拍号与录制模式；官方明确绝大部分为 4/4。
- [MusicBrainz genre tags](https://musicbrainz.org/doc/Folksonomy_Tagging)：流派可多值，且有层级与主观性。
- 本仓库 PR #19 的参考样本 `manifest.json`、SHA-256 及 MIDI 事件记录。

注意：本文所有「建议」「优先级」「验收目标」均为**待审核提案**。未修改现有 39 首原始 MIDI 或接受/拒绝标准。

## 6. 第一阶段实施状态（新增工程实现）

PR #19 现有构建脚本增加了以下可重现能力（以最新 CI 结果为验收准绳）：

- `scripts/midi_reference_facets.py`：逐条读取未修改的 MIDI，提取来源标注、拍号、Tempo、鼓通道/音高声部、力度变化、控制器及音符相对拍位的统计分布。它**不推断**未经验证的调式、Swing 感或曲式。
- `scripts/reference-output/manifest.json`：每首额外附 `facets`，并保留原文件来源、许可证和 SHA-256。
- `scripts/reference-output/coverage.json` 与 `COVERAGE.md`：输出分面覆盖、来源区别、未知状态和显式缺口；与 MIDI 参考包一起上传为 GitHub Actions Artifact。
- `scripts/query_midi_references.py`：对生成清单进行**独立条件、可追溯匹配**，支持 `--meter`、`--source-style`、`--usage`、`--require-pitched` 和 `--drum-only`。**不支持输入一种未验证调式就假装查出相应作品**。
- `scripts/test_midi_reference_facets.py`：构造鼓组/音高、6/8、7/8、未知拍号和伪造哈希等离线回归样本，约束元数据行为。

可重复的本地检查：

```sh
python -m pip install mido==1.3.3
python -m unittest discover -s scripts -p 'test_midi_reference_facets.py' -v
python scripts/build_midi_reference_catalog.py
python scripts/query_midi_references.py --usage battle
python scripts/query_midi_references.py --source-style dance/disco --drum-only
python scripts/query_midi_references.py --meter 6/8
```

第三条命令需要下载约 3.11MB Groove MIDI 数据及 OpenGameArt、Mutopia 公开文件。末尾的 6/8 查询按当前样本预计返回 `match_count=0`，这说明此批样本**没有代表证据**，并不意味着音乐系统不存在该拍号。

**已实施的仅是事实特征提取和参考资料检索**；模式分类学、专家标注、正负示例、实时检索 MCP 工具、参考驱动的 LLM 音乐生成及真实音乐质量 A/B 尚未实现。
