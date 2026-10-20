# 实现状态（持续更新）
- pnpm workspace、React/Vite 启动页、基础包和 GitHub Actions。
- Music Core：音符/轨道验证，按 revision 的批量新增、修改、删除和锁定轨道/音符的拒绝；内存快照式 undo/redo；基础 Vitest 测试。
- 钢琴卷帘初步实现双击创建、拖动音符改变时间与音高、右缘缩放音符时值、选中删除、撤销/重做。
- 仍未实现：Agent 自主作曲、候选预览与审批、音频播放、MIDI 导入导出、细粒度锁定指令、项目持久化、长期 history 与事务幂等。
- 目前拖动交互仅支持测试音域 60–83、单轨、固定缩放/量化；不能宣称完整编辑器。
- CI 结果以当前 commit 的 GitHub Actions 为准，未完成运行不得声称通过。
