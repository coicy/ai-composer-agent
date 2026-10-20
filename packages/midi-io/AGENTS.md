# midi-io — MIDI 交换边界
```text
src/
  import/       # SMF 到核心工程/导入建议
  export/       # 核心数据到 SMF
  mapping/      # ticks、program、tempo/meter 映射
  validation/   # 大小、轨数、事件和损坏数据检查
  index.ts
```
导入只是候选项目/命令，不直接应用；明确丢失锁、候选、history 等非 MIDI 语义。核心工程 JSON 不属于 MIDI I/O，而由 music-core/serialization 负责。MIDI 解析库封装在包内部，测试往返只针对 MIDI 可表达字段。