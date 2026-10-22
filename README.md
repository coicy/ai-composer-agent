# AI Composer Agent

轻量级 Web MIDI 自主作曲与编曲工作台。**当前为规划阶段，尚无可运行应用。**

## 产品目标
用户以自然语言让 Agent 从零生成真实可编辑的 MIDI 旋律，在**钢琴卷帘**中编辑、试听，再要求 Agent 局部续写、变奏、配和声及低音。人机共享工程状态，改动可预览、确认、撤销。

## 不变量
- 钢琴卷帘为唯一主音符编辑界面；不开发五线谱。
- Agent 写实际音符而非只给文字建议或不可编辑音频。
- 人工与 Agent 通过统一 MusicProject 和 MusicOperation 修改数据。
- 锁定、授权范围、版本冲突在命令执行器强制校验。
- Agent 改动先预览 diff，用户确认后原子提交；可撤销重做。
- 不在前端、仓库或日志暴露模型 API 密钥。

## 文档
- [Agent 工程约定](AGENTS.md)
- [产品需求](docs/PRODUCT.md)
- [交互规范](docs/UX.md)
- [架构](docs/ARCHITECTURE.md)
- [作曲 Agent](docs/COMPOSITION_AGENT.md)
- [数据协议](docs/DATA_AND_TOOLS.md)
- [路线图](docs/ROADMAP.md)
- [裁决与待定事项](docs/DECISIONS.md)
- [LLM 双接入模式](docs/LLM_ACCESS_MODES.md)
- [操作 Schema](schemas/music-operation.schema.json)

技术候选：React、TypeScript、Vite、Canvas 2D、Tone.js、@tonejs/midi；可选 Zustand 与 FastAPI，均待验证。许可证尚未决定。
## 本地运行与 AI 作曲

安装：`pnpm install`。终端 1 运行 `pnpm dev`。
如需调用 OpenAI 模型，在终端 2 的 shell 中设置 `OPENAI_API_KEY`，再执行 `pnpm dev:agent`。模型可通过 `OPENAI_MODEL` 配置，默认 `gpt-4.1-mini`。不要将密钥写入前端或提交仓库。详细说明见 [docs/LLM_INTEGRATION.md](docs/LLM_INTEGRATION.md)。

目前 AI 请求默认在现有轨道末尾追加音符，进入候选预览，不会自动覆盖作品。音乐质量及真实模型 API 调用尚未通过生产环境验证。

## LLM 双接入方向（已批准，待实现）

产品规则 **D-006**：① 外部 Agent 通过 **MCP** 调用本工具的 MIDI 编辑/创作能力；② 用户在本工具中填写 **LLM API 地址与 API Key**，由工具内部调用通用 LLM。二者都须经过现有候选预览和人工确认。**当前只有环境变量 `OPENAI_API_KEY` 驱动的本地 OpenAI 原型**；MCP Server、MCP 与活动项目会话桥接、应用内 API/Key 设置 UI 尚未开发。详细规范见 [docs/LLM_ACCESS_MODES.md](docs/LLM_ACCESS_MODES.md)。
