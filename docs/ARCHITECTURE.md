# 技术架构（候选）
单一权威 MusicProject → 纯命令执行器与事务日志 → UI Piano Roll 与 Audio Transport（只读投影）；Composition Engine 通过 Agent Gateway 返回候选 MusicOperation，不能直接写状态。

推荐 monorepo：apps/web、packages/music-core、packages/piano-roll、packages/audio-engine、packages/midi-io、packages/composition；可选 services/agent-api。

music-core：tick 与 tempo map、轨道、稳定 note ID、revision、锁、操作校验、事务、diff、undo/redo；不依赖 React、Tone.js 或模型。
piano-roll：Canvas 2D 起步，按需评估 PixiJS；坐标与 hit-test、绘制和交互只产生命令。
audio-engine：Tone.js 候选，Transport 调度、音源加载、取消调度和资源释放。
midi-io：@tonejs/midi 候选；明确 MIDI 格式不能保存所有 Agent 元数据、锁和候选信息，因此 JSON 是无损工程格式。
composition：依据 D-005，AI 音乐生成仅使用通用 LLM；既有离线规则生成用于演示和测试，确定性算法用于检查音域、节拍、和声及写入约束，音乐审美另测；不引入专用音乐生成模型或模型 Provider。
agent-api：密钥托管、模型适配、请求限额（若采用服务器模式）。

D-006：外部 Agent 通过 MCP 使用工具并自行调用 LLM；内部 BYOK 模式由受控后端持有会话 API key 调用通用 LLM。两条入口共享候选校验和用户批准，密钥保护方案详见 [双入口与密钥安全设计](DUAL_ENTRY_AND_SECRET_SECURITY.md)。

关键边界：模型提议 ≠ 数据写入；播放状态 ≠ 工程数据；视图绘制 ≠ 音符真实来源。