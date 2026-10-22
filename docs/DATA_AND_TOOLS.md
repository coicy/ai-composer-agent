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
