# composition — 作曲生成，不拥有工程
```text
src/
  contracts/   # ComposeRequest、Candidate、约束与上下文
  planning/    # 风格、动机、乐句和曲式计划
  generators/  # LLM/规则/符号模型的替换接口
  harmony/     # 和声与低音方案
  variations/  # 续写、模进和局部变奏
  evaluation/  # 结构/音域/重复等可解释检查
  orchestration/ # 后续配器扩展（非 MVP 先不实现）
  index.ts
```
必须输出可编辑结构化音符或候选 MusicOperation；绝不直接调用 core commit。不得覆盖锁定区间，不把概率或美学评分当确定性事实。LLM 调用通过注入 Provider 接口，密钥及 HTTP 实现不放这里；所有模型结果二次验证。候选保持可比较与可溯源。