# AGENTS.md — 仓库级开发 Agent 约定

本文件适用于全仓库。进入子目录必须继续读取其最近的 `AGENTS.md`；子目录规则细化全局规则，不得放宽安全、数据一致性及产品限制。若嵌套规则冲突，以用户最新明确裁决和仓库根级不变量为准，报告冲突后停止相关修改。

## 产品不变量
- 唯一主音符编辑器：Piano Roll，不引入五线谱。
- Agent 自主生成真实、可编辑的 MIDI 音符；人工编辑与 Agent 共享 MusicProject。
- **正式裁决 D-005（2026-10-22）**：AI 音乐创作与编曲仅使用通用 LLM；禁止引入 MIDI-GPT 等专用音乐生成模型、权重、专用模型适配器/部署及其研究接入任务。允许保留确定性音乐分析、Music Core 验证、音频合成和现有离线规则演示，但不得替代 LLM 成为 AI 生成引擎。
- 所有变更通过 music-core 命令执行器，`baseRevision` + 授权范围 + 锁检查 + 原子提交；AI 变更先 preview，显式批准后应用；支持撤销。
- 外来内容与 AI 返回不可信；密钥不能放前端、仓库或日志；不得虚报已实现功能或测试。

- **D-006（2026-10-22）**：提供外部 Agent + MCP 及内部通用 LLM API + key 两种入口；必须遵守 `docs/DUAL_ENTRY_AND_SECRET_SECURITY.md`，凭据不能写入仓库、日志或工程文件；MCP 不可绕过用户批准。

## 权威次序
1. 用户最新明确裁决。
2. `docs/DECISIONS.md` 中 accepted。
3. `docs/PRODUCT.md` 与 `docs/DATA_AND_TOOLS.md`。
4. 本文件的跨模块约束、`docs/ARCHITECTURE.md` 与最近子目录 `AGENTS.md`。
5. `docs/ROADMAP.md` 和其他提议。
架构属于工程基线；修改模块边界必须同步更新文档并说明迁移影响；不得将 proposed 事项称为用户已裁定。

## 固定仓库边界（先建立目录协议，模块实现尚未完成）
```text
apps/
  web/                 # UI 组合根、应用状态和用户工作流
packages/
  music-core/          # 唯一工程数据模型、命令、事务和历史
  piano-roll/          # 编辑视图、命中检测和手势转换
  audio-engine/        # 试听、Transport 与音源
  midi-io/             # SMF 导入导出；项目 JSON 由 core 定义
  composition/         # 作曲能力、生成模型适配与候选验证
services/
  agent-api/           # 可选服务端 LLM 网关和鉴权
schemas/               # 跨边界交换格式及版本化 Schema
docs/                  # 产品、设计、架构与决策文档
tests/                 # 跨包集成、契约及端到端测试
```
每个一级子系统目录的 `AGENTS.md` 定义下一级模块。**禁止**将功能随意扔进 `utils/`、`common/`、`misc/`、`helpers/` 或未约定根目录；新增职责先判断所属模块再创建文件。

## 依赖方向（仅允许显式接口）
- `music-core` 为纯 TypeScript 领域核心，**不得依赖** React、浏览器、Tone.js、AI SDK、服务端框架或其他工作区包。
- `piano-roll` 依赖 `music-core` 公开契约；不得直接修改工程对象，也不依赖 audio-engine、composition 或 agent-api。
- `audio-engine` 和 `midi-io` 依赖 core 契约；互相独立，不导入 UI 或 agent SDK。
- `composition` 依赖 core 的只读结构和变更契约；仅返回候选，不提交工程状态。
- `services/agent-api` 可使用 composition 契约和 schemas；不得反向被 core 或 UI 的领域逻辑依赖。
- `apps/web` 是组合根，可调度上述包和服务客户端；**不承载领域规则或模型密钥**。
- `schemas` 是跨进程协议资产，不导入任何运行时应用代码。
- 依赖图不得有循环；包间只通过其 `src/index.ts` 公共 API 导入，不得跨包引用 `src/internal`。

## 模块内部约定
- 一个文件有单一责任；公开 API 从 `src/index.ts` 汇出，内部实现留在其职责文件夹；测试默认与实现同层 `*.test.ts`。
- `types/` 仅放确实跨同包子模块共享的类型，不作为业务垃圾桶。
- core 使用整数 tick（时间）与 MIDI pitch 0..127、velocity 1..127；`startTick >= 0`、`durationTicks > 0`；稳定 note ID。
- 每次更改接口，更新调用方、Schema（跨边界时）、相关测试和 docs。
- UI 只生成用户意图或命令；无论来自鼠标还是 Agent，必须经过相同执行器。
- 正式批准前的 AI 候选和预览不得改变持久工程 revision。

## 工作与验收
变更前阅读根文件、目标目录 `AGENTS.md`、相关 docs；大变更写目标/范围/风险/验证方案。优先 M0→M1→M2→M3→M4 的薄切片。为边界、并发 revision、锁、幂等、rollback、undo/redo、序列化和 MIDI 往返写测试；音乐审美须另行人工试听，不可用静态规则冒充审美保证。

提交采用 conventional commits；PR 说明产品影响、依赖变化、真实运行测试和未验证事项。未经用户同意不添加许可证、不擅自引入五线谱、DAW 插件、VST、音频转录及多人协同。

## CI 与分支保护开发流程
- 不再向 `main` 提交未经验证的中间实现。先从 `main` 建功能分支，以 PR 的 `check`、`e2e` 两项绿灯作为合并门槛。任一失败时修复 PR 分支，禁止绕过检查。
- 仅在 CI 真正显示 completed/success 后称为通过；不得用仅有 Job 完成、workflow 尚在进行的状态宣称完全通过。
- 详细步骤与无法本地运行的降级路径见 docs/DEVELOPMENT.md。GitHub Ruleset/branch protection 仍需管理员单独配置，流程文档并不自动强制仓库权限。
