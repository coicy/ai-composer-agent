# tests/AGENTS.md — 跨包测试
```text
contract/     # Schema、包公开 API 与兼容性
integration/  # core ↔ editor、audio、MIDI、composition 边界
e2e/          # 浏览器端用户操作与 Agent 审批闭环
fixtures/     # 小型稳定 MIDI / 工程样本（可合法分发）
```
包内纯单元测试靠近源码 `*.test.ts`；本目录只放跨包测试，避免测试包私有实现。不可使用真实付费模型作为默认 CI 测试；使用可控 fake provider。e2e 至少覆盖锁定、预览不写状态、过期 revision、撤销及 MIDI 导出。