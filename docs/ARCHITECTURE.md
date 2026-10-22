# 技术架构（候选）
单一权威 MusicProject → 纯命令执行器与事务日志 → UI Piano Roll 与 Audio Transport（只读投影）；Composition Engine 通过 Agent Gateway 返回候选 MusicOperation，不能直接写状态。

推荐 monorepo：apps/web、packages/music-core、packages/piano-roll、packages/audio-engine、packages/midi-io、packages/composition；可选 services/agent-api。

music-core：tick 与 tempo map、轨道、稳定 note ID、revision、锁、操作校验、事务、diff、undo/redo；不依赖 React、Tone.js 或模型。
piano-roll：Canvas 2D 起步，按需评估 PixiJS；坐标与 hit-test、绘制和交互只产生命令。
audio-engine：Tone.js 候选，Transport 调度、音源加载、取消调度和资源释放。
midi-io：@tonejs/midi 候选；明确 MIDI 格式不能保存所有 Agent 元数据、锁和候选信息，因此 JSON 是无损工程格式。
composition：依据 D-005，AI 音乐生成仅使用通用 LLM；既有离线规则生成用于演示和测试，确定性算法用于检查音域、节拍、和声及写入约束，音乐审美另测；不引入专用音乐生成模型或模型 Provider。
agent-api：密钥托管、模型适配、请求限额（若采用服务器模式）。

关键边界：模型提议 ≠ 数据写入；播放状态 ≠ 工程数据；视图绘制 ≠ 音符真实来源。

## LLM 双入口（D-006，产品规则已批准，技术结构待评审）

- **对外 MCP 适配入口**：让外部 Agent 调用当前用户**明确授权**的工程上下文与候选/预览能力；必须实现浏览器权威 MusicProject 的会话绑定。MCP 本身不拥有工程状态、用户密钥或提交权限。MCP transport、Tool Schema、部署目录尚未确认。
- **工具内部 API/Key 入口**：用户在应用中填写 LLM API 地址和密钥，配置由受控本地或服务端凭据会话用于上游通用 LLM 调用，生成候选。当前只有环境变量 OpenAI 原型，无 API/Key UI。
- **共享下层**：两条入口共同调用 `composition` 的领域校验和 `music-core` dry-run、diff、显式批准及原子提交，不另造绕过锁和 revision 的审批路径。
- **密钥安全**：内部 Key 不交给 MCP、日志或工程 JSON，不在静态前端写死或持久化。浏览器输入秘密并不等于允许无限期浏览器存储；保管/过期/吊销/端点白名单、远程 MCP 认证等细节列为单独工程评审。
- 此处仅描述能力和边界，未宣称已实现。参见 [LLM_ACCESS_MODES.md](LLM_ACCESS_MODES.md)。
