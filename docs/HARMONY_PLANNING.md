# 和声规划合同 v0.1 · Planning before generation

## Scope
AI 多轨编配新增可选 HarmonyPlan。规划基于目标轨道旁的**独立用户输入**，不从 AI 猜测的调性自动升级为硬约束。源旋律始终只读且允许锁定；硬约束仅施加于将要新增的三条轨道。

规划包含：
- tonic：0–11 的 MIDI 音级主音；mode：自然大调或自然小调。
- degrees：每个 4/4 小节一个 1–7 音级，确定相应音阶上的**三和弦**。长度必须与目标连续小节数量一致；不支持任意非三和弦/转调。
- registers：harmony、bass、accompaniment 各自的 MIDI 音高下界和上界，包含边界。
- enforcement：scale/chords/registers 分别选择 `hard` 或 `soft`。

## Hard 与 Soft 的确定性语义
- **scale hard**：新增轨道中的所有音符音高类别都必须属于用户指定音阶；违规者拒绝整份候选。
- **chords hard**：新增轨道中的音符在其与任何一个计划小节**发声时间重叠**时，其音高类别都必须属于该小节的三和弦。跨和弦边界持续的音符需对两侧和弦均成立；违规者拒绝候选。
- **registers hard**：每个声部每个音符的 MIDI 音高必须在该声部音域内。
- 任一策略为 **soft** 时，**绝不自动改动模型音符**；仅将违规数量以附带 `role` 与 `constraint` 的 PlanFinding 显示在候选区。其余仍适用 MIDI 合法性和操作权限等硬约束。

**注意**：和弦外音（经过音、倚音、延留音、装饰音等）常属于合理作曲。选择 chords hard 的代价是它们也可能被禁止；希望保留音乐张力时应选择 chords soft。所有硬规则仅表示“遵守用户指定的结构合同”，**不表示更优的音乐审美质量**。

## Data flow
UI 构建 `HarmonyPlan`，先调用 `validateHarmonyPlan`；浏览器通过 `proposeArrangement` 校验并将计划传至本地 `POST /api/arrange`，服务端再次校验，传入 `ArrangementProvider`。OpenAI 模型获得 plan 与推测的 tonalProfile（后者明确是 uncertain hypothesis）作为两种**不同来源**的数据。模型输出未受信任，服务端调用 `checkHarmonyPlan` 检查后形成原子三轨候选；客户端收到音符还会独立执行相同验证。

开发用 `SeededArranger` 在规划启用时采用三和弦与声部音域选择规则来满足硬约束，但它仍是测试演示，不等同于专业和声生成。

违规后不修改工程。候选一旦通过校验，仍需用户显式审核并确认，受 revision 冲突保护与撤销机制约束。服务端以 422 返回合法的 plan_*_violation 类型，不回显模型响应体。

## Limitations
- 目前只支持自然大/小调的**各级三和弦**，不支持七和弦、临时变音、和声小调、爵士和弦、转调、复合拍号。
- 同时跨两个互不兼容和弦的延音可能无法满足 chords hard；这是明确规则，不是音乐错误。
- 当前声部范围是纯 MIDI 数值，不考虑实际乐器、音色和演奏法。
- 规划不会自动修改模型生成结果或退化为软约束。应由用户显式改变模式。
- 没有模型真实调用听感评测；CI 仅验证算法、API 和浏览器交互。
