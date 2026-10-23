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
## 可核验的只读参考检索接口（PR #20，依赖 PR #18、PR #19）

以下是该开发分支的**实际试验接口**，而不是用户已批准的固定产品契约。MCP 接入以 stdio JSON-RPC 的 `tools/list` / `tools/call` 提供：

- `music.search_references({meter?, sourceStyle?, usage?, pitched?, verifiedMode?, verifiedGroove?, limit?, offset?})`：多个查询条件为 AND；每条返回 SHA-256 引用 ID、来源、明确可追溯的 CC 许可和作品署名。`verifiedMode` / `verifiedGroove` 不通过音高直方图或节奏分布推断，暂无独立审核的标签时零匹配。
- `music.get_reference({id})`：仅允许已登记的 64 位 SHA-256，返回音高/节奏/力度统计特征和授权来源；不返回 MIDI 原始数据，不接触编辑器。
- `music.reference_coverage({})`：从实际 44 个文件计算拍号分布、鼓组/音高材料比例和许可种类，并明确缺口。

运行时只从服务器操作员设置的本地目录装载参考库，不提供读取任意文件/URL 参数，不联网下载。载入时验证目录边界、文件哈希、许可字段，且不读取项目凭据。失败时显示 `reference_catalog_unavailable` 或 `reference_catalog_invalid`，不会虚构匹配。

本接口仅实现公共参考资料检索，**不改变** D-005 通用 LLM 编曲、D-006 双接入或 D-007 MCP First 的裁决，也不能视为已打通 Web 工程会话桥接、候选预览或用户批准闭环。详见 `services/agent-api/src/mcp/README.md`。
