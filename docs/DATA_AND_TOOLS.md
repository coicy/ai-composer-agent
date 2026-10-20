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