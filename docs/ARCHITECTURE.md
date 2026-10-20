# 技术架构（候选）
单一权威 MusicProject → 纯命令执行器与事务日志 → UI Piano Roll 与 Audio Transport（只读投影）；Composition Engine 通过 Agent Gateway 返回候选 MusicOperation，不能直接写状态。

推荐 monorepo：apps/web、packages/music-core、packages/piano-roll、packages/audio-engine、packages/midi-io、packages/composition；可选 services/agent-api。

music-core：tick 与 tempo map、轨道、稳定 note ID、revision、锁、操作校验、事务、diff、undo/redo；不依赖 React、Tone.js 或模型。
piano-roll：Canvas 2D 起步，按需评估 PixiJS；坐标与 hit-test、绘制和交互只产生命令。
audio-engine：Tone.js 候选，Transport 调度、音源加载、取消调度和资源释放。
midi-io：@tonejs/midi 候选；明确 MIDI 格式不能保存所有 Agent 元数据、锁和候选信息，因此 JSON 是无损工程格式。
composition：LLM 与算法可互换，确定性检查音域、节拍和写入约束，音乐审美另测。
agent-api：密钥托管、模型适配、请求限额（若采用服务器模式）。

关键边界：模型提议 ≠ 数据写入；播放状态 ≠ 工程数据；视图绘制 ≠ 音符真实来源。