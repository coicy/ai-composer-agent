# piano-roll — 仅视图和编辑意图
```text
src/
  viewport/   # tick/pitch 到像素映射、缩放和滚动
  rendering/  # Canvas 网格、键盘、音符、ghost diff、光标
  hit-test/   # 音符与拖拽手柄命中测试
  gestures/   # 插入、拖动、缩放、框选、剪切板意图
  selection/  # 视图选择投影
  index.ts
```
只接收 MusicProject 快照和 UI state，输出编辑意图/命令；不可写 core 状态。渲染与坐标转换可独立测试；每次缩放/滚动不得改变 tick 精度。Preview ghost 不得成为真实音符；不依赖 Tone.js、LLM、后端。
## 框选（已实现）
- 选区命中计算必须在 `src/selection` 以纯函数实现并单元测试，输入为网格本地坐标、MIDI 音符和几何参数。
- 只输出稳定 Note ID 或 tick 范围；不得直接改动 MusicProject，不得将屏幕像素当作持久音乐时间。
- 当前可框选当前轨道音符并将 ID 交给 Agent；未来扩展到多轨前必须新增明确 scope、权限与测试。
- 只删除 selected IDs，未选中的同时发声音符不得因 AI 重写而丢失。

## Viewport 与批量手工编辑（已实现的原型约束）
- `viewport/coordinates.ts` 为 Tick/Pitch ↔ Grid 坐标唯一换算入口。Zoom 只能改变 pixelsPerQuarter，不得重新量化已存在的 Note。
- `gestures/move.ts` 与 `gestures/velocity.ts` 只构造命令，必须将所有框选 Note ID 的命令作为一个 `ChangeSet` 交由 music-core 提交。
- 必须验证 Tick 整数性、MIDI 音高与 Velocity 0–127 / 1–127 区间、选中 ID 唯一性和锁定音符；跨轨锁与 revision 仍由 Music Core 最终校验。
- 不允许将 DOM 位置或像素坐标持久化为节奏数据。参考 docs/PIANO_ROLL_VIEWPORT.md。
