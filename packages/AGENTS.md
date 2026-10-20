# packages/AGENTS.md
packages 为无应用启动逻辑的可重用库；每个包提供 src/index.ts、包内 AGENTS.md 与对应测试。包间仅导入公开入口，依赖保持单向无环。包不得擅自创建全局状态单例。