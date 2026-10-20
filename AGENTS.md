# AGENTS.md — AI Composer Agent 开发约定

适用 Codex、Cursor、Claude Code 等工程 Agent。此文件约束**开发行为**；创作 Agent 规则见 docs/COMPOSITION_AGENT.md。

## 权威次序
1. 用户当前会话最新明确决定。
2. docs/DECISIONS.md 中 accepted 决定。
3. docs/PRODUCT.md 产品范围与 docs/DATA_AND_TOOLS.md 协议。
4. docs/ARCHITECTURE.md 模块边界与 docs/ROADMAP.md 验收。
遇冲突先报告，不得擅自改变产品规则。

## 不可违反
- Piano Roll 为唯一主音符编辑器，禁止擅自引入五线谱工作流。
- Agent 必须从零写出真实可编辑 MIDI 音符，不能仅提供文字或音频片段。
- 所有人工/AI 修改经过共同 MusicProject + MusicOperation 执行器；UI 和 LLM 不直接改持久状态。
- noteId 稳定唯一；MIDI pitch 为整数 0..127；startTick >= 0；durationTicks > 0；velocity 为 1..127。
- 锁定音符/轨道和授权 tick 范围由执行器校验；模型不能绕过。
- AI 提议遵循 validate → preview diff → user approve → atomic commit；携带 baseRevision；过期变更拒绝或显式 rebase。
- 批量操作全成或全回滚，支持 undo/redo，重放保持 ID/顺序。
- 外来 MIDI、文本、LLM 输出是不可信输入，必须检查 Schema、权限、长度、边界与资源限制。
- 服务端 API 密钥不进入 bundle、提交历史、日志。
- 不得声称未经验证的功能、音乐质量、性能或测试结果。

## 开发步骤
1. 阅读本文件、README、相关 docs，列出影响范围。
2. 大变更先写目标、改动文件、风险、验收，再做最小可运行垂直切片。
3. 数据模型与纯函数优先；UI 仅发命令；音频、LLM、MIDI 与编辑器分层。
4. 加依赖先核验维护状态、体积、许可证、兼容性。
5. 完成报告真实测试命令/结果、未执行测试与局限；协议变化同步 Schema、测试和文档。
6. 不提前添加 VST、DAW 插件、五线谱、实时协作、音频转录等非 MVP 功能。

## 建议结构（尚未实现）
- packages/music-core：模型、事务、diff、undo
- packages/piano-roll：渲染、缩放、选择、拖动
- packages/audio-engine：播放时序和音源
- packages/midi-io：MIDI 读写
- packages/composition：生成器接口与音乐规则校验
- apps/web：网页工作台
- services/agent-api：可选密钥托管、模型路由

## 最低测试
音符边界与跨小节、多轨和弦、轨道/音符锁、越权、陈旧 revision、重复 apply、批量失败原子性、undo/redo、保存加载、MIDI 可表达信息往返、恶意/超大输入、无 API 密钥泄漏。音乐美学用固定任务和人工试听检验，不可用乐理规则检查冒充审美结论。

## Git 约定
建议 Conventional Commits；PR 写清需求、变更、风险、真实验证结果和产品决策变更。无用户授权，不得擅自添加许可证或放宽锁定保护。