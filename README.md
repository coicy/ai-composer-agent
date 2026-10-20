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
- [操作 Schema](schemas/music-operation.schema.json)

技术候选：React、TypeScript、Vite、Canvas 2D、Tone.js、@tonejs/midi；可选 Zustand 与 FastAPI，均待验证。许可证尚未决定。