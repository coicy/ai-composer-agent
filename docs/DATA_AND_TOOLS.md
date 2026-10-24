# 数据契约与操作协议（待 PoC 固化）

工程：projectId、revision、ppq（候选 480）、tempoMap、meterMap、tracks、locks、history；轨道包含 trackId、program、mute/solo 与 notes。音符：noteId、pitch 0..127、startTick 非负整数、durationTicks 正整数、velocity 1..127。所有时间以 tick 为准，不用浮点秒作为持久事实来源。

建议操作：add_note、update_note、delete_note、add_track、set_track_property、lock_scope、unlock_scope。每个操作关联 trackId；修改音符必须引用现存 noteId。复合 changeSet 有 baseRevision、scope、operations、candidateId、requestId。

事务：parse → schema validation → limits → scope/lock permission → semantic validation → preview diff → explicit approval → recheck revision → atomic commit → undo entry。批次失败全部拒绝；重复 requestId 应可安全处理，严禁重复叠加。

Agent 工具示例：
- read_project / read_selection / list_tracks / inspect_notes
- compose_melody / generate_variation / compose_bass
- preview_changes / apply_approved_changes / cancel_preview
- evaluate_structure
权限强制在执行器，不能用模型“承诺”取代校验。

MIDI 导出可能损失锁、候选、操作历史与语义标签，须警示；工程 JSON 保存这些信息。下方 Schema 是一条音符操作的初始例子，不等于已完成正式 API。

## 双入口协议边界（D-006）

已批准 MCP 外部 Agent 入口和内部 API/Key LLM 入口，但尚未批准 MCP Transport、具体工具名称、授权 Token 和 JSON Schema。建议的 MCP 资源/工具类别：用户授权项目/选区读取、轨道/音符查询、候选提交、diff 预览、候选状态查询。**这些只是设计示例，不是当前可用 API。**

MCP 客户端不能自行生成可信 MusicOperation、Note ID 或批准令牌；内部 LLM 的模型输出也不能。所有提案都经 `composition` 验证、`music-core` dry-run、revision/锁检查和用户显式批准，且外部 MCP 连接不能读取内部 API Key。当前 MusicProject 主要由浏览器持有，MCP 需明确的授权会话桥接才能读取真实活动项目。参见 [LLM_ACCESS_MODES.md](LLM_ACCESS_MODES.md)。

## S0 已实现的音频时间轴和轨道身份（分支特性，未合并）

MusicProject 增加可选 `tempoMap`、`meterMap`（tick=0 的首事件、严格递增）和每轨可选 `instrument: {kind,program,channel}`。旧项目缺省为 120 BPM、4/4，音轨仍为旋律轨。导入导出 SMF 保存 BPM、拍号、GM program 和 percussion channel=9（零基）；MIDI 不保存批准、锁及制作效果。Web Audio 预览默认按变速分段换算 tick。此版尚无修改时间轴的 Music Core 命令及浏览器控件，不得将只读状态字段冒称用户可直接编辑。详见 [S0_MUSIC_TIMEBASE.md](S0_MUSIC_TIMEBASE.md)。

## S1 自动编曲技法与源于曲风的高权重规划（功能分支，未合并）

`TechniqueIntent` 允许用户显式选择风格、禁用自动化或排除具体技法；未指定时可从唯一明确的 House/Techno/Trance/Synthwave/DnB/Chiptune/Ambient 曲风词识别，不确定时不作强制推断。引擎依据可调风格权重主动为现有三轨安排琶音、低音、和声击奏或持续音，并设定明确 Tick 窗口的乐句变化。依旧必须由通用 LLM 实际生成 MIDI，用户硬约束高于任何风格权重。

现有三轨生成 API **没有鼓轨**，故 Four-on-the-floor / DnB Breakbeat 高权重项目只标记为 deferred，不声称已生成完整电子鼓。这一缺口会在后续 MusicRole 升级 PR 解决。MCP 相关多分支功能仍未合并；本阶段通过当前 Web → API → CompositionProvider 路径传入结构化规划。见 [S1_WEIGHTED_TECHNIQUES.md](S1_WEIGHTED_TECHNIQUES.md)。

## S2 CompositionBlueprint（设计的候选计划，非持久批准）

`composition-blueprint-v1` 使用 `ppq/meter/songStartTick/totalBars/mainMotifId/sections` 表达连续歌曲结构；每节含起止 Tick、energy、统一 motifId、对比/再现 action 和一种变化维度。该对象现在从 Authoritative MusicProject 的有效拍号与创作 seed 派生，作为 LLM 只读创作上下文，不属于默认的持久工程 schema，也不替代人工确认或实际音符。结构/技法数据仍不能由普通 MIDI 全量保存。见 [S2_COMPOSITION_BLUEPRINT.md](S2_COMPOSITION_BLUEPRINT.md)。
