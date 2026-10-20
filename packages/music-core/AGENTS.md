# music-core — 领域权威
```text
src/
  model/        # MusicProject、Track、Note、tempo/meter、标识符
  commands/     # 操作类型、解析、命令执行器
  validation/   # schema-independent 不变量、范围和锁
  transactions/ # revision 检查、原子应用、幂等 requestId
  history/      # 变更日志、undo/redo、diff
  selection/    # 选区与可写范围计算
  serialization/# 无损 JSON 工程序列化及版本迁移
  index.ts
```
唯一持有编辑状态的核心；提交事务时权限与锁必须重查。所有 mutation 为不可变输入输出，不直接修改传入对象。tick 整数，pitch 0–127，velocity 1–127，duration > 0，stable ID。拒绝越权/陈旧 revision/非法批量时状态完全不变；音符重叠允许（多声部/和弦），不可自行禁止。禁止 React、WebAudio、Tone.js、SDK、fetch、DOM。