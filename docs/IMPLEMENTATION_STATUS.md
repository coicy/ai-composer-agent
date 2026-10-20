# 实现状态

已实现：pnpm monorepo、React + Vite 工作台、基础音符钢琴卷帘编辑、简单 Web Audio 试听、revision 检查、轨道和音符锁拒绝、内存撤销/重做。新增多轨新增及切换、@tonejs/midi 导入导出（目前导出固定 120 BPM；尚未建 tempo map）。

待实现：Agent 自主创作、候选预览/批准、完整多轨混音、音色选择、乐曲速度与拍号编辑、持久工程、节拍滚动跟随、完整安全和性能测试。MIDI 不保留工程锁/历史/AI 候选，导入会生成新项目。CI 结果以实际 GitHub Actions 为准。